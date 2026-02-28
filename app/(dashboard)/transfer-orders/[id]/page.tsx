import { db } from "@/server/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOActions } from "./TOActions";
import { TOReceiveForm } from "./TOReceiveForm";

async function getTO(id: string) {
  return db.transferOrder.findUnique({
    where: { id },
    include: {
      fromLocation: { select: { name: true, code: true } },
      toLocation: { select: { name: true, code: true } },
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      lines: { include: { productVariant: { include: { product: { select: { name: true, brand: true } } } } } },
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

export default async function TODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = await getTO(id);
  if (!to) notFound();

  const canApprove = to.status === "REQUESTED";
  const canShip = to.status === "APPROVED";
  const canReceive = ["IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(to.status);
  const canCancel = !["COMPLETED", "CANCELLED", "IN_TRANSIT"].includes(to.status);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/transfer-orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Transfer Orders
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-slate-500">{to.orderNumber}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusStyle[to.status]}`}>
              {to.status.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {to.fromLocation.name} → {to.toLocation.name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Requested by {to.requestedBy.name}
            {to.approvedBy && ` · Approved by ${to.approvedBy.name}`}
          </p>
        </div>
        <TOActions toId={to.id} canApprove={canApprove} canShip={canShip} canCancel={canCancel} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-xs text-slate-500">From</div>
          <div className="font-semibold mt-0.5 text-sm">{to.fromLocation.name}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Expected Arrival</div>
          <div className="font-semibold mt-0.5">
            {to.expectedArrival ? new Date(to.expectedArrival).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Actual Arrival</div>
          <div className="font-semibold mt-0.5">
            {to.actualArrival ? new Date(to.actualArrival).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Product</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Requested</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Shipped</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Received</th>
              </tr>
            </thead>
            <tbody>
              {to.lines.map((line, i) => (
                <tr key={line.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800 text-sm">{line.productVariant.product.brand} — {line.productVariant.product.name}</div>
                    <div className="text-xs text-slate-400">{line.productVariant.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">{line.quantityRequested}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{line.quantityShipped}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={line.quantityReceived >= line.quantityShipped && line.quantityShipped > 0 ? "text-green-600 font-medium" : "text-slate-500"}>
                      {line.quantityReceived}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canReceive && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Receive at {to.toLocation.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <TOReceiveForm toId={to.id} lines={to.lines.map((l) => ({ id: l.id, sku: l.productVariant.sku, name: `${l.productVariant.product.brand} — ${l.productVariant.product.name}`, shipped: l.quantityShipped, received: l.quantityReceived }))} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
