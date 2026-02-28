import { db } from "@/server/db";
import { CheckCircle } from "lucide-react";
import { AlertRow } from "./AlertRow";
import { ResolveAllButton } from "./ResolveAllButton";
import { RunReorderButton } from "./RunReorderButton";

async function getAlerts() {
  return db.alert.findMany({
    where: { isResolved: false },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    include: {
      productVariant: {
        include: { product: { select: { name: true, brand: true } } },
      },
      location: { select: { name: true, code: true, city: true } },
    },
  });
}

function getAction(
  type: string,
  referenceId: string | null,
  referenceType: string | null,
  locationId: string | null,
  productVariantId: string | null,
): { href: string; label: string } | null {
  const toParam = locationId ? `toLocationId=${locationId}` : "";
  const variantParam = productVariantId ? `variantId=${productVariantId}` : "";

  switch (type) {
    case "STOCKOUT": {
      const params = [toParam, variantParam].filter(Boolean).join("&");
      return { href: `/transfer-orders/new${params ? `?${params}` : ""}`, label: "Create Transfer Order" };
    }
    case "LOW_STOCK":
    case "REORDER_TRIGGERED":
    case "OVERSTOCK": {
      return { href: `/allocation${variantParam ? `?${variantParam}` : ""}`, label: "Review Allocation" };
    }
    case "DELAYED_SHIPMENT":
      if (!referenceId) return null;
      return referenceType === "PO"
        ? { href: `/purchase-orders/${referenceId}`, label: "View Purchase Order" }
        : { href: `/transfer-orders/${referenceId}`, label: "View Transfer Order" };
    case "TRANSFER_OVERDUE":
      if (!referenceId) return null;
      return { href: `/transfer-orders/${referenceId}`, label: "View Transfer Order" };
    default:
      return null;
  }
}

const severityStyles: Record<string, { badge: string; row: string }> = {
  CRITICAL: {
    badge: "bg-red-100 text-red-700 border-red-200",
    row: "border-l-4 border-l-red-400",
  },
  WARNING: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    row: "border-l-4 border-l-yellow-400",
  },
  INFO: {
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    row: "border-l-4 border-l-blue-300",
  },
};

const alertTypeLabel: Record<string, string> = {
  LOW_STOCK: "Low Stock",
  STOCKOUT: "Stockout",
  OVERSTOCK: "Overstock",
  REORDER_TRIGGERED: "Reorder Triggered",
  DELAYED_SHIPMENT: "Delayed Shipment",
  TRANSFER_OVERDUE: "Transfer Overdue",
};

export default async function AlertsPage() {
  const alerts = await getAlerts();

  const critical = alerts.filter((a) => a.severity === "CRITICAL");
  const warning = alerts.filter((a) => a.severity === "WARNING");
  const info = alerts.filter((a) => a.severity === "INFO");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">
            {alerts.length} open alert{alerts.length !== 1 ? "s" : ""}
            {critical.length > 0 && (
              <span className="text-red-600 ml-2 font-medium">
                · {critical.length} critical
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunReorderButton />
          {alerts.length > 0 && <ResolveAllButton />}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-slate-600">All clear — no open alerts</p>
          <p className="text-sm mt-1">Run a reorder check to scan for new issues.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { label: "Critical", items: critical },
            { label: "Warning", items: warning },
            { label: "Info", items: info },
          ].map(({ label, items }) => {
            if (items.length === 0) return null;
            return (
              <section key={label}>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  {label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((alert) => {
                    const styles = severityStyles[alert.severity] ?? severityStyles.INFO;
                    return (
                      <AlertRow
                        key={alert.id}
                        alert={{
                          id: alert.id,
                          type: alert.type,
                          severity: alert.severity,
                          message: alert.message,
                          createdAt: alert.createdAt.toISOString(),
                          location: alert.location
                            ? { name: alert.location.name, code: alert.location.code }
                            : null,
                          productVariant: alert.productVariant
                            ? {
                                sku: alert.productVariant.sku,
                                productName: alert.productVariant.product.name,
                              }
                            : null,
                        }}
                        styles={styles}
                        typeLabel={alertTypeLabel[alert.type] ?? alert.type}
                        action={getAction(alert.type, alert.referenceId, alert.referenceType, alert.locationId, alert.productVariantId)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
