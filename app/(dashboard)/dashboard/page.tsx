import { db } from "@/server/db";
import { getKPISummary, getInventoryHealthBands, getSalesvsForecastTrend } from "@/server/services/kpi.service";
import { getInventoryValueByLocation } from "@/server/services/cost-snapshot.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryHealthChart } from "@/components/charts/InventoryHealthChart";
import { SalesForecastChart } from "@/components/charts/SalesForecastChart";
import { InventoryValueChart } from "@/components/charts/InventoryValueChart";
import { DashboardJobButtons } from "./DashboardJobButtons";
import Link from "next/link";
import {
  Warehouse,
  Package,
  Bell,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Activity,
  Percent,
  Sparkles,
} from "lucide-react";

// ── data ─────────────────────────────────────────────────────────────────────

async function getDashboardData() {
  const [
    locationCount,
    productCount,
    variantCount,
    alertSummary,
    lowStockCount,
    recentAlerts,
    kpis,
    healthBands,
    salesTrend,
    valueByLocation,
    movementCount,
  ] = await Promise.all([
    db.location.count({ where: { isActive: true } }),
    db.product.count({ where: { isActive: true } }),
    db.productVariant.count({ where: { isActive: true } }),
    db.alert.groupBy({
      by: ["severity"],
      where: { isResolved: false },
      _count: true,
    }),
    db.inventoryLevel.count({ where: { quantityOnHand: 0 } }),
    db.alert.findMany({
      where: { isResolved: false },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        type: true,
        severity: true,
        message: true,
        location: { select: { code: true } },
      },
    }),
    getKPISummary(),
    getInventoryHealthBands(),
    getSalesvsForecastTrend(12),
    getInventoryValueByLocation(),
    db.stockMovement.count(),
  ]);

  const criticalAlerts = alertSummary.find((a) => a.severity === "CRITICAL")?._count ?? 0;
  const warningAlerts = alertSummary.find((a) => a.severity === "WARNING")?._count ?? 0;
  const totalAlerts = alertSummary.reduce((sum, a) => sum + a._count, 0);

  // Show setup banner when there are no products or no stock movements yet
  const showSetupBanner = productCount === 0 || movementCount === 0;

  return {
    locationCount, productCount, variantCount,
    criticalAlerts, warningAlerts, totalAlerts,
    lowStockCount, recentAlerts, kpis, healthBands, salesTrend, valueByLocation,
    showSetupBanner,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 1) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n.toFixed(0)}`;
}

const severityColor: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  WARNING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  INFO: "bg-blue-100 text-blue-700 border-blue-200",
};

const alertTypeLabel: Record<string, string> = {
  LOW_STOCK: "Low Stock",
  STOCKOUT: "Stockout",
  OVERSTOCK: "Overstock",
  REORDER_TRIGGERED: "Reorder",
  DELAYED_SHIPMENT: "Delayed Shipment",
  TRANSFER_OVERDUE: "Transfer Overdue",
};

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const d = await getDashboardData();

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {d.locationCount} locations · {d.variantCount} variants
          </p>
        </div>
        <DashboardJobButtons />
      </div>

      {/* Setup banner — only shown when system is not yet configured */}
      {d.showSetupBanner && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardContent className="pt-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">
                  Welcome to Rolle — finish setting up your system
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  {d.productCount === 0
                    ? "No products added yet. Follow the setup guide to get started."
                    : "Stock movements not recorded yet. Add initial inventory to activate KPIs."}
                </p>
              </div>
            </div>
            <Link href="/setup">
              <button className="shrink-0 text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
                Open setup guide →
              </button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* KPI row 1 — operational */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Fill Rate</CardTitle>
            <Percent className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${d.kpis.fillRate < 95 ? "text-amber-600" : "text-green-600"}`}>
              {fmt(d.kpis.fillRate)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">target ≥ 95% · last 90 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Avg Days of Stock</CardTitle>
            <Activity className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              d.kpis.avgDaysOfStock > 0 && d.kpis.avgDaysOfStock < 7
                ? "text-red-600"
                : d.kpis.avgDaysOfStock < 14
                ? "text-amber-600"
                : "text-slate-800"
            }`}>
              {d.kpis.avgDaysOfStock > 0 ? fmt(d.kpis.avgDaysOfStock, 0) + "d" : "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1">avg across active store lines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Inventory Turnover</CardTitle>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {d.kpis.inventoryTurnover > 0 ? fmt(d.kpis.inventoryTurnover) + "×" : "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1">12-month rolling COGS / value</p>
          </CardContent>
        </Card>

        <Card className={d.kpis.overstockRatio > 20 ? "border-purple-200" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Overstock Ratio</CardTitle>
            <TrendingDown className={`w-4 h-4 ${d.kpis.overstockRatio > 20 ? "text-purple-500" : "text-slate-400"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${d.kpis.overstockRatio > 20 ? "text-purple-600" : ""}`}>
              {fmt(d.kpis.overstockRatio)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">qty with &gt;90d of stock</p>
          </CardContent>
        </Card>
      </div>

      {/* KPI row 2 — financial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Inventory Value</CardTitle>
            <Warehouse className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtCurrency(d.kpis.totalInventoryValue)}</div>
            <p className="text-xs text-slate-500 mt-1">at cost, all locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Daily Carry Cost</CardTitle>
            <Activity className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {d.kpis.totalCarryingCostToday > 0 ? fmtCurrency(d.kpis.totalCarryingCostToday) : "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1">from last cost snapshot</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">GMROI</CardTitle>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {d.kpis.gmroi > 0 ? fmt(d.kpis.gmroi) + "×" : "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1">gross margin / avg inventory cost</p>
          </CardContent>
        </Card>

        <Card className={d.criticalAlerts > 0 ? "border-red-200" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Open Alerts</CardTitle>
            <Bell className={`w-4 h-4 ${d.criticalAlerts > 0 ? "text-red-500" : "text-slate-400"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${d.criticalAlerts > 0 ? "text-red-600" : ""}`}>
              {d.totalAlerts}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {d.criticalAlerts} critical · {d.warningAlerts} warnings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Inventory Health — Days of Stock Bands
              <span className="text-xs font-normal text-slate-400">store lines</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryHealthChart data={d.healthBands} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {d.healthBands.map((b) => (
                <span key={b.band} className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: b.colour }} />
                  {b.label}: {b.count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Sales vs Forecast — Last 12 Weeks
              <Link href="/inventory/sales-import" className="text-xs font-normal text-slate-400 hover:text-slate-600">
                Import sales →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SalesForecastChart data={d.salesTrend} />
          </CardContent>
        </Card>
      </div>

      {/* Inventory value by location + recent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Inventory Value by Location
              <span className="text-xs font-normal text-slate-400">top 10 · at cost</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryValueChart
              data={d.valueByLocation.map((v) => ({
                locationCode: v.locationCode,
                totalValue: v.totalValue,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Recent Alerts
              </CardTitle>
              <Link href="/alerts" className="text-xs text-slate-500 hover:text-slate-700">
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {d.recentAlerts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No open alerts — all clear.</p>
            ) : (
              <ul className="space-y-2">
                {d.recentAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 shrink-0 text-xs font-medium px-1.5 py-0.5 rounded border ${severityColor[alert.severity]}`}>
                      {alertTypeLabel[alert.type] ?? alert.type}
                    </span>
                    <span className="text-slate-700 leading-tight line-clamp-2">{alert.message}</span>
                    {alert.location && (
                      <span className="ml-auto shrink-0 text-xs text-slate-400">{alert.location.code}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stockout banner */}
      {d.lowStockCount > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-orange-900">
                  {d.lowStockCount} variant × location lines at zero stock
                </p>
                <p className="text-xs text-orange-600 mt-0.5">These represent potential lost sales</p>
              </div>
            </div>
            <Link href="/inventory" className="text-sm text-orange-700 underline underline-offset-2">
              View inventory →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
