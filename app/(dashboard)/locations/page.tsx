import { db } from "@/server/db";
import Link from "next/link";
import { MapPin } from "lucide-react";

async function getLocations() {
  return db.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "desc" }, { revenueTier: "asc" }, { city: "asc" }],
    include: {
      manager: { select: { name: true } },
      _count: { select: { inventoryLevels: true } },
      inventoryLevels: { select: { quantityOnHand: true } },
    },
  });
}

const tierColor: Record<string, string> = {
  A: "bg-amber-100 text-amber-700 border-amber-200",
  B: "bg-slate-100 text-slate-600 border-slate-200",
  C: "bg-slate-50 text-slate-500 border-slate-200",
};

export default async function LocationsPage() {
  const locations = await getLocations();

  const warehouse = locations.filter((l) => l.type === "WAREHOUSE");
  const stores = locations.filter((l) => l.type === "STORE");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Locations</h1>
        <p className="text-sm text-slate-500 mt-1">
          {warehouse.length} warehouse · {stores.length} stores
        </p>
      </div>

      {/* Warehouse */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Warehouse
        </h2>
        <LocationTable rows={warehouse} />
      </section>

      {/* Stores by tier */}
      {(["A", "B", "C"] as const).map((tier) => {
        const tierStores = stores.filter((s) => s.revenueTier === tier);
        if (tierStores.length === 0) return null;
        return (
          <section key={tier}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Tier {tier} Stores
            </h2>
            <LocationTable rows={tierStores} />
          </section>
        );
      })}
    </div>
  );
}

function LocationTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getLocations>>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Code</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">City</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Country</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Currency</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Tier</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-500">Units on Hand</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Manager</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((loc, i) => {
            const totalUnits = loc.inventoryLevels.reduce(
              (s, l) => s + l.quantityOnHand,
              0
            );
            return (
              <tr
                key={loc.id}
                className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
              >
                <td className="px-4 py-2.5">
                  <Link href={`/locations/${loc.id}`}>
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer">
                      {loc.code}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  <Link href={`/locations/${loc.id}`} className="flex items-center gap-2 hover:underline">
                    <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    {loc.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{loc.city}</td>
                <td className="px-4 py-2.5 text-slate-600">{loc.country}</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{loc.currency}</td>
                <td className="px-4 py-2.5">
                  {loc.type === "STORE" && (
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded border ${tierColor[loc.revenueTier]}`}
                    >
                      {loc.revenueTier}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                  {totalUnits.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {loc.manager?.name ?? <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
