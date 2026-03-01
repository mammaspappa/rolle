import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { ForecastControls } from "./ForecastControls";
import { ForecastTable, type ForecastVariantRow } from "./ForecastTable";

// ── data ─────────────────────────────────────────────────────────────────────

async function getForecastSummary(locationFilter?: string) {
  const variants = await db.productVariant.findMany({
    where: { isActive: true },
    include: {
      product: {
        select: {
          name: true,
          brand: true,
          safetyStock: true,
          reorderPoint: true,
        },
      },
      demandForecasts: {
        where: locationFilter ? { locationId: locationFilter } : undefined,
        orderBy: { periodStart: "desc" },
        take: locationFilter ? 1 : 21,
        include: {
          location: { select: { code: true, type: true } },
        },
      },
      inventoryLevels: {
        where: locationFilter
          ? { locationId: locationFilter }
          : { location: { type: "STORE" } },
        select: {
          locationId: true,
          quantityOnHand: true,
          quantityReserved: true,
          location: { select: { code: true } },
        },
        take: locationFilter ? 1 : undefined,
      },
    },
    orderBy: [{ product: { brand: "asc" } }, { sku: "asc" }],
  });

  return variants.filter((v) => v.demandForecasts.length > 0);
}

async function getLocations() {
  return db.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "desc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ForecastsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const { locationId } = await searchParams;
  const [locations, rawVariants] = await Promise.all([
    getLocations(),
    getForecastSummary(locationId),
  ]);

  const selectedLocation = locations.find((l) => l.id === locationId);

  // Serialise to plain objects for the client component (strips Decimal/Date)
  const variants: ForecastVariantRow[] = rawVariants.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    brand: v.product.brand,
    productName: v.product.name,
    sku: v.sku,
    color: v.color,
    size: v.size,
    forecasts: v.demandForecasts.map((f) => {
      const forecastedDemand = Number(f.forecastedDemand);
      const dailyAvg = forecastedDemand / 7;
      const inventoryLevel = v.inventoryLevels.find(
        (il) => il.location.code === f.location.code
      );
      const qtyAvail = inventoryLevel
        ? inventoryLevel.quantityOnHand - inventoryLevel.quantityReserved
        : null;
      const daysOfStock =
        qtyAvail !== null && dailyAvg > 0
          ? Math.round(qtyAvail / dailyAvg)
          : null;

      return {
        locationCode: f.location.code,
        forecastedDemand,
        forecastMethod: f.forecastMethod,
        periodStart: f.periodStart.toISOString(),
        daysOfStock,
      };
    }),
  }));

  const totalForecasts = variants.reduce((s, v) => s + v.forecasts.length, 0);

  // Count unique product IDs for the stats strip
  const uniqueProducts = new Set(variants.map((v) => v.productId)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Demand Forecasts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Weekly demand predictions per SKU per store. Run nightly or trigger manually.
          </p>
        </div>
        <ForecastControls />
      </div>

      {/* Location filter */}
      <div className="flex flex-wrap gap-2">
        <a href="/forecasts">
          <Button
            variant={!locationId ? "default" : "outline"}
            size="sm"
            className="text-xs"
          >
            All Locations
          </Button>
        </a>
        {locations
          .filter((l) => l.type === "STORE")
          .map((loc) => (
            <a key={loc.id} href={`/forecasts?locationId=${loc.id}`}>
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Forecasts</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{totalForecasts}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Products</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{uniqueProducts}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {selectedLocation ? selectedLocation.code : "Locations Covered"}
          </p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">
            {selectedLocation
              ? variants.length
              : locations.filter((l) => l.type === "STORE").length}
          </p>
        </div>
      </div>

      {/* Forecast table (client component — handles grouping & collapse) */}
      <ForecastTable variants={variants} locationId={locationId} />

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-400">
        <span>
          Days of stock:{" "}
          <span className="text-red-500 font-medium">&lt;7d critical</span>
          {" · "}
          <span className="text-amber-500 font-medium">&lt;14d warning</span>
          {" · "}
          <span className="text-green-600 font-medium">≥14d ok</span>
        </span>
        <span>
          Methods:{" "}
          <span className="text-blue-600 font-medium">WMA</span> = 12-week weighted avg
          {" · "}
          <span className="text-indigo-600 font-medium">H-W</span> = Holt-Winters seasonal
          {" · "}
          <span className="text-rose-600 font-medium">Croston</span> = intermittent demand
          {" · "}
          <span className="text-emerald-600 font-medium">Ensemble</span> = MAPE-weighted combination
          {" · "}
          <span className="text-amber-600 font-medium">Manual</span> = user override
        </span>
      </div>
    </div>
  );
}
