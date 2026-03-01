"use client";

import { Fragment, useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import {
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  TrendingUp,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

export type ForecastRow = {
  locationCode: string;
  forecastedDemand: number;
  forecastMethod: string;
  periodStart: string; // ISO string
  daysOfStock: number | null;
};

export type ForecastVariantRow = {
  variantId: string;
  productId: string;
  brand: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  forecasts: ForecastRow[];
};

// ── helpers ───────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; className: string }> = {
    MOVING_AVG_12W: { label: "WMA",      className: "bg-blue-50 text-blue-700 border-blue-200" },
    EXP_SMOOTH:     { label: "EXP",      className: "bg-purple-50 text-purple-700 border-purple-200" },
    MANUAL:         { label: "Manual",   className: "bg-amber-50 text-amber-700 border-amber-200" },
    HOLT_WINTERS:   { label: "H-W",      className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    CROSTON_SBC:    { label: "Croston",  className: "bg-rose-50 text-rose-700 border-rose-200" },
    ENSEMBLE:       { label: "Ensemble", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const cfg = map[method] ?? { label: method, className: "" };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function dosColor(dos: number | null): string {
  if (dos === null) return "text-slate-400";
  if (dos < 7)  return "text-red-600 font-semibold";
  if (dos < 14) return "text-amber-600 font-semibold";
  return "text-green-600";
}

/** Most common method across a list of forecast rows, or "Mixed" if tied. */
function dominantMethod(rows: ForecastRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.forecastMethod, (counts.get(r.forecastMethod) ?? 0) + 1);
  let best = "";
  let bestCount = 0;
  for (const [method, count] of counts) {
    if (count > bestCount) { best = method; bestCount = count; }
  }
  const leaders = [...counts.entries()].filter(([, c]) => c === bestCount);
  return leaders.length > 1 ? "Mixed" : best;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  variants: ForecastVariantRow[];
  locationId?: string; // undefined = all locations mode
}

export function ForecastTable({ variants, locationId }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Group variants by productId
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { productId: string; brand: string; name: string; variants: ForecastVariantRow[] }
    >();
    for (const v of variants) {
      if (!map.has(v.productId)) {
        map.set(v.productId, {
          productId: v.productId,
          brand: v.brand,
          name: v.productName,
          variants: [],
        });
      }
      map.get(v.productId)!.variants.push(v);
    }
    return Array.from(map.values());
  }, [variants]);

  const allProductIds = useMemo(() => groups.map((g) => g.productId), [groups]);
  const allCollapsed = allProductIds.length > 0 && collapsed.size === allProductIds.length;

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(allProductIds));
  }

  const isLocationFiltered = Boolean(locationId);
  const totalForecasts = variants.reduce((s, v) => s + v.forecasts.length, 0);

  if (totalForecasts === 0) {
    return (
      <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-lg">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No forecasts yet</p>
        <p className="text-sm mt-1">
          Click &ldquo;Run Forecasts&rdquo; to generate demand predictions,
          or import sales data first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md bg-white transition-colors"
        >
          {allCollapsed
            ? <ChevronsUpDown className="w-3.5 h-3.5" />
            : <ChevronsDownUp className="w-3.5 h-3.5" />}
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
        <span className="text-xs text-slate-500 ml-auto">
          {groups.length} product{groups.length !== 1 ? "s" : ""}
          {" · "}
          {variants.length} variant{variants.length !== 1 ? "s" : ""}
          {" · "}
          {totalForecasts} forecast{totalForecasts !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Variant</th>
              {isLocationFiltered ? (
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-24">Location</th>
              ) : (
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-32">Locations</th>
              )}
              <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-28">Next Week</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Daily Avg</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Days Stock</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-20">Method</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">Period</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.productId);
              const isSingle = group.variants.length === 1;

              // Group header aggregates
              const allForecasts = group.variants.flatMap((v) => v.forecasts);
              const groupTotalDemand = allForecasts.reduce(
                (s, f) => s + f.forecastedDemand,
                0
              );
              const method = dominantMethod(allForecasts);
              const firstPeriod = allForecasts[0]?.periodStart;

              return (
                <Fragment key={group.productId}>
                  {/* Product group header — skip for single-variant products */}
                  {!isSingle && (
                    <tr
                      className="bg-slate-100 border-y border-slate-200 cursor-pointer select-none hover:bg-slate-200 transition-colors"
                      onClick={() => toggleGroup(group.productId)}
                    >
                      <td className="px-3 py-2" colSpan={2}>
                        <div className="flex items-center gap-2">
                          {isCollapsed
                            ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span className="font-semibold text-slate-700">
                            {group.brand} — {group.name}
                          </span>
                          <span className="text-xs text-slate-400 font-normal">
                            ({group.variants.length} variants)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-semibold text-slate-700">
                          {groupTotalDemand.toFixed(1)}
                        </span>
                        <span className="text-slate-400 ml-1 text-xs">u total</span>
                      </td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-center">
                        {method === "Mixed"
                          ? <span className="text-xs text-slate-400 italic">Mixed</span>
                          : <MethodBadge method={method} />}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400">
                        {firstPeriod
                          ? `${format(new Date(firstPeriod), "MMM d")} – ${format(addDays(new Date(firstPeriod), 6), "d")}`
                          : "—"}
                      </td>
                    </tr>
                  )}

                  {/* Variant × location rows */}
                  {(!isCollapsed || isSingle) &&
                    group.variants.flatMap((v, vi) =>
                      v.forecasts.map((f, fi) => {
                        const rowIndex = vi * 100 + fi; // stable stripe key
                        const dailyAvg = f.forecastedDemand / 7;

                        return (
                          <tr
                            key={`${v.variantId}-${f.locationCode}`}
                            className={`border-b border-slate-100 last:border-0 ${
                              rowIndex % 2 === 0 ? "" : "bg-slate-50/40"
                            }`}
                          >
                            {/* Variant column — show full info only on first forecast row */}
                            <td className="px-4 py-2.5">
                              {fi === 0 && (
                                <>
                                  <div
                                    className={`font-medium text-slate-800 text-xs ${
                                      !isSingle ? "pl-4" : ""
                                    }`}
                                  >
                                    {isSingle
                                      ? `${v.brand} — ${v.productName}`
                                      : v.sku}
                                  </div>
                                  <div
                                    className={`text-xs text-slate-400 font-mono ${
                                      !isSingle ? "pl-4" : ""
                                    }`}
                                  >
                                    {isSingle
                                      ? `${v.sku}${v.color ? ` · ${v.color}` : ""}${v.size ? ` · ${v.size}` : ""}`
                                      : [v.color, v.size].filter(Boolean).join(" · ")}
                                  </div>
                                </>
                              )}
                            </td>

                            {/* Location */}
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-mono text-slate-600">
                                {f.locationCode}
                              </span>
                            </td>

                            {/* Next-week demand */}
                            <td className="px-4 py-2.5 text-right">
                              <span className="font-semibold text-slate-800">
                                {f.forecastedDemand.toFixed(1)}
                              </span>
                              <span className="text-slate-400 ml-1">u</span>
                            </td>

                            {/* Daily avg */}
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {dailyAvg.toFixed(2)}
                            </td>

                            {/* Days of stock */}
                            <td className="px-4 py-2.5 text-right">
                              {f.daysOfStock !== null ? (
                                <span className={`font-medium ${dosColor(f.daysOfStock)}`}>
                                  {f.daysOfStock}d
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Method */}
                            <td className="px-4 py-2.5 text-center">
                              <MethodBadge method={f.forecastMethod} />
                            </td>

                            {/* Period */}
                            <td className="px-4 py-2.5 text-xs text-slate-400">
                              {format(new Date(f.periodStart), "MMM d")} –{" "}
                              {format(addDays(new Date(f.periodStart), 6), "d")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
