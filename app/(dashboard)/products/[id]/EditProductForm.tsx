"use client";

import { useState, useTransition } from "react";
import { updateProduct } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, X } from "lucide-react";

const CATEGORIES = [
  "Handbag",
  "Watch",
  "Shoes",
  "Jewellery",
  "Accessory",
  "Ready-to-Wear",
  "Fragrance",
];

type Supplier = { id: string; name: string; currency: string };

interface Props {
  productId: string;
  defaultValues: {
    name: string;
    brand: string;
    category: string;
    subcategory: string | null;
    description: string | null;
    supplierId: string;
    unitCost: number;
    retailPrice: number;
    leadTimeDays: number;
    reorderPoint: number;
    safetyStock: number;
  };
  suppliers: Supplier[];
}

export function EditProductForm({ productId, defaultValues, suppliers }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [category, setCategory] = useState(defaultValues.category);
  const [supplierId, setSupplierId] = useState(defaultValues.supplierId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement).value;

    const data = {
      name: get("name"),
      brand: get("brand"),
      category,
      subcategory: get("subcategory") || undefined,
      description: get("description") || undefined,
      supplierId,
      unitCost: parseFloat(get("unitCost")),
      retailPrice: parseFloat(get("retailPrice")),
      leadTimeDays: parseInt(get("leadTimeDays")),
      reorderPoint: parseInt(get("reorderPoint")),
      safetyStock: parseInt(get("safetyStock")),
    };

    if (!data.name || !data.brand) {
      setError("Name and brand are required.");
      return;
    }
    if (isNaN(data.unitCost) || data.unitCost <= 0) {
      setError("Unit cost must be a positive number.");
      return;
    }
    if (isNaN(data.retailPrice) || data.retailPrice <= 0) {
      setError("Retail price must be a positive number.");
      return;
    }

    startTransition(async () => {
      try {
        await updateProduct(productId, data);
        setSuccess(true);
        setOpen(false);
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
        <Pencil className="w-3.5 h-3.5" /> Edit Product
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Edit Product</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); setSuccess(false); }}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ep-brand">Brand *</Label>
              <Input id="ep-brand" name="brand" defaultValue={defaultValues.brand} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-name">Product Name *</Label>
              <Input id="ep-name" name="name" defaultValue={defaultValues.name} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-subcategory">Subcategory</Label>
              <Input id="ep-subcategory" name="subcategory" defaultValue={defaultValues.subcategory ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-description">Description</Label>
            <Textarea id="ep-description" name="description" rows={2} defaultValue={defaultValues.description ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing & Supplier</h2>
          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ep-unitCost">Unit Cost (EUR) *</Label>
              <Input id="ep-unitCost" name="unitCost" type="number" min="0.01" step="0.01" defaultValue={defaultValues.unitCost} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-retailPrice">Retail Price (EUR) *</Label>
              <Input id="ep-retailPrice" name="retailPrice" type="number" min="0.01" step="0.01" defaultValue={defaultValues.retailPrice} required />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Replenishment Parameters</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ep-leadTimeDays">Lead Time (days)</Label>
              <Input id="ep-leadTimeDays" name="leadTimeDays" type="number" min="1" defaultValue={defaultValues.leadTimeDays} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-reorderPoint">Reorder Point (units)</Label>
              <Input id="ep-reorderPoint" name="reorderPoint" type="number" min="0" defaultValue={defaultValues.reorderPoint} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-safetyStock">Safety Stock (units)</Label>
              <Input id="ep-safetyStock" name="safetyStock" type="number" min="0" defaultValue={defaultValues.safetyStock} required />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">Saved.</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setOpen(false); setError(""); setSuccess(false); }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
