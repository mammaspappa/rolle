"use client";

import { useState, useTransition } from "react";
import { createProduct } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

type Supplier = { id: string; name: string; currency: string };

const CATEGORIES = ["Handbag", "Watch", "Shoes", "Jewellery", "Accessory", "Ready-to-Wear", "Fragrance"];

interface Props {
  suppliers: Supplier[];
}

export function NewProductForm({ suppliers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [category, setCategory] = useState(CATEGORIES[0]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const data = {
      sku: get("sku"),
      name: get("name"),
      brand: get("brand"),
      category,
      subcategory: get("subcategory") || undefined,
      description: get("description") || undefined,
      supplierId,
      unitCost: parseFloat(get("unitCost")),
      retailPrice: parseFloat(get("retailPrice")),
      currency: "EUR",
      leadTimeDays: parseInt(get("leadTimeDays")),
      reorderPoint: parseInt(get("reorderPoint")),
      safetyStock: parseInt(get("safetyStock")),
    };

    if (!data.sku || !data.name || !data.brand) {
      setError("SKU, name, and brand are required.");
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
        await createProduct(data);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sku">Product SKU *</Label>
              <Input id="sku" name="sku" placeholder="e.g. RLE-BAG-001" required className="font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand *</Label>
              <Input id="brand" name="brand" placeholder="e.g. Maison Lumière" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" name="name" placeholder="e.g. Riviera Tote" required />
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
              <Label htmlFor="subcategory">Subcategory</Label>
              <Input id="subcategory" name="subcategory" placeholder="e.g. Shoulder Bag" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Optional product description..." />
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Supplier */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Pricing & Supplier</h2>
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
              <Label htmlFor="unitCost">Unit Cost (EUR) *</Label>
              <Input id="unitCost" name="unitCost" type="number" min="0.01" step="0.01" placeholder="0.00" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retailPrice">Retail Price (EUR) *</Label>
              <Input id="retailPrice" name="retailPrice" type="number" min="0.01" step="0.01" placeholder="0.00" required />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Replenishment */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Replenishment Parameters</h2>
          <p className="text-xs text-slate-500">These can be auto-calculated by the forecasting engine later. Set initial values manually.</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
              <Input id="leadTimeDays" name="leadTimeDays" type="number" min="1" defaultValue="30" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reorderPoint">Reorder Point (units)</Label>
              <Input id="reorderPoint" name="reorderPoint" type="number" min="0" defaultValue="0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="safetyStock">Safety Stock (units)</Label>
              <Input id="safetyStock" name="safetyStock" type="number" min="0" defaultValue="0" required />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
