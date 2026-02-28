"use client";

import { useState, useTransition } from "react";
import { createSupplier, updateSupplier } from "@/server/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CNY", "HKD", "SGD", "AED"];

type SupplierData = {
  id: string;
  name: string;
  country: string;
  currency: string;
  defaultLeadDays: number;
  contactEmail: string | null;
  contactPhone: string | null;
};

interface Props {
  mode: "create" | "edit";
  supplier?: SupplierData;
}

export function SupplierDialog({ mode, supplier }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const data = {
      name: get("name"),
      country: get("country"),
      currency: get("currency"),
      defaultLeadDays: parseInt(get("defaultLeadDays")),
      contactEmail: get("contactEmail") || undefined,
      contactPhone: get("contactPhone") || undefined,
    };

    if (!data.name || !data.country || !data.currency) {
      setError("Name, country, and currency are required.");
      return;
    }
    if (isNaN(data.defaultLeadDays) || data.defaultLeadDays < 1) {
      setError("Lead time must be at least 1 day.");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createSupplier(data);
        } else if (supplier) {
          await updateSupplier(supplier.id, data);
        }
        setOpen(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const trigger =
    mode === "create" ? (
      <Button size="sm" className="gap-1.5">
        <Plus className="w-4 h-4" /> New Supplier
      </Button>
    ) : (
      <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500">
        <Pencil className="w-3.5 h-3.5" />
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Supplier" : "Edit Supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Supplier Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={supplier?.name}
              placeholder="e.g. Atelier Riviera SAS"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                name="country"
                defaultValue={supplier?.country}
                placeholder="e.g. France"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency *</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={supplier?.currency ?? "EUR"}
                placeholder="EUR"
                list="currency-list"
                maxLength={3}
                className="uppercase"
                required
              />
              <datalist id="currency-list">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultLeadDays">Default Lead Time (days)</Label>
            <Input
              id="defaultLeadDays"
              name="defaultLeadDays"
              type="number"
              min="1"
              defaultValue={supplier?.defaultLeadDays ?? 30}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={supplier?.contactEmail ?? ""}
                placeholder="buyer@supplier.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                defaultValue={supplier?.contactPhone ?? ""}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "create" ? "Create Supplier" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
