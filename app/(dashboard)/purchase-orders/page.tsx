import { db } from "@/server/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart } from "lucide-react";

async function getPOs() {
  return db.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      destination: { select: { name: true, code: true } },
      lines: { select: { quantityOrdered: true, quantityReceived: true } },
    },
  });
}

const statusStyle: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-indigo-100 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

export default async function PurchaseOrdersPage() {
  const pos = await getPOs();

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-1">{pos.length} orders</p>
        </div>
        <Link href="/purchase-orders/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> New PO
          </Button>
        </Link>
      </div>

      {pos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No purchase orders yet.</p>
          <Link href="/purchase-orders/new">
            <Button variant="outline" size="sm" className="mt-4">Create first PO</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Order #</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Supplier</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Destination</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">Lines</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">Value</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Expected</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po, i) => (
                <tr key={po.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/purchase-orders/${po.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                      {po.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{po.supplier.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{po.destination.code}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusStyle[po.status]}`}>
                      {po.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{po.lines.length}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                    {po.currency} {Number(po.totalCost).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {po.expectedArrival ? new Date(po.expectedArrival).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
