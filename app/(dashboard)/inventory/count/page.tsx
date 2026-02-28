import { db } from "@/server/db";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountForm } from "./CountForm";
import { redirect } from "next/navigation";

async function getLocations() {
  return db.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "desc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });
}

async function getCountData(locationId: string) {
  const levels = await db.inventoryLevel.findMany({
    where: { locationId },
    include: {
      productVariant: {
        include: {
          product: { select: { name: true, brand: true } },
        },
      },
    },
    orderBy: { productVariant: { sku: "asc" } },
  });

  return levels.map((l) => ({
    productVariantId: l.productVariantId,
    sku: l.productVariant.sku,
    productName: l.productVariant.product.name,
    brand: l.productVariant.product.brand,
    color: l.productVariant.color,
    size: l.productVariant.size,
    currentQty: l.quantityOnHand,
    lastCountedAt: l.lastCountedAt,
  }));
}

export default async function PhysicalCountPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const { locationId: locationIdParam } = await searchParams;
  const locations = await getLocations();
  const locationId = locationIdParam ?? locations[0]?.id;
  const location = locations.find((l) => l.id === locationId);

  const variants = locationId ? await getCountData(locationId) : [];

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Inventory
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Physical Stock Count</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter actual counted quantities. Discrepancies create COUNT_CORRECTION movements automatically.
          </p>
        </div>
        {locationId && (
          <a href={`/api/inventory/count-export?locationId=${locationId}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </a>
        )}
      </div>

      {/* Location selector */}
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <a key={loc.id} href={`/inventory/count?locationId=${loc.id}`}>
            <Button
              variant={loc.id === locationId ? "default" : "outline"}
              size="sm"
              className="text-xs"
            >
              {loc.code}
            </Button>
          </a>
        ))}
      </div>

      {location && variants.length > 0 ? (
        <CountForm
          locationId={location.id}
          locationName={location.name}
          variants={variants}
        />
      ) : (
        <p className="text-slate-400 text-sm py-8 text-center">
          No inventory levels found for this location. Add products and variants first.
        </p>
      )}
    </div>
  );
}
