import { db } from "@/server/db";
import { Truck } from "lucide-react";
import { SupplierDialog } from "./SupplierDialog";

async function getSuppliers() {
  return db.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true, purchaseOrders: true } },
    },
  });
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">{suppliers.length} active suppliers</p>
        </div>
        <SupplierDialog mode="create" />
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Country</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Currency</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Lead Time</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Products</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Contact</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier, i) => (
              <tr
                key={supplier.id}
                className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-slate-300" />
                    {supplier.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{supplier.country}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{supplier.currency}</td>
                <td className="px-4 py-3 text-slate-600">{supplier.defaultLeadDays} days</td>
                <td className="px-4 py-3 text-slate-600">{supplier._count.products}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{supplier.contactEmail ?? "—"}</td>
                <td className="px-4 py-3">
                  <SupplierDialog
                    mode="edit"
                    supplier={{
                      id: supplier.id,
                      name: supplier.name,
                      country: supplier.country,
                      currency: supplier.currency,
                      defaultLeadDays: supplier.defaultLeadDays,
                      contactEmail: supplier.contactEmail,
                      contactPhone: supplier.contactPhone,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
