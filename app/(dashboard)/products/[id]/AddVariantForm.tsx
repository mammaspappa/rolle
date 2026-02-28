"use client";

import { useState, useTransition } from "react";
import { createProductVariant } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface Props {
  productId: string;
  productSku: string;
  unitCost: number;
}

export function AddVariantForm({ productId, productSku, unitCost }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const sku = get("variantSku");
    const size = get("size") || undefined;
    const color = get("color") || undefined;
    const costStr = get("variantCost");
    const variantCost = costStr ? parseFloat(costStr) : undefined;

    if (!sku) {
      setError("Variant SKU is required.");
      return;
    }

    startTransition(async () => {
      try {
        await createProductVariant({ productId, sku, size, color, unitCost: variantCost });
        setOpen(false);
        form.reset();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-3.5 h-3.5" /> Add Variant
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
      <p className="text-sm font-medium text-slate-700">New Variant</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="variantSku" className="text-xs">Variant SKU *</Label>
          <Input
            id="variantSku"
            name="variantSku"
            placeholder={`${productSku}-BLK-M`}
            className="font-mono uppercase text-sm h-8"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color" className="text-xs">Color</Label>
          <Input id="color" name="color" placeholder="e.g. Black" className="text-sm h-8" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="size" className="text-xs">Size</Label>
          <Input id="size" name="size" placeholder="e.g. M, 38, 42" className="text-sm h-8" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="variantCost" className="text-xs">Unit Cost Override (EUR)</Label>
          <Input
            id="variantCost"
            name="variantCost"
            type="number"
            min="0.01"
            step="0.01"
            placeholder={`${unitCost} (inherited)`}
            className="text-sm h-8"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Stock rows (qty=0) will be automatically created at all 21 locations.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating..." : "Create Variant"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setOpen(false); setError(""); }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
