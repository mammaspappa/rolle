import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, Plus, Upload } from "lucide-react";

async function getProducts() {
  return db.product.findMany({
    where: { isActive: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    include: {
      supplier: { select: { name: true } },
      variants: {
        where: { isActive: true },
        include: {
          inventoryLevels: {
            select: { quantityOnHand: true },
          },
        },
      },
    },
  });
}

export default async function ProductsPage() {
  const products = await getProducts();

  // Group by brand
  const byBrand = products.reduce<Record<string, typeof products>>(
    (acc, p) => {
      acc[p.brand] = acc[p.brand] ?? [];
      acc[p.brand].push(p);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-1">
            {products.length} products ·{" "}
            {products.reduce((s, p) => s + p.variants.length, 0)} variants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products/import">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="w-4 h-4" /> Import CSV
            </Button>
          </Link>
          <Link href="/products/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> New Product
            </Button>
          </Link>
        </div>
      </div>

      {Object.entries(byBrand).map(([brand, brandProducts]) => (
        <div key={brand}>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            {brand}
          </h2>
          <div className="space-y-2">
            {brandProducts.map((product) => {
              const totalUnits = product.variants.reduce(
                (sum, v) =>
                  sum +
                  v.inventoryLevels.reduce(
                    (s, l) => s + l.quantityOnHand,
                    0
                  ),
                0
              );
              const variantCount = product.variants.length;
              const stockoutVariants = product.variants.filter((v) =>
                v.inventoryLevels.every((l) => l.quantityOnHand === 0)
              ).length;

              return (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <Card className="p-4 hover:border-slate-400 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-slate-100 rounded-md flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {product.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                          {stockoutVariants > 0 && (
                            <Badge className="text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                              {stockoutVariants} stockout
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          SKU {product.sku} · {variantCount} variant
                          {variantCount !== 1 ? "s" : ""} · Supplier:{" "}
                          {product.supplier.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-slate-800">
                          {totalUnits.toLocaleString()} units
                        </div>
                        <div className="text-xs text-slate-400">
                          €{Number(product.retailPrice).toLocaleString()} retail
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No products yet.</p>
        </div>
      )}
    </div>
  );
}
