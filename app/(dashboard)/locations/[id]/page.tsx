import { db } from "@/server/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, ArrowLeftRight, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const tierColor: Record<string, string> = {
  A: "bg-amber-100 text-amber-700 border-amber-200",
  B: "bg-slate-100 text-slate-600 border-slate-200",
  C: "bg-slate-50 text-slate-500 border-slate-200",
};

function dosColor(qty: number, avgDaily: number): string {
  if (qty === 0) return "text-red-600 font-semibold";
  if (avgDaily === 0) return "text-slate-500";
  const dos = qty / avgDaily;
  if (dos <= 3) return "text-orange-600";
  if (dos <= 10) return "text-yellow-600";
  return "text-green-700";
}

async function getLocation(id: string) {
  return db.location.findUnique({
    where: { id },
    include: {
      manager: { select: { name: true, email: true } },
      inventoryLevels: {
        include: {
          productVariant: {
            select: {
              productId: true,
              sku: true,
              color: true,
              product: { select: { name: true, brand: true, category: true, retailPrice: true } },
            },
          },
        },
        orderBy: { quantityOnHand: "desc" },
      },
    },
  });
}

async function getRecentMovements(locationId: string) {
  return db.stockMovement.findMany({
    where: {
      OR: [{ fromLocationId: locationId }, { toLocationId: locationId }],
    },
    orderBy: { occurredAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      quantity: true,
      occurredAt: true,
      fromLocationId: true,
      productVariant: {
        select: {
          sku: true,
          product: { select: { brand: true } },
        },
      },
      performedBy: { select: { name: true } },
    },
  });
}

async function getSalesLast30d(locationId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return db.stockMovement.groupBy({
    by: ["productVariantId"],
    where: {
      fromLocationId: locationId,
      type: "SALE",
      occurredAt: { gte: since },
    },
    _sum: { quantity: true },
  });
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [location, movements, salesGroups] = await Promise.all([
    getLocation(id),
    getRecentMovements(id),
    getSalesLast30d(id),
  ]);

  if (!location) notFound();

  // Build sales lookup: variantId → units sold last 30d
  const salesByVariant = new Map(salesGroups.map((s) => [s.productVariantId, s._sum.quantity ?? 0]));

  const totalUnits = location.inventoryLevels.reduce((s, l) => s + l.quantityOnHand, 0);
  const totalValue = location.inventoryLevels.reduce((s, l) => {
    return s + l.quantityOnHand * Number(l.productVariant.product.retailPrice);
  }, 0);
  const stockoutCount = location.inventoryLevels.filter((l) => l.quantityOnHand === 0).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        href="/locations"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Locations
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
          <MapPin className="w-6 h-6 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">{location.name}</h1>
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">
              {location.code}
            </span>
            {location.type === "STORE" && (
              <Badge
                variant="outline"
                className={`text-xs ${tierColor[location.revenueTier]}`}
              >
                Tier {location.revenueTier}
              </Badge>
            )}
            {location.type === "WAREHOUSE" && (
              <Badge variant="outline" className="text-xs">Warehouse</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {location.city}, {location.country} · {location.timezone} · {location.currency}
          </p>
          {location.manager && (
            <p className="text-xs text-slate-400 mt-0.5">Manager: {location.manager.name}</p>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Units on Hand", value: totalUnits.toLocaleString(), icon: Package },
          { label: "Retail Value", value: `€${(totalValue / 1000).toFixed(0)}k`, icon: TrendingDown },
          { label: "SKUs Tracked", value: location.inventoryLevels.length.toString(), icon: Package },
          { label: "Stockouts", value: stockoutCount.toString(), icon: Package },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Stock levels table */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Stock Levels
        </h2>
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Product</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">SKU</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">On Hand</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">In Transit</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">Sold (30d)</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">DOS</th>
              </tr>
            </thead>
            <tbody>
              {location.inventoryLevels.map((level, i) => {
                const sold30 = salesByVariant.get(level.productVariantId) ?? 0;
                const avgDaily = sold30 / 30;
                const dos = avgDaily > 0 ? Math.round(level.quantityOnHand / avgDaily) : null;
                return (
                  <tr
                    key={level.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      i % 2 !== 0 ? "bg-slate-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/products/${level.productVariant.productId}`}
                        className="hover:underline"
                      >
                        <div className="font-medium text-slate-800 text-xs">
                          {level.productVariant.product.brand} — {level.productVariant.product.name}
                        </div>
                        <div className="text-slate-400 text-xs">{level.productVariant.product.category}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {level.productVariant.sku}
                      {level.productVariant.color && (
                        <span className="ml-1 text-slate-300">· {level.productVariant.color}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`font-semibold ${
                          level.quantityOnHand === 0
                            ? "text-red-600"
                            : "text-slate-800"
                        }`}
                      >
                        {level.quantityOnHand}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400 text-xs">
                      {level.quantityInTransit > 0 ? `+${level.quantityInTransit}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500 text-xs">{sold30 || "—"}</td>
                    <td className={`px-4 py-2 text-right text-xs ${dosColor(level.quantityOnHand, avgDaily)}`}>
                      {dos !== null ? `${dos}d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent movements */}
      {movements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Recent Movements
          </h2>
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Product</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr
                    key={m.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      i % 2 !== 0 ? "bg-slate-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-1.5 text-slate-400 font-mono">
                      {new Date(m.occurredAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-1.5">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
                        {m.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-slate-600">
                      {m.productVariant.product.brand} — {m.productVariant.sku}
                    </td>
                    <td className="px-4 py-1.5 text-right font-medium text-slate-700">
                      {m.fromLocationId === id ? "-" : "+"}
                      {m.quantity}
                    </td>
                    <td className="px-4 py-1.5 text-slate-400">{m.performedBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
