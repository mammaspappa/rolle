import { db } from "@/server/db";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Truck,
  Package,
  Boxes,
  BarChart3,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── data ─────────────────────────────────────────────────────────────────────

async function getSetupState() {
  const [
    supplierCount,
    productCount,
    stockMovementCount,
    forecastCount,
    purchaseOrderCount,
  ] = await Promise.all([
    db.supplier.count({ where: { isActive: true } }),
    db.product.count({ where: { isActive: true } }),
    db.stockMovement.count(),
    db.demandForecast.count(),
    db.purchaseOrder.count(),
  ]);

  return {
    hasSuppliers: supplierCount > 0,
    hasProducts: productCount > 0,
    hasStock: stockMovementCount > 0,
    hasSalesData: stockMovementCount > 0, // any SALE movements
    hasForecasts: forecastCount > 0,
    hasPurchaseOrders: purchaseOrderCount > 0,
    supplierCount,
    productCount,
    stockMovementCount,
    forecastCount,
  };
}

// ── components ────────────────────────────────────────────────────────────────

interface StepProps {
  number: number;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
  icon: React.ReactNode;
  detail?: string;
}

function Step({ number, title, description, done, href, cta, icon, detail }: StepProps) {
  return (
    <div className={`flex gap-4 p-5 rounded-lg border transition-colors ${
      done
        ? "bg-green-50/60 border-green-200"
        : "bg-white border-slate-200 hover:border-slate-300"
    }`}>
      {/* Icon / number */}
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        done ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
      }`}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Step {number}</span>
              {done && (
                <span className="text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                  Complete
                </span>
              )}
            </div>
            <h3 className={`font-semibold mt-0.5 ${done ? "text-green-800" : "text-slate-800"}`}>
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
            {detail && (
              <p className="text-xs text-slate-400 mt-1 font-mono">{detail}</p>
            )}
          </div>
          {!done && (
            <Link href={href}>
              <Button size="sm" variant="outline" className="shrink-0">
                {cta}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function SetupPage() {
  const state = await getSetupState();

  const steps: StepProps[] = [
    {
      number: 1,
      title: "Add your first supplier",
      description:
        "Suppliers are required before you can create products or purchase orders. Add lead times so the system can calculate reorder points automatically.",
      done: state.hasSuppliers,
      href: "/suppliers",
      cta: "Add supplier",
      icon: <Truck className="w-5 h-5" />,
      detail: state.hasSuppliers ? `${state.supplierCount} supplier(s) configured` : undefined,
    },
    {
      number: 2,
      title: "Create products and variants",
      description:
        "Add your product catalogue. Each variant (size/color) automatically gets a stock row at all 21 locations. Use CSV import for bulk entry.",
      done: state.hasProducts,
      href: "/products/new",
      cta: "Add product",
      icon: <Package className="w-5 h-5" />,
      detail: state.hasProducts ? `${state.productCount} product(s) in catalogue` : undefined,
    },
    {
      number: 3,
      title: "Record initial stock",
      description:
        "Set starting inventory levels using a Purchase Order (for new stock arriving from suppliers) or a manual stock adjustment for pre-existing inventory.",
      done: state.hasStock,
      href: "/purchase-orders/new",
      cta: "Create PO",
      icon: <Boxes className="w-5 h-5" />,
      detail: state.hasStock ? `${state.stockMovementCount} stock movement(s) recorded` : undefined,
    },
    {
      number: 4,
      title: "Import sales history",
      description:
        "Upload past sales data (CSV) so the forecasting engine has a demand baseline. At least 4 weeks of data is recommended — 12+ weeks unlocks Holt-Winters seasonal forecasting.",
      done: state.hasSalesData,
      href: "/inventory/sales-import",
      cta: "Import sales",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      number: 5,
      title: "Run your first demand forecast",
      description:
        "Trigger the forecasting engine to generate next-week demand predictions. The system auto-selects the best algorithm per SKU (WMA, Holt-Winters, Croston, or Ensemble).",
      done: state.hasForecasts,
      href: "/forecasts",
      cta: "Go to forecasts",
      icon: <TrendingUp className="w-5 h-5" />,
      detail: state.hasForecasts ? `${state.forecastCount} forecast row(s) generated` : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h1 className="text-2xl font-semibold text-slate-900">Getting Started</h1>
        </div>
        <p className="text-sm text-slate-500">
          Complete these steps to have Rolle fully operational.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {allDone ? "All steps complete!" : `${completedCount} of ${steps.length} steps complete`}
          </span>
          <span className={`font-semibold ${allDone ? "text-green-600" : "text-slate-500"}`}>
            {progressPct}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allDone ? "bg-green-500" : "bg-indigo-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {allDone && (
          <p className="text-sm text-green-700 font-medium">
            The system is fully configured. Forecasts and alerts will run automatically each night.
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <Step key={step.number} {...step} />
        ))}
      </div>

      {/* Help footer */}
      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        <p>
          Background jobs (forecasting, reorder checks, carrying cost snapshots) run automatically
          every night. You can also trigger them manually from the{" "}
          <Link href="/forecasts" className="underline hover:text-slate-600">Forecasts</Link>{" "}
          or{" "}
          <Link href="/alerts" className="underline hover:text-slate-600">Alerts</Link>{" "}
          pages.
        </p>
      </div>
    </div>
  );
}
