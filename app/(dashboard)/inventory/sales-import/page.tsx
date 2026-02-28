import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SalesImportForm } from "./SalesImportForm";

export default function SalesImportPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Inventory
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Sales</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a CSV from your POS system to record sales and update stock levels.
          Each row creates a SALE movement and decrements inventory.
        </p>
      </div>
      <SalesImportForm />
    </div>
  );
}
