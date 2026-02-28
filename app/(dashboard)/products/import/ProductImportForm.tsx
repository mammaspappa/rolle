"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, CheckCircle, AlertTriangle, Download } from "lucide-react";

interface ParsedRow {
  product_sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  supplier_name: string;
  unit_cost: number;
  retail_price: number;
  currency: string;
  lead_time_days: number;
  variant_sku: string;
  size: string;
  color: string;
  _row: number;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

const REQUIRED_COLS = [
  "product_sku",
  "name",
  "brand",
  "category",
  "supplier_name",
  "unit_cost",
  "retail_price",
  "variant_sku",
] as const;

export function ProductImportForm() {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setResult(null);

    const text = await file.text();
    try {
      const parsed = parseCSV(text);
      setRows(parsed);
    } catch (err) {
      setParseError((err as Error).message);
      setRows([]);
    }
  }

  function parseCSV(text: string): ParsedRow[] {
    const lines = text
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());

    for (const col of REQUIRED_COLS) {
      if (!header.includes(col)) throw new Error(`Missing required column: ${col}`);
    }

    const idx = {
      product_sku: header.indexOf("product_sku"),
      name: header.indexOf("name"),
      brand: header.indexOf("brand"),
      category: header.indexOf("category"),
      subcategory: header.indexOf("subcategory"),
      supplier_name: header.indexOf("supplier_name"),
      unit_cost: header.indexOf("unit_cost"),
      retail_price: header.indexOf("retail_price"),
      currency: header.indexOf("currency"),
      lead_time_days: header.indexOf("lead_time_days"),
      variant_sku: header.indexOf("variant_sku"),
      size: header.indexOf("size"),
      color: header.indexOf("color"),
    };

    return lines.slice(1).map((line, i) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const rowNum = i + 2;

      const unit_cost = parseFloat(cols[idx.unit_cost]);
      if (isNaN(unit_cost)) throw new Error(`Row ${rowNum}: unit_cost "${cols[idx.unit_cost]}" is not a number.`);

      const retail_price = parseFloat(cols[idx.retail_price]);
      if (isNaN(retail_price)) throw new Error(`Row ${rowNum}: retail_price "${cols[idx.retail_price]}" is not a number.`);

      const lead_time_days_raw = idx.lead_time_days >= 0 ? parseInt(cols[idx.lead_time_days]) : 30;
      const lead_time_days = isNaN(lead_time_days_raw) ? 30 : lead_time_days_raw;

      return {
        product_sku: (cols[idx.product_sku] ?? "").toUpperCase(),
        name: cols[idx.name] ?? "",
        brand: cols[idx.brand] ?? "",
        category: cols[idx.category] ?? "",
        subcategory: idx.subcategory >= 0 ? (cols[idx.subcategory] ?? "") : "",
        supplier_name: cols[idx.supplier_name] ?? "",
        unit_cost,
        retail_price,
        currency: idx.currency >= 0 ? (cols[idx.currency] ?? "EUR") : "EUR",
        lead_time_days,
        variant_sku: (cols[idx.variant_sku] ?? "").toUpperCase(),
        size: idx.size >= 0 ? (cols[idx.size] ?? "") : "",
        color: idx.color >= 0 ? (cols[idx.color] ?? "") : "",
        _row: rowNum,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return;
    setResult(null);

    startTransition(async () => {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "Import failed");
      } else {
        setResult(data);
        setRows([]);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  // Count unique products and variants for preview summary
  const uniqueProducts = new Set(rows.map((r) => r.product_sku)).size;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Format guide */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">CSV Format</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Each row is one variant. Product fields are repeated per variant.
                Required:{" "}
                {REQUIRED_COLS.map((c, i) => (
                  <span key={c}>
                    <code className="bg-slate-100 px-1 rounded">{c}</code>
                    {i < REQUIRED_COLS.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
            <a href="/api/products/import-template" download>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Template
              </Button>
            </a>
          </div>
          <div className="bg-slate-50 rounded border border-slate-200 p-3 font-mono text-xs text-slate-600 overflow-x-auto whitespace-pre">
            {`product_sku,name,brand,category,subcategory,supplier_name,unit_cost,retail_price,currency,lead_time_days,variant_sku,size,color
RLE-BAG-001,Quilted Flap Bag,Chanel,Handbag,Evening,Maison Chanel,3800,8500,EUR,45,RLE-BAG-001-BLK,,Black
RLE-BAG-001,Quilted Flap Bag,Chanel,Handbag,Evening,Maison Chanel,3800,8500,EUR,45,RLE-BAG-001-BGE,,Beige`}
          </div>
          <p className="text-xs text-slate-400">
            Tip: supplier_name must match an existing supplier exactly (case-insensitive).
            Existing products/variants are updated; new ones are created.
          </p>
        </CardContent>
      </Card>

      {/* Upload */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-slate-300 transition-colors">
          <Upload className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-600 mb-2">Drop a CSV file here, or click to browse</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            id="product-csv-upload"
          />
          <label htmlFor="product-csv-upload">
            <Button type="button" variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Choose File</span>
            </Button>
          </label>
        </div>

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {parseError}
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 font-medium">
              Preview — {rows.length} variant{rows.length !== 1 ? "s" : ""} across {uniqueProducts} product{uniqueProducts !== 1 ? "s" : ""}
            </p>
            <div className="rounded border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Product SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Brand</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Variant SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Size</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Color</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row) => (
                    <tr key={row._row} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 font-mono">{row.product_sku}</td>
                      <td className="px-3 py-1.5">{row.name}</td>
                      <td className="px-3 py-1.5">{row.brand}</td>
                      <td className="px-3 py-1.5 font-mono">{row.variant_sku}</td>
                      <td className="px-3 py-1.5">{row.size || "—"}</td>
                      <td className="px-3 py-1.5">{row.color || "—"}</td>
                      <td className="px-3 py-1.5 text-right">
                        {row.unit_cost.toLocaleString()} {row.currency}
                      </td>
                    </tr>
                  ))}
                  {rows.length > 50 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-center text-slate-400">
                        … and {rows.length - 50} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Importing…"
                : `Import ${rows.length} Variant${rows.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>
                <strong>{result.created}</strong> variant{result.created !== 1 ? "s" : ""} created,{" "}
                <strong>{result.updated}</strong> updated.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1 text-amber-700 text-xs space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>• …and {result.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
