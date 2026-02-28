"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, CheckCircle, AlertTriangle, Download } from "lucide-react";

interface ParsedRow {
  date: string;
  sku: string;
  location_code: string;
  quantity: number;
  _row: number;
}

interface ImportResult {
  recorded: number;
  skipped: number;
  errors: string[];
}

export function SalesImportForm() {
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
    const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const required = ["date", "sku", "location_code", "quantity"];
    for (const col of required) {
      if (!header.includes(col)) throw new Error(`Missing required column: ${col}`);
    }

    const idx = {
      date: header.indexOf("date"),
      sku: header.indexOf("sku"),
      location_code: header.indexOf("location_code"),
      quantity: header.indexOf("quantity"),
    };

    return lines.slice(1).map((line, i) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const qty = parseInt(cols[idx.quantity]);
      if (isNaN(qty)) throw new Error(`Row ${i + 2}: quantity "${cols[idx.quantity]}" is not a number.`);
      return {
        date: cols[idx.date],
        sku: cols[idx.sku].toUpperCase(),
        location_code: cols[idx.location_code].toUpperCase(),
        quantity: qty,
        _row: i + 2,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return;
    setResult(null);

    startTransition(async () => {
      const res = await fetch("/api/inventory/sales-import", {
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

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Template download */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">CSV Format</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Required columns: <code className="bg-slate-100 px-1 rounded">date</code>,{" "}
                <code className="bg-slate-100 px-1 rounded">sku</code>,{" "}
                <code className="bg-slate-100 px-1 rounded">location_code</code>,{" "}
                <code className="bg-slate-100 px-1 rounded">quantity</code>
              </p>
            </div>
            <a href="/api/inventory/sales-template" download>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Template
              </Button>
            </a>
          </div>
          <div className="bg-slate-50 rounded border border-slate-200 p-3 font-mono text-xs text-slate-600">
            date,sku,location_code,quantity<br />
            2026-02-27,RLE-BAG-001-BLK,STORE-PAR,2<br />
            2026-02-27,RLE-BAG-001-BRN,STORE-NYC,1
          </div>
        </CardContent>
      </Card>

      {/* File upload */}
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
            id="csv-upload"
          />
          <label htmlFor="csv-upload">
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
              Preview — {rows.length} sale{rows.length !== 1 ? "s" : ""} ready to import
            </p>
            <div className="rounded border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Location</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row) => (
                    <tr key={row._row} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 font-mono">{row.date}</td>
                      <td className="px-3 py-1.5 font-mono">{row.sku}</td>
                      <td className="px-3 py-1.5 font-mono">{row.location_code}</td>
                      <td className="px-3 py-1.5 text-right">{row.quantity}</td>
                    </tr>
                  ))}
                  {rows.length > 50 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-slate-400">
                        … and {rows.length - 50} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Importing…" : `Import ${rows.length} Sale${rows.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>
                Imported <strong>{result.recorded}</strong> sale{result.recorded !== 1 ? "s" : ""}.
                {result.skipped > 0 && <span className="ml-1">{result.skipped} skipped.</span>}
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
