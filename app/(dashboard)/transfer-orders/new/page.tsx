import { db } from "@/server/db";
import { NewTransferOrderForm } from "./NewTransferOrderForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewTOPage() {
  const [locations, variants] = await Promise.all([
    db.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "desc" }, { city: "asc" }],
      select: { id: true, code: true, name: true, type: true },
    }),
    db.productVariant.findMany({
      where: { isActive: true },
      include: {
        product: { select: { name: true, brand: true, unitCost: true } },
        inventoryLevels: { select: { locationId: true, quantityOnHand: true, quantityReserved: true } },
      },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/transfer-orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Transfer Orders
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Transfer Order</h1>
        <p className="text-sm text-slate-500 mt-1">Move stock between locations</p>
      </div>
      <NewTransferOrderForm
        locations={locations}
        variants={variants.map((v) => ({ ...v, product: { ...v.product, unitCost: Number(v.product.unitCost) } }))}
      />
    </div>
  );
}
