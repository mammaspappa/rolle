"use client";

import { useState, useTransition } from "react";
import { receivePOLines } from "@/server/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

interface Line { id: string; sku: string; name: string; ordered: number; received: number }

export function ReceiveForm({ poId, lines }: { poId: string; lines: Line[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.id, Math.max(0, l.ordered - l.received)]))
  );
  const [error, setError] = useState("");

  function handleReceive() {
    setError("");
    const receipts = lines
      .map((l) => ({ lineId: l.id, quantityReceiving: quantities[l.id] ?? 0 }))
      .filter((r) => r.quantityReceiving > 0);

    if (receipts.length === 0) { setError("Enter at least one quantity to receive."); return; }

    startTransition(async () => {
      try {
        await receivePOLines(poId, receipts);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200">
            <th className="text-left pb-2 font-medium">Product</th>
            <th className="text-right pb-2 font-medium">Remaining</th>
            <th className="text-right pb-2 font-medium w-28">Receiving Now</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const remaining = line.ordered - line.received;
            if (remaining <= 0) return null;
            return (
              <tr key={line.id} className="border-b border-slate-50">
                <td className="py-2">
                  <div className="font-medium text-slate-800 text-xs">{line.name}</div>
                  <div className="text-slate-400 text-xs">{line.sku}</div>
                </td>
                <td className="py-2 text-right text-slate-500">{remaining}</td>
                <td className="py-2 text-right">
                  <Input
                    type="number" min={0} max={remaining}
                    value={quantities[line.id] ?? 0}
                    onChange={(e) => setQuantities((q) => ({ ...q, [line.id]: Math.min(remaining, parseInt(e.target.value) || 0) }))}
                    className="w-24 text-right text-xs ml-auto"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button size="sm" onClick={handleReceive} disabled={isPending}>
        {isPending ? "Recording…" : "Confirm Receipt"}
      </Button>
    </div>
  );
}
