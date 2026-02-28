import { db } from "@/server/db";
import { format, addDays } from "date-fns";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ChevronRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ForecastControls } from "./ForecastControls";

// ── data ─────────────────────────────────────────────────────────────────────

async function getForecastSummary(locationFilter?: string) {
  // Get all variants with at least one forecast
  const variants = await db.productVariant.findMany({
    where: { isActive: true },
    include: {
      product: {
        select: {
          name: true,
          brand: true,
          safetyStock: true,
          reorderPoint: true,
        },
      },
      demandForecasts: {
        where: locationFilter
          ? { locationId: locationFilter }
          : undefined,
        orderBy: { periodStart: "desc" },
        take: locationFilter ? 1 : 21, // latest per variant (or per location)
        include: {
          location: { select: { code: true, type: true } },
        },
      },
      inventoryLevels: {
        where: locationFilter
          ? { locationId: locationFilter }
          : { location: { type: "STORE" } },
        include: {
          location: { select: { code: true } },
        },
        take: locationFilter ? 1 : undefined,
      },
    },
    orderBy: [{ product: { brand: "asc" } }, { sku: "asc" }],
  });

  return variants.filter((v) => v.demandForecasts.length > 0);
}

async function getLocations() {
  return db.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "desc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });
}

// ── components ────────────────────────────────────────────────────────────────

function DemandTrend({ current, previous }: { current: number; previous?: number }) {
  if (!previous || previous === 0) return <Minus className="w-4 h-4 text-slate-300" />;
  const pct = ((current - previous) / previous) * 100;
  if (pct > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (pct < -5) return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-slate-300" />;
}

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; className: string }> = {
    MOVING_AVG_12W: { label: "WMA",     className: "bg-blue-50 text-blue-700 border-blue-200" },
    EXP_SMOOTH:     { label: "EXP",     className: "bg-purple-50 text-purple-700 border-purple-200" },
    MANUAL:         { label: "Manual",  className: "bg-amber-50 text-amber-700 border-amber-200" },
    HOLT_WINTERS:   { label: "H-W",     className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    CROSTON_SBC:    { label: "Croston", className: "bg-rose-50 text-rose-700 border-rose-200" },
    ENSEMBLE:       { label: "Ensemble",className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const cfg = map[method] ?? { label: method, className: "" };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ForecastsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const { locationId } = await searchParams;
  const [locations, variants] = await Promise.all([
    getLocations(),
    getForecastSummary(locationId),
  ]);

  const selectedLocation = locations.find((l) => l.id === locationId);
  const totalForecasts = variants.reduce((s, v) => s + v.demandForecasts.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Demand Forecasts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Weekly demand predictions per SKU per store. Run nightly or trigger manually.
          </p>
        </div>
        <ForecastControls />
      </div>

      {/* Location filter */}
      <div className="flex flex-wrap gap-2">
        <a href="/forecasts">
          <Button
            variant={!locationId ? "default" : "outline"}
            size="sm"
            className="text-xs"
          >
            All Locations
          </Button>
        </a>
        {locations
          .filter((l) => l.type === "STORE")
          .map((loc) => (
            <a key={loc.id} href={`/forecasts?locationId=${loc.id}`}>
              <Button
                variant={loc.id === locationId ? "default" : "outline"}
                size="sm"
                className="text-xs"
              >
                {loc.code}
              </Button>
            </a>
          ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Forecasts</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{totalForecasts}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Variants</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{variants.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {selectedLocation ? selectedLocation.code : "Locations Covered"}
          </p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">
            {selectedLocation
              ? variants.filter((v) => v.demandForecasts.length > 0).length
              : locations.filter((l) => l.type === "STORE").length}
          </p>
        </div>
      </div>

      {/* Forecast table */}
      {totalForecasts === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-lg">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No forecasts yet</p>
          <p className="text-sm mt-1">
            Click &ldquo;Run Forecasts&rdquo; to generate demand predictions,
            or import sales data first.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Variant</th>
                {locationId ? (
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-24">Location</th>
                ) : (
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-32">Locations</th>
                )}
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-28">Next Week</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Daily Avg</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Safety Stock</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-20">Method</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">Period</th>
              </tr>
            </thead>
            <tbody>
              {variants.flatMap((v) =>
                v.demandForecasts.map((f, i) => {
                  const forecastedDemand = Number(f.forecastedDemand);
                  const dailyAvg = forecastedDemand / 7;
                  const inventoryLevel = v.inventoryLevels.find(
                    (il) => il.location.code === f.location.code
                  );
                  const qtyAvail = inventoryLevel
                    ? inventoryLevel.quantityOnHand - inventoryLevel.quantityReserved
                    : null;
                  const daysOfStock =
                    qtyAvail !== null && dailyAvg > 0
                      ? Math.round(qtyAvail / dailyAvg)
                      : null;

                  return (
                    <tr
                      key={`${v.id}-${f.location.code}`}
                      className={`border-b border-slate-100 last:border-0 ${
                        i % 2 === 0 ? "" : "bg-slate-50/40"
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {i === 0 && (
                          <>
                            <div className="font-medium text-slate-800 text-xs">
                              {v.product.brand} — {v.product.name}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {v.sku}
                              {v.color && ` · ${v.color}`}
                              {v.size && ` · ${v.size}`}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono text-slate-600">
                          {f.location.code}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-semibold text-slate-800">
                          {forecastedDemand.toFixed(1)}
                        </span>
                        <span className="text-slate-400 ml-1">u</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {dailyAvg.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {daysOfStock !== null ? (
                          <span
                            className={`font-medium ${
                              daysOfStock < 7
                                ? "text-red-600"
                                : daysOfStock < 14
                                ? "text-amber-600"
                                : "text-green-600"
                            }`}
                          >
                            {daysOfStock}d
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <MethodBadge method={f.forecastMethod} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">
                        {format(new Date(f.periodStart), "MMM d")} –{" "}
                        {format(addDays(new Date(f.periodStart), 6), "d")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-400">
        <span>Days of stock colour: <span className="text-red-500 font-medium">&lt;7d critical</span> · <span className="text-amber-500 font-medium">&lt;14d warning</span> · <span className="text-green-600 font-medium">≥14d ok</span></span>
        <span>Methods: <span className="text-blue-600 font-medium">WMA</span> = 12-week weighted avg · <span className="text-indigo-600 font-medium">H-W</span> = Holt-Winters seasonal · <span className="text-rose-600 font-medium">Croston</span> = intermittent demand · <span className="text-emerald-600 font-medium">Ensemble</span> = MAPE-weighted combination · <span className="text-amber-600 font-medium">Manual</span> = user override</span>
      </div>
    </div>
  );
}
