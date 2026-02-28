"use client";

import { useState, useTransition } from "react";
import { adjustStock } from "@/server/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";

type Location = { id: string; code: string; name: string };
type Variant = { id: string; sku: string; color: string | null; size: string | null; product: { name: string; brand: string; unitCost: unknown } };

export function AdjustmentForm({ locations, variants }: { locations: Location[]; variants: Variant[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [delta, setDelta] = useState<number>(0);
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(false);
    if (delta === 0) { setError("Delta cannot be zero."); return; }
    if (!notes.trim()) { setError("Please add a note explaining the adjustment."); return; }

    const selectedVariant = variants.find((v) => v.id === variantId);
    const unitCost = selectedVariant ? Number(selectedVariant.product.unitCost) : 0;

    startTransition(async () => {
      try {
        await adjustStock({ productVariantId: variantId, locationId, quantityDelta: delta, unitCost, notes });
        setSuccess(true);
        setDelta(0);
        setNotes("");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product / Variant</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.product.brand} — {v.product.name}
                    {v.color ? ` · ${v.color}` : ""}{v.size ? ` · ${v.size}` : ""}
                    <span className="text-slate-400 ml-1 text-xs">({v.sku})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delta">Quantity Change</Label>
            <div className="flex items-center gap-3">
              <Input
                id="delta" type="number" value={delta}
                onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
                className="w-36"
                placeholder="e.g. +5 or -2"
              />
              <span className={`text-sm font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                {delta > 0 ? `+${delta} units added` : delta < 0 ? `${delta} units removed` : "No change"}
              </span>
            </div>
            <p className="text-xs text-slate-400">Positive = add stock. Negative = remove stock.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Reason (required)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Physical count correction, damaged item write-off, opening balance…" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              <CheckCircle className="w-4 h-4" /> Adjustment recorded successfully.
            </div>
          )}

          <Button type="submit" disabled={isPending || delta === 0}>
            {isPending ? "Saving…" : "Record Adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
