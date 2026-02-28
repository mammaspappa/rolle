import { db } from "@/server/db";
import { NewPurchaseOrderForm } from "./NewPurchaseOrderForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewPOPage() {
  const [suppliers, warehouse, variants] = await Promise.all([
    db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.location.findFirst({ where: { type: "WAREHOUSE" } }),
    db.productVariant.findMany({
      where: { isActive: true },
      include: { product: { select: { name: true, brand: true, unitCost: true, currency: true } } },
      orderBy: { sku: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Purchase Orders
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Purchase Order</h1>
        <p className="text-sm text-slate-500 mt-1">Order stock from a supplier</p>
      </div>
      <NewPurchaseOrderForm suppliers={suppliers} warehouseId={warehouse?.id ?? ""} variants={variants} />
    </div>
  );
}
