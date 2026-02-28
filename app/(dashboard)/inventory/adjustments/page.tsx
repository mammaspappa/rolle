import { db } from "@/server/db";
import { AdjustmentForm } from "./AdjustmentForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdjustmentsPage() {
  const [locations, variants] = await Promise.all([
    db.location.findMany({ where: { isActive: true }, orderBy: [{ type: "desc" }, { city: "asc" }], select: { id: true, code: true, name: true } }),
    db.productVariant.findMany({
      where: { isActive: true },
      include: { product: { select: { name: true, brand: true, unitCost: true } } },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Inventory
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Stock Adjustment</h1>
        <p className="text-sm text-slate-500 mt-1">Manually correct stock levels. All adjustments are logged in the movement history.</p>
      </div>
      <AdjustmentForm
    locations={locations}
    variants={variants.map((v) => ({ ...v, product: { ...v.product, unitCost: Number(v.product.unitCost) } }))}
  />
    </div>
  );
}
