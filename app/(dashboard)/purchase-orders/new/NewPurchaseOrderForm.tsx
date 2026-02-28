"use client";

import { useState, useTransition } from "react";
import { createPurchaseOrder, POLineInput } from "@/server/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

type Supplier = { id: string; name: string; currency: string };
type Variant = { id: string; sku: string; color: string | null; size: string | null; product: { name: string; brand: string; unitCost: number; currency: string } };

interface Props {
  suppliers: Supplier[];
  warehouseId: string;
  variants: Variant[];
}

export function NewPurchaseOrderForm({ suppliers, warehouseId, variants }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [lines, setLines] = useState<(POLineInput & { _key: number })[]>([
    { _key: 0, productVariantId: variants[0]?.id ?? "", quantityOrdered: 1, unitCost: Number((variants[0]?.product.unitCost as number) ?? 0), currency: "EUR" },
  ]);
  const [keyCounter, setKeyCounter] = useState(1);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { _key: keyCounter, productVariantId: variants[0]?.id ?? "", quantityOrdered: 1, unitCost: Number((variants[0]?.product.unitCost as number) ?? 0), currency: "EUR" },
    ]);
    setKeyCounter((k) => k + 1);
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l._key !== key));
  }

  function updateLine(key: number, field: keyof POLineInput, value: string | number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        if (field === "productVariantId") {
          const v = variants.find((v) => v.id === value);
          return { ...l, productVariantId: value as string, unitCost: v ? Number(v.product.unitCost) : l.unitCost };
        }
        return { ...l, [field]: value };
      })
    );
  }

  const currency = suppliers.find((s) => s.id === supplierId)?.currency ?? "EUR";
  const totalCost = lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const expectedArrival = (form.elements.namedItem("expectedArrival") as HTMLInputElement).value;
    const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value;

    startTransition(async () => {
      try {
        await createPurchaseOrder({ supplierId, destinationId: warehouseId, expectedArrival: expectedArrival || undefined, currency, notes: notes || undefined, lines });
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
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedArrival">Expected Arrival</Label>
              <Input id="expectedArrival" name="expectedArrival" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Optional notes for supplier…" />
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

        {lines.map((line) => (
          <Card key={line._key}>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-6 space-y-1.5">
                  <Label className="text-xs">Product / Variant</Label>
                  <Select value={line.productVariantId} onValueChange={(v) => updateLine(line._key, "productVariantId", v)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.product.brand} — {v.product.name}
                          {v.color ? ` · ${v.color}` : ""}
                          {v.size ? ` · ${v.size}` : ""}
                          <span className="text-slate-400 ml-1">({v.sku})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min={1} value={line.quantityOrdered} onChange={(e) => updateLine(line._key, "quantityOrdered", parseInt(e.target.value) || 1)} className="text-xs" />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-xs">Unit Cost ({currency})</Label>
                  <Input type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => updateLine(line._key, "unitCost", parseFloat(e.target.value) || 0)} className="text-xs" />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => removeLine(line._key)} disabled={lines.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400 mt-2">
                Subtotal: {currency} {(line.quantityOrdered * line.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="text-right text-sm font-semibold text-slate-700 pr-1">
          Total: {currency} {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending || lines.length === 0}>
          {isPending ? "Creating…" : "Create Purchase Order"}
        </Button>
      </div>
    </form>
  );
}
