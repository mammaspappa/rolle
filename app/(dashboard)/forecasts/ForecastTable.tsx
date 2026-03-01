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

type DosLevel = "critical" | "warning" | "ok" | "none";

function worstDosLevel(forecasts: ForecastRow[]): DosLevel {
  const valid = forecasts
    .map((f) => f.daysOfStock)
    .filter((d): d is number => d !== null);
  if (valid.length === 0) return "none";
  const min = Math.min(...valid);
  if (min < 7) return "critical";
  if (min < 14) return "warning";
  return "ok";
}

function minDosValue(forecasts: ForecastRow[]): number | null {
  const valid = forecasts
    .map((f) => f.daysOfStock)
    .filter((d): d is number => d !== null);
  return valid.length > 0 ? Math.min(...valid) : null;
}

/** Colored dot + minimum DOS value for collapsed summary rows. */
function DosSignal({
  level,
  min,
}: {
  level: DosLevel;
  min: number | null;
}) {
  if (level === "none") return <span className="text-slate-300">—</span>;

  const cfg = {
    critical: {
      dot: "bg-red-500",
      text: "text-red-600 font-semibold",
      title: "At least one location has fewer than 7 days of stock",
    },
    warning: {
      dot: "bg-amber-400",
      text: "text-amber-600 font-semibold",
      title: "At least one location has fewer than 14 days of stock",
    },
    ok: {
      dot: "bg-green-500",
      text: "text-green-600",
      title: "All locations have 14+ days of stock",
    },
  }[level];

  return (
    <span
      className="inline-flex items-center justify-end gap-1.5"
      title={cfg.title}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      {min !== null && (
        <span className={`text-xs ${cfg.text}`}>{min}d</span>
      )}
    </span>
  );
}

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

function dosRowColor(dos: number | null): string {
  if (dos === null) return "text-slate-400";
  if (dos < 7)  return "text-red-600 font-semibold";
  if (dos < 14) return "text-amber-600 font-semibold";
  return "text-green-600";
}

/** Most common method across rows; "Mixed" on a tie. */
function dominantMethod(forecasts: ForecastRow[]): string {
  const counts = new Map<string, number>();
  for (const f of forecasts)
    counts.set(f.forecastMethod, (counts.get(f.forecastMethod) ?? 0) + 1);
  let best = "";
  let bestCount = 0;
  for (const [m, c] of counts) {
    if (c > bestCount) { best = m; bestCount = c; }
  }
  return [...counts.values()].filter((c) => c === bestCount).length > 1
    ? "Mixed"
    : best;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  variants: ForecastVariantRow[];
  locationId?: string;
}

