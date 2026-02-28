import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductImportForm } from "./ProductImportForm";

export default function ProductImportPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Products
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Products</h1>
        <p className="text-sm text-slate-500 mt-1">
          Bulk-create or update products and variants from a CSV file.
        </p>
      </div>
      <ProductImportForm />
    </div>
  );
}
