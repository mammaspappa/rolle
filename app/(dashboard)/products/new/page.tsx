import { db } from "@/server/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewProductForm } from "./NewProductForm";

export default async function NewProductPage() {
  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, currency: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Products
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Product</h1>
        <p className="text-sm text-slate-500 mt-1">
          Add a product to the catalog. After creating the product, add size/color variants.
        </p>
      </div>
      <NewProductForm suppliers={suppliers} />
    </div>
  );
}