export function ForecastTable({ variants, locationId }: Props) {
  // Level 1 — product groups (start all expanded)
  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(
    new Set()
  );

  // Level 2 — variant location rows (start all collapsed so you drill in)
  const [collapsedVariants, setCollapsedVariants] = useState<Set<string>>(
    () => new Set(variants.map((v) => v.variantId))
  );

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { productId: string; brand: string; name: string; variants: ForecastVariantRow[] }
    >();
    for (const v of variants) {
      if (!map.has(v.productId))
        map.set(v.productId, { productId: v.productId, brand: v.brand, name: v.productName, variants: [] });
      map.get(v.productId)!.variants.push(v);
    }
    return Array.from(map.values());
  }, [variants]);

  const allProductIds = useMemo(() => groups.map((g) => g.productId), [groups]);
  const allCollapsed =
    allProductIds.length > 0 && collapsedProducts.size === allProductIds.length;

  function toggleProduct(id: string) {
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleVariant(id: string) {
    setCollapsedVariants((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCollapsedProducts(allCollapsed ? new Set() : new Set(allProductIds));
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
              <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-28">Days Stock</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-20">Method</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">Period</th>
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => {
              const isProductCollapsed = collapsedProducts.has(group.productId);
              const isSingle = group.variants.length === 1;

              // Aggregates for the product group header
              const allGroupForecasts = group.variants.flatMap((v) => v.forecasts);
              const groupTotalDemand = allGroupForecasts.reduce(
                (s, f) => s + f.forecastedDemand,
                0
              );
              const groupDosLevel = worstDosLevel(allGroupForecasts);
              const groupMinDos = minDosValue(allGroupForecasts);
              const groupMethod = dominantMethod(allGroupForecasts);
              const firstPeriod = allGroupForecasts[0]?.periodStart;

              return (
                <Fragment key={group.productId}>
                  {/* ── Level 1: Product group header (skip for single-variant) ── */}
                  {!isSingle && (
                    <tr
                      className="bg-slate-100 border-y border-slate-200 cursor-pointer select-none hover:bg-slate-200 transition-colors"
                      onClick={() => toggleProduct(group.productId)}
                    >
                      {/* Label + chevron */}
                      <td className="px-3 py-2" colSpan={2}>
                        <div className="flex items-center gap-2">
                          {isProductCollapsed
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
                      {/* Total demand */}
                      <td className="px-4 py-2 text-right">
                        <span className="font-semibold text-slate-700">
                          {groupTotalDemand.toFixed(1)}
                        </span>
                        <span className="text-slate-400 ml-1 text-xs">u</span>
                      </td>
                      {/* Daily avg — not meaningful at group level */}
                      <td className="px-4 py-2" />
                      {/* DOS signal */}
                      <td className="px-4 py-2 text-right">
                        <DosSignal level={groupDosLevel} min={groupMinDos} />
                      </td>
                      {/* Method */}
                      <td className="px-4 py-2 text-center">
                        {groupMethod === "Mixed"
                          ? <span className="text-xs text-slate-400 italic">Mixed</span>
                          : <MethodBadge method={groupMethod} />}
                      </td>
                      {/* Period */}
                      <td className="px-4 py-2 text-xs text-slate-400">
                        {firstPeriod
                          ? `${format(new Date(firstPeriod), "MMM d")} – ${format(addDays(new Date(firstPeriod), 6), "d")}`
                          : "—"}
                      </td>
                    </tr>
                  )}

                  {/* ── Level 2: Variant headers + location rows ── */}
                  {(!isProductCollapsed || isSingle) &&
                    group.variants.map((v) => {
                      const isVariantCollapsed = collapsedVariants.has(v.variantId);
                      const variantTotalDemand = v.forecasts.reduce(
                        (s, f) => s + f.forecastedDemand,
                        0
                      );
                      const variantDosLevel = worstDosLevel(v.forecasts);
                      const variantMinDos = minDosValue(v.forecasts);
                      const variantMethod = dominantMethod(v.forecasts);
                      const variantPeriod = v.forecasts[0]?.periodStart;
                      const attrs = [v.color, v.size].filter(Boolean).join(" · ");

                      return (
                        <Fragment key={v.variantId}>
                          {/* Variant header row */}
                          <tr
                            className="bg-slate-50 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                            onClick={() => toggleVariant(v.variantId)}
                          >
                            {/* Variant label */}
                            <td className={`py-2 ${isSingle ? "px-4" : "pl-8 pr-4"}`}>
                              <div className="flex items-center gap-2">
                                {isVariantCollapsed
                                  ? <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                  : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
                                <div>
                                  {isSingle ? (
                                    <>
                                      <div className="font-medium text-slate-800 text-xs">
                                        {v.brand} — {v.productName}
                                      </div>
                                      <div className="font-mono text-slate-400 text-xs mt-0.5">
                                        {v.sku}{attrs && ` · ${attrs}`}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="font-mono text-slate-600 text-xs">
                                      {v.sku}{attrs && (
                                        <span className="text-slate-400"> · {attrs}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Location count */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-slate-500">
                                {v.forecasts.length} loc{v.forecasts.length !== 1 ? "s" : ""}
                              </span>
                            </td>
                            {/* Total demand for this variant */}
                            <td className="px-4 py-2 text-right">
                              <span className="font-medium text-slate-700 text-xs">
                                {variantTotalDemand.toFixed(1)}
                              </span>
                              <span className="text-slate-400 ml-1 text-xs">u</span>
                            </td>
                            {/* Daily avg — not meaningful across locations */}
                            <td className="px-4 py-2" />
                            {/* DOS signal */}
                            <td className="px-4 py-2 text-right">
                              <DosSignal level={variantDosLevel} min={variantMinDos} />
                            </td>
                            {/* Method */}
                            <td className="px-4 py-2 text-center">
                              {variantMethod === "Mixed"
                                ? <span className="text-xs text-slate-400 italic">Mixed</span>
                                : <MethodBadge method={variantMethod} />}
                            </td>
                            {/* Period */}
                            <td className="px-4 py-2 text-xs text-slate-400">
                              {variantPeriod
                                ? `${format(new Date(variantPeriod), "MMM d")} – ${format(addDays(new Date(variantPeriod), 6), "d")}`
                                : "—"}
                            </td>
                          </tr>

                          {/* Location rows — shown when variant is expanded */}
                          {!isVariantCollapsed &&
                            v.forecasts.map((f, fi) => {
                              const dailyAvg = f.forecastedDemand / 7;
                              return (
                                <tr
                                  key={f.locationCode}
                                  className={`border-b border-slate-100 last:border-0 ${
                                    fi % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                  }`}
                                >
                                  {/* Empty variant column (label in header above) */}
                                  <td className={isSingle ? "px-8 py-2" : "pl-12 pr-4 py-2"} />
                                  {/* Location code */}
                                  <td className="px-4 py-2">
                                    <span className="text-xs font-mono text-slate-600">
                                      {f.locationCode}
                                    </span>
                                  </td>
                                  {/* Next-week demand */}
                                  <td className="px-4 py-2 text-right">
                                    <span className="font-semibold text-slate-800 text-xs">
                                      {f.forecastedDemand.toFixed(1)}
                                    </span>
                                    <span className="text-slate-400 ml-1 text-xs">u</span>
                                  </td>
                                  {/* Daily avg */}
                                  <td className="px-4 py-2 text-right text-slate-600 text-xs">
                                    {dailyAvg.toFixed(2)}
                                  </td>
                                  {/* DOS (individual row — raw value with colour) */}
                                  <td className="px-4 py-2 text-right">
                                    {f.daysOfStock !== null ? (
                                      <span className={`text-xs font-medium ${dosRowColor(f.daysOfStock)}`}>
                                        {f.daysOfStock}d
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 text-xs">—</span>
                                    )}
                                  </td>
                                  {/* Method */}
                                  <td className="px-4 py-2 text-center">
                                    <MethodBadge method={f.forecastMethod} />
                                  </td>
                                  {/* Period */}
                                  <td className="px-4 py-2 text-xs text-slate-400">
                                    {format(new Date(f.periodStart), "MMM d")} –{" "}
                                    {format(addDays(new Date(f.periodStart), 6), "d")}
                                  </td>
                                </tr>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
