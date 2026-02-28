"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, GitFork, Zap, TrendingUp } from "lucide-react";
import type { AllocationProposal, StoreNeed } from "@/server/services/allocation.service";

interface VariantOption {
  id: string;
  sku: string;
  productName: string;
  brand: string;
  color: string | null;
  size: string | null;
}

interface Props {
  variantsNeedingAllocation: {
    id: string;
    sku: string;
    productName: string;
    storesBelow: number;
  }[];
  allVariants: VariantOption[];
  warehouseId: string;
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    A: "bg-purple-50 text-purple-700 border-purple-200",
    B: "bg-blue-50 text-blue-700 border-blue-200",
    C: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${map[tier] ?? ""}`}>
      {tier}
    </span>
  );
}

export function AllocationClient({
  variantsNeedingAllocation,
  allVariants,
  warehouseId,
}: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variantsNeedingAllocation[0]?.id ?? ""
  );
  const [proposal, setProposal] = useState<AllocationProposal | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [isCreating, startCreating] = useTransition();
  const [createResult, setCreateResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);

  function loadProposal() {
    if (!selectedVariantId) return;
    setProposal(null);
    setAdjustments({});
    setCreateResult(null);
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/allocation/propose?variantId=${selectedVariantId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to compute proposal");
        setProposal(data);
        // Pre-populate adjustments from suggestion
        const adj: Record<string, number> = {};
        for (const s of data.stores) {
          adj[s.locationId] = s.suggestedQty;
        }
        setAdjustments(adj);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function createTransferOrders() {
    if (!proposal) return;
    const lines = proposal.stores
      .map((s) => ({ locationId: s.locationId, qty: adjustments[s.locationId] ?? 0 }))
      .filter((l) => l.qty > 0);

    if (lines.length === 0) {
      setError("No allocations to create — all quantities are zero.");
      return;
    }

    setError("");
    startCreating(async () => {
      try {
        const res = await fetch("/api/allocation/create-transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productVariantId: proposal.productVariantId,
            warehouseId,
            lines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create transfers");
        setCreateResult(data);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const totalAllocated = Object.values(adjustments).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-6">
      {/* Variants needing allocation */}
      {variantsNeedingAllocation.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {variantsNeedingAllocation.length} variant{variantsNeedingAllocation.length !== 1 ? "s" : ""} have
              stores below safety stock with available warehouse stock
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {variantsNeedingAllocation.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVariantId(v.id);
                  setProposal(null);
                  setAdjustments({});
                  setCreateResult(null);
                }}
                className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                  selectedVariantId === v.id
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-amber-800 border-amber-300 hover:bg-amber-100"
                }`}
              >
                <span className="font-mono">{v.sku}</span>
                <span className="ml-1.5 opacity-75">({v.storesBelow} stores)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Variant selector + generate button */}
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-sm space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Select Variant
          </label>
          <select
            value={selectedVariantId}
            onChange={(e) => {
              setSelectedVariantId(e.target.value);
              setProposal(null);
              setAdjustments({});
              setCreateResult(null);
            }}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">— choose a variant —</option>
            {allVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} — {v.brand} {v.productName}
                {v.color ? ` · ${v.color}` : ""}
                {v.size ? ` · ${v.size}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={loadProposal}
          disabled={!selectedVariantId || isPending}
          className="gap-1.5"
        >
          <Zap className="w-4 h-4" />
          {isPending ? "Computing…" : "Generate Proposal"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {createResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Created {createResult.created} draft transfer order{createResult.created !== 1 ? "s" : ""}.
          Review and approve them in Transfer Orders.
        </div>
      )}

      {/* Proposal */}
      {proposal && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
            <div>
              <span className="text-slate-500">Warehouse available:</span>{" "}
              <span className="font-semibold text-slate-800">{proposal.warehouseAvailable} units</span>
            </div>
            <div>
              <span className="text-slate-500">Total requested:</span>{" "}
              <span className="font-semibold text-slate-800">{proposal.totalRequested} units</span>
            </div>
            <div>
              <span className="text-slate-500">Allocated:</span>{" "}
              <span
                className={`font-semibold ${
                  totalAllocated > proposal.warehouseAvailable
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {totalAllocated} units
              </span>
            </div>
            {!proposal.fullyFulfilled && (
              <span className="flex items-center gap-1 text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Insufficient stock — partial allocation
              </span>
            )}
            {proposal.fullyFulfilled && (
              <span className="flex items-center gap-1 text-green-700 text-xs bg-green-50 border border-green-200 rounded px-2 py-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Full fulfillment possible
              </span>
            )}
          </div>

          {/* Store table */}
          {proposal.stores.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No stores need allocation for this variant right now.
            </p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Store</th>
                    <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-16">Tier</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Available</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Safety Stock</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Days of Stock</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500 w-24">Score</th>
                    <th className="text-center px-4 py-2.5 font-medium text-slate-500 w-28">Allocate</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.stores.map((store, i) => {
                    const qty = adjustments[store.locationId] ?? 0;
                    const overStock =
                      totalAllocated > proposal.warehouseAvailable;

                    return (
                      <tr
                        key={store.locationId}
                        className={`border-b border-slate-100 last:border-0 ${
                          store.belowSafety
                            ? "bg-red-50/40"
                            : i % 2 === 0
                            ? ""
                            : "bg-slate-50/40"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-800 text-xs">
                            {store.locationName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {store.locationCode}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <TierBadge tier={store.revenueTier} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          <span
                            className={
                              store.belowSafety ? "text-red-600 font-semibold" : "text-slate-700"
                            }
                          >
                            {store.quantityAvailable}
                          </span>
                          {store.belowSafety && (
                            <span className="ml-1 text-xs text-red-500">↓ safety</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                          {store.safetyStock}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`font-medium ${
                              store.daysOfStock < 7
                                ? "text-red-600"
                                : store.daysOfStock < 14
                                ? "text-amber-600"
                                : "text-green-600"
                            }`}
                          >
                            {store.daysOfStock > 900
                              ? "∞"
                              : `${Math.round(store.daysOfStock)}d`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">
                          {store.score.toFixed(0)}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max={proposal.warehouseAvailable}
                            value={qty}
                            onChange={(e) => {
                              const v = Math.max(0, parseInt(e.target.value) || 0);
                              setAdjustments((prev) => ({ ...prev, [store.locationId]: v }));
                            }}
                            className={`h-7 w-full text-center text-sm font-mono border rounded px-1 focus:outline-none focus:ring-1 ${
                              overStock
                                ? "border-red-300 bg-red-50 focus:ring-red-300"
                                : "border-slate-300 bg-white focus:ring-slate-400"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          {proposal.stores.length > 0 && (
            <div className="flex items-center gap-3">
              <Button
                onClick={createTransferOrders}
                disabled={
                  isCreating ||
                  totalAllocated === 0 ||
                  totalAllocated > proposal.warehouseAvailable
                }
                className="gap-1.5"
              >
                <GitFork className="w-4 h-4" />
                {isCreating
                  ? "Creating…"
                  : `Create ${
                      proposal.stores.filter(
                        (s) => (adjustments[s.locationId] ?? 0) > 0
                      ).length
                    } Draft Transfer Order${
                      proposal.stores.filter(
                        (s) => (adjustments[s.locationId] ?? 0) > 0
                      ).length !== 1
                        ? "s"
                        : ""
                    }`}
              </Button>
              {totalAllocated > proposal.warehouseAvailable && (
                <span className="text-xs text-red-600">
                  Allocated ({totalAllocated}) exceeds available ({proposal.warehouseAvailable}).
                  Reduce quantities.
                </span>
              )}
              <p className="text-xs text-slate-400">
                Transfer orders will be created in REQUESTED status for warehouse review.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
