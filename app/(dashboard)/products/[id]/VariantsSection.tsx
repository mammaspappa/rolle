"use client";

import { Fragment, useState, useTransition } from "react";
import { updateProductVariant } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { AddVariantForm } from "./AddVariantForm";

export type SerializedVariant = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  unitCost: number | null;
  totalUnits: number;
  levels: Array<{
    locationCode: string;
    locationName: string;
    locationType: string;
    locationCity: string;
    quantityOnHand: number;
    quantityInTransit: number;
  }>;
};

interface Props {
  productId: string;
  productSku: string;
  defaultUnitCost: number;
  variants: SerializedVariant[];
}

function StockCell({ qty, inTransit }: { qty: number; inTransit: number }) {
  const color =
    qty === 0
      ? "text-red-600 font-semibold"
      : qty <= 3
      ? "text-orange-600"
      : "text-slate-700";
  return (
    <span className={color}>
      {qty}
      {inTransit > 0 && (
        <span className="text-slate-400 ml-1">(+{inTransit} incoming)</span>
      )}
    </span>
  );
}

function StockSignal({ variant }: { variant: SerializedVariant }) {
  const hasStockout = variant.levels.some((l) => l.quantityOnHand === 0);
  const hasLow =
    !hasStockout && variant.levels.some((l) => l.quantityOnHand > 0 && l.quantityOnHand <= 3);
  if (hasStockout)
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" title="Stockout at one or more locations" />;
  if (hasLow)
    return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Low stock at one or more locations" />;
  return null;
}

function EditVariantForm({
  variant,
  productId,
  onClose,
}: {
  variant: SerializedVariant;
  productId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement).value;

    const costStr = get("unitCost");
    const unitCost = costStr ? parseFloat(costStr) : null;

    startTransition(async () => {
      try {
        await updateProductVariant(variant.id, productId, {
          color: get("color") || undefined,
          size: get("size") || undefined,
          unitCost,
        });
        onClose();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">Edit Variant</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`ev-color-${variant.id}`} className="text-xs">Color</Label>
          <Input
            id={`ev-color-${variant.id}`}
            name="color"
            defaultValue={variant.color ?? ""}
            placeholder="e.g. Black"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ev-size-${variant.id}`} className="text-xs">Size</Label>
          <Input
            id={`ev-size-${variant.id}`}
            name="size"
            defaultValue={variant.size ?? ""}
            placeholder="e.g. M, 38"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ev-cost-${variant.id}`} className="text-xs">Unit Cost Override (EUR)</Label>
          <Input
            id={`ev-cost-${variant.id}`}
            name="unitCost"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={variant.unitCost ?? ""}
            placeholder="(inherited)"
            className="h-7 text-xs"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function VariantsSection({
  productId,
  productSku,
  defaultUnitCost,
  variants,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(variants.map((v) => v.id))
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const allCollapsed = collapsed.size === variants.length;

  function toggleVariant(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allCollapsed) setCollapsed(new Set());
    else setCollapsed(new Set(variants.map((v) => v.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Variants & Stock Levels</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <AddVariantForm
            productId={productId}
            productSku={productSku}
            unitCost={defaultUnitCost}
          />
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
        {variants.map((variant) => {
          const isCollapsed = collapsed.has(variant.id);
          const isEditing = editingId === variant.id;
          const warehouse = variant.levels.find((l) => l.locationType === "WAREHOUSE");
          const stores = variant.levels.filter((l) => l.locationType === "STORE");

          return (
            <Fragment key={variant.id}>
              {/* Header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer select-none"
                onClick={() => toggleVariant(variant.id)}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <StockSignal variant={variant} />
                <span className="font-mono text-sm font-semibold text-slate-800">
                  {variant.sku}
                </span>
                {variant.color && (
                  <span className="text-sm text-slate-500">{variant.color}</span>
                )}
                {variant.size && (
                  <span className="text-sm text-slate-500">Size {variant.size}</span>
                )}
                <span className="ml-auto text-sm font-semibold text-slate-700">
                  {variant.totalUnits} units
                </span>
              </div>

              {/* Expanded content */}
              {!isCollapsed && (
                <div className="px-4 pb-4 bg-white">
                  <div className="flex items-center justify-end pt-2 pb-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : variant.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                    >
                      <Pencil className="w-3 h-3" />
                      {isEditing ? "Cancel edit" : "Edit variant"}
                    </button>
                  </div>

                  {isEditing && (
                    <EditVariantForm
                      variant={variant}
                      productId={productId}
                      onClose={() => setEditingId(null)}
                    />
                  )}

                  <table className="w-full text-xs mt-2">
                    <tbody>
                      {warehouse && (
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 font-medium text-slate-600 w-1/2">
                            🏭 {warehouse.locationName}
                          </td>
                          <td className="py-1.5 text-right">
                            <StockCell
                              qty={warehouse.quantityOnHand}
                              inTransit={warehouse.quantityInTransit}
                            />
                          </td>
                        </tr>
                      )}
                      {stores.map((level) => (
                        <tr key={level.locationCode} className="border-b border-slate-50">
                          <td className="py-1 text-slate-600">
                            {level.locationName}
                            <span className="text-slate-400 ml-1">({level.locationCity})</span>
                          </td>
                          <td className="py-1 text-right">
                            <StockCell
                              qty={level.quantityOnHand}
                              inTransit={level.quantityInTransit}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {variants.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">
          No variants yet. Add one above.
        </p>
      )}
    </div>
  );
}
