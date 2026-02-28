import { db } from "@/server/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POActions } from "./POActions";
import { ReceiveForm } from "./ReceiveForm";

async function getPO(id: string) {
  return db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      destination: { select: { name: true, code: true } },
      createdBy: { select: { name: true } },
      lines: {
        include: { productVariant: { include: { product: { select: { name: true, brand: true } } } } },
      },
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

const statusNext: Record<string, string> = {
  DRAFT: "Mark as Sent",
  SENT: "Mark as Confirmed",
};

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await getPO(id);
  if (!po) notFound();

  const canAdvance = ["DRAFT", "SENT"].includes(po.status);
  const canReceive = ["CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status);
  const canCancel = !["COMPLETED", "CANCELLED"].includes(po.status);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Purchase Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-slate-500">{po.orderNumber}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusStyle[po.status]}`}>
              {po.status.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{po.supplier.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">→ {po.destination.name} · Created by {po.createdBy.name}</p>
        </div>
        <POActions poId={po.id} canAdvance={canAdvance} nextLabel={statusNext[po.status]} canCancel={canCancel} />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-xs text-slate-500">Total Value</div>
          <div className="font-semibold mt-0.5">{po.currency} {Number(po.totalCost).toLocaleString()}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Expected Arrival</div>
          <div className="font-semibold mt-0.5">
            {po.expectedArrival ? new Date(po.expectedArrival).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Actual Arrival</div>
          <div className="font-semibold mt-0.5">
            {po.actualArrival ? new Date(po.actualArrival).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </div>
        </Card>
      </div>

      {/* Lines */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Product</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Ordered</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Received</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Unit Cost</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line, i) => (
                <tr key={line.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800">{line.productVariant.product.brand} — {line.productVariant.product.name}</div>
                    <div className="text-xs text-slate-400">{line.productVariant.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">{line.quantityOrdered}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={line.quantityReceived >= line.quantityOrdered ? "text-green-600 font-medium" : line.quantityReceived > 0 ? "text-yellow-600" : "text-slate-400"}>
                      {line.quantityReceived}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{po.currency} {Number(line.unitCost).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {po.currency} {(Number(line.unitCost) * line.quantityOrdered).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Receive form */}
      {canReceive && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Receive Shipment</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiveForm poId={po.id} lines={po.lines.map((l) => ({ id: l.id, sku: l.productVariant.sku, name: `${l.productVariant.product.brand} — ${l.productVariant.product.name}`, ordered: l.quantityOrdered, received: l.quantityReceived }))} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
