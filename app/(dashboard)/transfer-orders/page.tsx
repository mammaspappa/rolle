import { db } from "@/server/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeftRight } from "lucide-react";

async function getTOs() {
  return db.transferOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromLocation: { select: { code: true, name: true } },
      toLocation: { select: { code: true, name: true } },
      requestedBy: { select: { name: true } },
      lines: { select: { quantityRequested: true, quantityReceived: true } },
    },
  });
}

const statusStyle: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  REQUESTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-indigo-100 text-indigo-700",
  IN_TRANSIT: "bg-amber-100 text-amber-700",
  PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

export default async function TransferOrdersPage() {
  const tos = await getTOs();

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Transfer Orders</h1>
          <p className="text-sm text-slate-500 mt-1">{tos.length} orders</p>
        </div>
        <Link href="/transfer-orders/new">
          <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> New Transfer</Button>
        </Link>
      </div>

      {tos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No transfer orders yet.</p>
          <Link href="/transfer-orders/new">
            <Button variant="outline" size="sm" className="mt-4">Create first transfer</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Order #</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">From</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">To</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">Lines</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">Units</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Expected</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">By</th>
              </tr>
            </thead>
            <tbody>
              {tos.map((to, i) => {
                const totalUnits = to.lines.reduce((s, l) => s + l.quantityRequested, 0);
                return (
                  <tr key={to.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/transfer-orders/${to.id}`} className="font-mono text-xs text-blue-600 hover:underline">{to.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{to.fromLocation.code}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700 font-medium">{to.toLocation.code}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusStyle[to.status]}`}>{to.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{to.lines.length}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">{totalUnits}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {to.expectedArrival ? new Date(to.expectedArrival).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{to.requestedBy.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
