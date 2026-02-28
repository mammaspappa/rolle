"use client";

import { useState, useTransition } from "react";
import { applyPhysicalCount } from "@/server/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertTriangle } from "lucide-react";

type VariantRow = {
  productVariantId: string;
  sku: string;
  productName: string;
  brand: string;
  color: string | null;
  size: string | null;
  currentQty: number;
  lastCountedAt: Date | null;
};

interface Props {
  locationId: string;
  locationName: string;
  variants: VariantRow[];
}

export function CountForm({ locationId, locationName, variants }: Props) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(variants.map((v) => [v.productVariantId, String(v.currentQty)]))
  );
  const [result, setResult] = useState<{ corrected: number; unchanged: number } | null>(null);
  const [error, setError] = useState("");

  const changes = variants.filter((v) => {
    const val = parseInt(counts[v.productVariantId] ?? "");
    return !isNaN(val) && val !== v.currentQty;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    const countList = variants
      .map((v) => ({
        productVariantId: v.productVariantId,
        actualQty: parseInt(counts[v.productVariantId] ?? String(v.currentQty)),
      }))
      .filter((c) => !isNaN(c.actualQty) && c.actualQty >= 0);

    startTransition(async () => {
      try {
        const res = await applyPhysicalCount({
          locationId,
          counts: countList,
          notes: notes || undefined,
        });
        setResult(res);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
        <span>{variants.length} variants at {locationName}</span>
        {changes.length > 0 && (
          <span className="text-amber-600 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {changes.length} discrepanc{changes.length === 1 ? "y" : "ies"} detected
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Product / SKU</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-28">System Qty</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-32">Actual Count</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-24">Diff</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-28">Last Counted</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => {
              const actualStr = counts[v.productVariantId] ?? "";
              const actual = parseInt(actualStr);
              const diff = isNaN(actual) ? null : actual - v.currentQty;
              const isDiff = diff !== null && diff !== 0;

              return (
                <tr
                  key={v.productVariantId}
                  className={`border-b border-slate-100 last:border-0 ${
                    isDiff ? "bg-amber-50" : i % 2 === 0 ? "" : "bg-slate-50/50"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800 text-xs">
                      {v.brand} — {v.productName}
                      {v.color && <span className="text-slate-400 ml-1">· {v.color}</span>}
                      {v.size && <span className="text-slate-400 ml-1">· {v.size}</span>}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{v.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {v.currentQty}
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min="0"
                      value={actualStr}
                      onChange={(e) =>
                        setCounts((prev) => ({ ...prev, [v.productVariantId]: e.target.value }))
                      }
                      className={`h-7 text-center text-sm font-mono w-full ${
                        isDiff ? "border-amber-400 bg-amber-50 focus:border-amber-500" : ""
                      }`}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono font-medium">
                    {diff === null ? (
                      <span className="text-slate-300">—</span>
                    ) : diff === 0 ? (
                      <span className="text-slate-300">0</span>
                    ) : diff > 0 ? (
                      <span className="text-green-600">+{diff}</span>
                    ) : (
                      <span className="text-red-600">{diff}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {v.lastCountedAt
                      ? new Date(v.lastCountedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes + submit */}
      <div className="space-y-1.5 max-w-lg">
        <Label htmlFor="notes">Count Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Q1 full stocktake — all items physically verified"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {result && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Count applied: <strong>{result.corrected}</strong> correction{result.corrected !== 1 ? "s" : ""} made,{" "}
          <strong>{result.unchanged}</strong> unchanged.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Applying…" : `Apply Count${changes.length > 0 ? ` (${changes.length} corrections)` : ""}`}
        </Button>
        <p className="text-xs text-slate-400">
          Only variants with changed quantities will create correction movements.
        </p>
      </div>
    </form>
  );
}
