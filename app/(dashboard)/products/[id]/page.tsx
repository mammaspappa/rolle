import { db } from "@/server/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AddVariantForm } from "./AddVariantForm";

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

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id);
  if (!product) notFound();

  const totalUnits = product.variants.reduce(
    (sum, v) =>
      sum + v.inventoryLevels.reduce((s, l) => s + l.quantityOnHand, 0),
    0
  );

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
          <h1 className="text-2xl font-semibold text-slate-900">
            {product.name}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {product.brand} · SKU {product.sku}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">
            {totalUnits.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">total units on hand</div>
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

      {/* Variants with stock breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Variants & Stock Levels</h2>
          <AddVariantForm
            productId={product.id}
            productSku={product.sku}
            unitCost={Number(product.unitCost)}
          />
        </div>
        {product.variants.map((variant) => {
          const variantTotal = variant.inventoryLevels.reduce(
            (s, l) => s + l.quantityOnHand,
            0
          );
          const warehouse = variant.inventoryLevels.find(
            (l) => l.location.type === "WAREHOUSE"
          );
          const stores = variant.inventoryLevels.filter(
            (l) => l.location.type === "STORE"
          );

          return (
            <Card key={variant.id}>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {variant.sku}
                  {variant.color && (
                    <span className="text-slate-500 font-normal ml-2">
                      {variant.color}
                    </span>
                  )}
                  {variant.size && (
                    <span className="text-slate-500 font-normal ml-2">
                      Size {variant.size}
                    </span>
                  )}
                </CardTitle>
                <span className="text-sm font-semibold text-slate-700">
                  {variantTotal} units total
                </span>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <table className="w-full text-xs">
                  <tbody>
                    {/* Warehouse first */}
                    {warehouse && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 font-medium text-slate-600 w-1/2">
                          🏭 {warehouse.location.name}
                        </td>
                        <td className="py-1.5 text-right">
                          <StockCell qty={warehouse.quantityOnHand} inTransit={warehouse.quantityInTransit} />
                        </td>
                      </tr>
                    )}
                    {stores.map((level) => (
                      <tr
                        key={level.location.code}
                        className="border-b border-slate-50"
                      >
                        <td className="py-1 text-slate-600">
                          {level.location.name}
                          <span className="text-slate-400 ml-1">
                            ({level.location.city})
                          </span>
                        </td>
                        <td className="py-1 text-right">
                          <StockCell qty={level.quantityOnHand} inTransit={level.quantityInTransit} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StockCell({ qty, inTransit }: { qty: number; inTransit: number }) {
  const color =
    qty === 0
      ? "text-red-600 font-semibold"
      : qty <= 3
      ? "text-orange-600"
      : "text-slate-700";
  return (
    <span className={color}>
      {qty}
      {inTransit > 0 && (
        <span className="text-slate-400 ml-1">(+{inTransit} incoming)</span>
      )}
    </span>
  );
}
