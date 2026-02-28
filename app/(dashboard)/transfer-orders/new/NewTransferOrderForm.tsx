"use client";

import { useState, useTransition } from "react";
import { createTransferOrder, TOLineInput } from "@/server/actions/transfer-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

type Location = { id: string; code: string; name: string; type: string };
type Variant = {
  id: string; sku: string; color: string | null; size: string | null;
  product: { name: string; brand: string; unitCost: unknown };
  inventoryLevels: { locationId: string; quantityOnHand: number; quantityReserved: number }[];
};

interface Props { locations: Location[]; variants: Variant[] }

export function NewTransferOrderForm({ locations, variants }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fromId, setFromId] = useState(locations.find((l) => l.type === "WAREHOUSE")?.id ?? locations[0]?.id ?? "");
  const [toId, setToId] = useState(locations.find((l) => l.type === "STORE")?.id ?? "");
  const [lines, setLines] = useState<(TOLineInput & { _key: number })[]>([
    { _key: 0, productVariantId: variants[0]?.id ?? "", quantityRequested: 1, unitCost: Number(variants[0]?.product.unitCost ?? 0) },
  ]);
  const [keyCounter, setKeyCounter] = useState(1);

  function getAvailableQty(variantId: string, locationId: string) {
    const v = variants.find((v) => v.id === variantId);
    const level = v?.inventoryLevels.find((l) => l.locationId === locationId);
    if (!level) return 0;
    return Math.max(0, level.quantityOnHand - level.quantityReserved);
  }

  function addLine() {
    setLines((prev) => [...prev, { _key: keyCounter, productVariantId: variants[0]?.id ?? "", quantityRequested: 1, unitCost: Number(variants[0]?.product.unitCost ?? 0) }]);
    setKeyCounter((k) => k + 1);
  }

  function updateLine(key: number, field: keyof TOLineInput, value: string | number) {
    setLines((prev) => prev.map((l) => {
      if (l._key !== key) return l;
      if (field === "productVariantId") {
        const v = variants.find((v) => v.id === value);
        return { ...l, productVariantId: value as string, unitCost: v ? Number(v.product.unitCost) : l.unitCost };
      }
      return { ...l, [field]: value };
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const expectedArrival = (form.elements.namedItem("expectedArrival") as HTMLInputElement).value;
    const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value;

    startTransition(async () => {
      try {
        await createTransferOrder({ fromLocationId: fromId, toLocationId: toId, expectedArrival: expectedArrival || undefined, notes: notes || undefined, lines });
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From Location</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id} disabled={l.id === toId}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Location</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id} disabled={l.id === fromId}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expectedArrival">Expected Arrival</Label>
              <Input id="expectedArrival" name="expectedArrival" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Optional notes…" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700">Line Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </Button>
        </div>

        {lines.map((line) => {
          const available = getAvailableQty(line.productVariantId, fromId);
          return (
            <Card key={line._key}>
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-7 space-y-1.5">
                    <Label className="text-xs">Product / Variant</Label>
                    <Select value={line.productVariantId} onValueChange={(v) => updateLine(line._key, "productVariantId", v)}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {variants.map((v) => {
                          const avail = getAvailableQty(v.id, fromId);
                          return (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              {v.product.brand} — {v.product.name}
                              {v.color ? ` · ${v.color}` : ""}{v.size ? ` · ${v.size}` : ""}
                              <span className={`ml-1 ${avail === 0 ? "text-red-400" : "text-slate-400"}`}>({avail} avail)</span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {available === 0 && (
                      <p className="text-xs text-red-500">No available stock at source location</p>
                    )}
                  </div>
                  <div className="col-span-3 space-y-1.5">
                    <Label className="text-xs">Qty (max {available})</Label>
                    <Input type="number" min={1} max={available} value={line.quantityRequested}
                      onChange={(e) => updateLine(line._key, "quantityRequested", Math.min(available, parseInt(e.target.value) || 1))}
                      className="text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => setLines((p) => p.filter((l) => l._key !== line._key))} disabled={lines.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create Transfer Order"}
      </Button>
    </form>
  );
}
