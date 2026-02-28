"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

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

function dosColor(qty: number): string {
  if (qty === 0) return "bg-red-100 text-red-700 font-semibold";
  if (qty <= 3) return "bg-orange-100 text-orange-700";
  if (qty <= 10) return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

interface Props {
  locations: LocationCol[];
  variants: VariantRow[];
  totalVariants: number;
}

export function InventoryTable({ locations, variants, totalVariants }: Props) {
  const [query, setQuery] = useState("");

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

  // Column totals use filtered rows only
  const colTotals = useMemo(() => {
    return locations.map((loc) => ({
      id: loc.id,
      total: filtered.reduce((sum, v) => sum + (v.levels[loc.id]?.qty ?? 0), 0),
    }));
  }, [filtered, locations]);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by brand, SKU, color…"
          className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {query && (
        <p className="text-xs text-slate-500">
          {filtered.length} of {totalVariants} variant{totalVariants !== 1 ? "s" : ""}
        </p>
      )}

      {/* Scrollable grid */}
      <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="text-xs border-collapse min-w-max">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="sticky left-0 z-10 bg-slate-900 text-left px-4 py-3 font-medium min-w-[200px]">
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
              filtered.map((variant, i) => (
                <tr
                  key={variant.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  {/* Product column — sticky */}
                  <td
                    className={`sticky left-0 z-10 px-4 py-2 border-r border-slate-200 ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50"
                    }`}
                  >
                    <Link href={`/products/${variant.productId}`} className="hover:underline">
                      <div className="font-medium text-slate-800">
                        {variant.brand} — {variant.name}
                      </div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        {variant.sku}
                        {variant.color && (
                          <span className="ml-1 text-slate-300">· {variant.color}</span>
                        )}
                        {variant.size && (
                          <span className="ml-1 text-slate-300">· {variant.size}</span>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Stock cells */}
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
              ))
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
