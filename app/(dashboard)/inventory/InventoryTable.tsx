"use client";

import { Fragment, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";

export type LocationCol = {
  id: string;
  code: string;
  city: string;
  name: string;
};

export type VariantRow = {
  id: string;
  productId: string;
  sku: string;
  color: string | null;
  size: string | null;
  brand: string;
  name: string;
  category: string;
  // locationId → {qty, inTransit}
  levels: Record<string, { qty: number; inTransit: number }>;
};

type GroupBy = "product" | "brand" | "category";

function dosColor(qty: number): string {
  if (qty === 0) return "bg-red-100 text-red-700 font-semibold";
  if (qty <= 3) return "bg-orange-100 text-orange-700";
  if (qty <= 10) return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

function variantAttrs(v: VariantRow): string {
  return [v.color, v.size].filter(Boolean).join(" · ");
}

function renderVariantCell(v: VariantRow, groupBy: GroupBy, isSingle: boolean) {
  const href = `/products/${v.productId}`;
  const attrs = variantAttrs(v);

  if (isSingle || groupBy === "category") {
    return (
      <Link href={href} className="hover:underline">
        <div className="font-medium text-slate-800">
          {v.brand} — {v.name}
        </div>
        <div className="font-mono text-slate-400 mt-0.5">
          {v.sku}
          {attrs && <span className="ml-1">· {attrs}</span>}
        </div>
      </Link>
    );
  }

  if (groupBy === "brand") {
    return (
      <Link href={href} className="hover:underline">
        <div className="font-medium text-slate-800">{v.name}</div>
        <div className="font-mono text-slate-400 mt-0.5">
          {v.sku}
          {attrs && <span className="ml-1">· {attrs}</span>}
        </div>
      </Link>
    );
  }

  // groupBy === "product": brand + name shown in header row
  return (
    <Link href={href} className="hover:underline">
      <div className="font-mono text-slate-500">{v.sku}</div>
      {attrs && <div className="text-slate-400 mt-0.5">{attrs}</div>}
    </Link>
  );
}

interface Props {
  locations: LocationCol[];
  variants: VariantRow[];
  totalVariants: number;
}

export function InventoryTable({ locations, variants, totalVariants }: Props) {
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("product");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter(
      (v) =>
        v.sku.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        (v.color?.toLowerCase() ?? "").includes(q) ||
        (v.size?.toLowerCase() ?? "").includes(q)
    );
  }, [query, variants]);

  const groups = useMemo(() => {
    const keyOf = (v: VariantRow) =>
      groupBy === "brand" ? v.brand :
      groupBy === "category" ? v.category :
      v.productId;

    const labelOf = (v: VariantRow) =>
      groupBy === "brand" ? v.brand :
      groupBy === "category" ? v.category :
      `${v.brand} — ${v.name}`;

    const map = new Map<string, { key: string; label: string; rows: VariantRow[] }>();
    for (const v of filtered) {
      const key = keyOf(v);
      if (!map.has(key)) map.set(key, { key, label: labelOf(v), rows: [] });
      map.get(key)!.rows.push(v);
    }
    return Array.from(map.values());
  }, [filtered, groupBy]);

  // Column totals across ALL filtered rows (regardless of collapse state)
  const colTotals = useMemo(
    () =>
      locations.map((loc) => ({
        id: loc.id,
        total: filtered.reduce((sum, v) => sum + (v.levels[loc.id]?.qty ?? 0), 0),
      })),
    [filtered, locations]
  );

  const allKeys = useMemo(() => groups.map((g) => g.key), [groups]);
  const allCollapsed = allKeys.length > 0 && collapsed.size === allKeys.length;

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(allKeys));
  }

  function handleSearch(value: string) {
    setQuery(value);
    setCollapsed(new Set()); // expand all when searching so matches are visible
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Filter by brand, SKU, color…"
            className="pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 w-56"
          />
          {query && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Group-by toggle */}
        <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden">
          <span className="px-2.5 text-xs text-slate-400 border-r border-slate-200 py-1.5 select-none">
            Group
          </span>
          {(["product", "brand", "category"] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => {
                setGroupBy(g);
                setCollapsed(new Set());
              }}
              className={`px-2.5 py-1.5 text-xs transition-colors border-r border-slate-200 last:border-0 ${
                groupBy === g
                  ? "bg-slate-800 text-white font-medium"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {/* Collapse / expand all */}
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md bg-white transition-colors"
        >
          {allCollapsed
            ? <ChevronsUpDown className="w-3.5 h-3.5" />
            : <ChevronsDownUp className="w-3.5 h-3.5" />}
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>

        {/* Counts */}
        <span className="text-xs text-slate-500 ml-auto">
          {groups.length} group{groups.length !== 1 ? "s" : ""}
          {" · "}
          {filtered.length}
          {query ? ` of ${totalVariants}` : ""}{" "}
          variant{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="text-xs border-collapse min-w-max">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="sticky left-0 z-10 bg-slate-900 text-left px-4 py-3 font-medium min-w-[220px]">
                Product / SKU
              </th>
              {locations.map((loc) => (
                <th
                  key={loc.id}
                  className="px-2 py-3 font-medium text-center min-w-[64px] whitespace-nowrap"
                  title={loc.name}
                >
                  <div>{loc.code.replace("STORE-", "").replace("WH-", "")}</div>
                  <div className="text-slate-400 font-normal text-xs">{loc.city}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={locations.length + 1}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No variants match &ldquo;{query}&rdquo;
                </td>
              </tr>
            ) : (
              groups.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                const isSingle = group.rows.length === 1;

                // Per-location subtotals for the group header
                const subtotals = locations.map((loc) => ({
                  id: loc.id,
                  total: group.rows.reduce(
                    (sum, v) => sum + (v.levels[loc.id]?.qty ?? 0),
                    0
                  ),
                }));

                // Worst stock signal across all variants × locations in this group
                const hasStockout = group.rows.some((v) =>
                  Object.values(v.levels).some((l) => l.qty === 0)
                );
                const hasLow = !hasStockout && group.rows.some((v) =>
                  Object.values(v.levels).some((l) => l.qty > 0 && l.qty <= 3)
                );
                const signalDot = hasStockout
                  ? <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="At least one variant is stocked out at some location" />
                  : hasLow
                  ? <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="At least one variant has ≤3 units at some location" />
                  : null;

                return (
                  <Fragment key={group.key}>
                    {/* Group header — skipped for single-variant groups */}
                    {!isSingle && (
                      <tr
                        className="bg-slate-100 border-y border-slate-300 cursor-pointer select-none hover:bg-slate-200 transition-colors"
                        onClick={() => toggleGroup(group.key)}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            {isCollapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <span className="font-semibold text-slate-700">{group.label}</span>
                            <span className="text-xs text-slate-400 font-normal">
                              ({group.rows.length} variants)
                            </span>
                            {signalDot}
                          </div>
                        </td>
                        {subtotals.map((col) => (
                          <td
                            key={col.id}
                            className={`px-1 py-2 text-center border-r border-slate-200 font-medium ${
                              col.total === 0 ? "bg-red-50 text-red-600" :
                              col.total <= 3  ? "bg-orange-50 text-orange-700" :
                              "text-slate-500"
                            }`}
                          >
                            {col.total > 0
                              ? col.total
                              : <span className="text-red-400 font-semibold">0</span>}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Variant rows — hidden when group is collapsed */}
                    {(!isCollapsed || isSingle) &&
                      group.rows.map((variant, i) => {
                        const stripe = isSingle
                          ? i % 2 === 0 ? "bg-white" : "bg-slate-50"
                          : "bg-white";
                        const indentClass = !isSingle ? "pl-8" : "px-4";

                        return (
                          <tr key={variant.id} className={`${stripe} hover:bg-blue-50/30`}>
                            <td
                              className={`sticky left-0 z-10 ${stripe} ${indentClass} pr-4 py-2 border-r border-slate-200`}
                            >
                              {renderVariantCell(variant, groupBy, isSingle)}
                            </td>
                            {locations.map((loc) => {
                              const level = variant.levels[loc.id];
                              const qty = level?.qty ?? 0;
                              const inTransit = level?.inTransit ?? 0;
                              return (
                                <td
                                  key={loc.id}
                                  className="px-1 py-2 text-center border-r border-slate-100"
                                >
                                  <span
                                    className={`inline-block w-full rounded px-1 py-0.5 text-center ${dosColor(qty)}`}
                                  >
                                    {qty}
                                  </span>
                                  {inTransit > 0 && (
                                    <div className="text-slate-400 mt-0.5">+{inTransit}</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })
            )}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
              <td className="sticky left-0 z-10 bg-slate-100 px-4 py-2 text-slate-700 border-r border-slate-200">
                Total units on hand
                {query && (
                  <span className="ml-1 text-slate-400 font-normal text-xs">(filtered)</span>
                )}
              </td>
              {colTotals.map((col) => (
                <td
                  key={col.id}
                  className="px-1 py-2 text-center text-slate-700 border-r border-slate-100"
                >
                  {col.total}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
