import { db } from "@/server/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditProductForm } from "./EditProductForm";
import { VariantsSection, type SerializedVariant } from "./VariantsSection";

async function getProduct(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      supplier: true,
      variants: {
        where: { isActive: true },
        orderBy: [{ color: "asc" }, { size: "asc" }],
        include: {
          inventoryLevels: {
            include: {
              location: {
                select: { code: true, name: true, type: true, city: true },
              },
            },
            orderBy: { location: { type: "desc" } },
          },
        },
      },
    },
  });
}

async function getSuppliers() {
  return db.supplier.findMany({
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, suppliers] = await Promise.all([getProduct(id), getSuppliers()]);
  if (!product) notFound();

  const totalUnits = product.variants.reduce(
    (sum, v) =>
      sum + v.inventoryLevels.reduce((s, l) => s + l.quantityOnHand, 0),
    0
  );

  // Serialize Decimal fields + flatten for client components
  const serializedVariants: SerializedVariant[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    unitCost: v.unitCost !== null ? Number(v.unitCost) : null,
    totalUnits: v.inventoryLevels.reduce((s, l) => s + l.quantityOnHand, 0),
    levels: v.inventoryLevels.map((l) => ({
      locationCode: l.location.code,
      locationName: l.location.name,
      locationType: l.location.type,
      locationCity: l.location.city,
      quantityOnHand: l.quantityOnHand,
      quantityInTransit: l.quantityInTransit,
    })),
  }));

  const productDefaults = {
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    description: product.description,
    supplierId: product.supplierId,
    unitCost: Number(product.unitCost),
    retailPrice: Number(product.retailPrice),
    leadTimeDays: product.leadTimeDays,
    reorderPoint: product.reorderPoint,
    safetyStock: product.safetyStock,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All products
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{product.category}</Badge>
            {product.subcategory && (
              <Badge variant="outline" className="text-slate-400">
                {product.subcategory}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {product.brand} · SKU {product.sku}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-3">
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {totalUnits.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">total units on hand</div>
          </div>
          <EditProductForm
            productId={product.id}
            defaultValues={productDefaults}
            suppliers={suppliers}
          />
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-slate-500">Unit Cost</div>
          <div className="font-semibold mt-0.5">
            €{Number(product.unitCost).toLocaleString()}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Retail Price</div>
          <div className="font-semibold mt-0.5">
            €{Number(product.retailPrice).toLocaleString()}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Lead Time</div>
          <div className="font-semibold mt-0.5">{product.leadTimeDays} days</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Supplier</div>
          <div className="font-semibold mt-0.5 text-sm truncate">
            {product.supplier.name}
          </div>
        </Card>
      </div>

      {/* Variants */}
      <VariantsSection
        productId={product.id}
        productSku={product.sku}
        defaultUnitCost={Number(product.unitCost)}
        variants={serializedVariants}
      />
    </div>
  );
}
