import { db } from "@/server/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, ClipboardList, ShoppingCart } from "lucide-react";
import { getCached, CACHE_KEYS } from "@/lib/cache";
import { InventoryTable, type LocationCol, type VariantRow } from "./InventoryTable";

type LevelRow = {
  locationId: string;
  productVariantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityInTransit: number;
};

async function fetchInventoryData() {
  const [locations, variants, levels] = await Promise.all([
    db.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "desc" }, { revenueTier: "asc" }, { city: "asc" }],
      select: { id: true, code: true, name: true, type: true, city: true },
    }),
    db.productVariant.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
      include: {
        product: { select: { name: true, brand: true, category: true } },
      },
    }),
    db.inventoryLevel.findMany({
      select: {
        locationId: true,
        productVariantId: true,
        quantityOnHand: true,
        quantityReserved: true,
        quantityInTransit: true,
      },
    }),
  ]);

  return { locations, variants, levels };
}

async function getInventoryData() {
  const { locations, variants, levels } = await getCached(
    CACHE_KEYS.INVENTORY_GRID,
    60, // 60-second TTL
    fetchInventoryData
  );

  // Build a lookup map: variantId -> locationId -> level
  const levelMap = new Map<string, Map<string, LevelRow>>();
  for (const level of levels) {
    if (!levelMap.has(level.productVariantId)) {
      levelMap.set(level.productVariantId, new Map());
    }
    levelMap.get(level.productVariantId)!.set(level.locationId, level);
  }

  return { locations, variants, levelMap };
}

export default async function InventoryPage() {
  const { locations, variants, levelMap } = await getInventoryData();

  // Split: warehouse first, then stores
  const warehouse = locations.filter((l) => l.type === "WAREHOUSE");
  const stores = locations.filter((l) => l.type === "STORE");
  const orderedLocations = [...warehouse, ...stores];

  // Serialize for client component
  const locationCols: LocationCol[] = orderedLocations.map((l) => ({
    id: l.id,
    code: l.code,
    city: l.city,
    name: l.name,
  }));

  const variantRows: VariantRow[] = variants.map((v) => {
    const variantLevels = levelMap.get(v.id) ?? new Map();
    const levels: VariantRow["levels"] = {};
    for (const loc of orderedLocations) {
      const level = variantLevels.get(loc.id);
      levels[loc.id] = {
        qty: level?.quantityOnHand ?? 0,
        inTransit: level?.quantityInTransit ?? 0,
      };
    }
    return {
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      color: v.color,
      size: v.size,
      brand: v.product.brand,
      name: v.product.name,
      category: v.product.category,
      levels,
    };
  });

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            {variants.length} variants across {orderedLocations.length} locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/sales-import">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ShoppingCart className="w-3.5 h-3.5" /> Import Sales
            </Button>
          </Link>
          <Link href="/inventory/count">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ClipboardList className="w-3.5 h-3.5" /> Stock Count
            </Button>
          </Link>
          <Link href="/inventory/adjustments">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" />
            Stockout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200 inline-block" />
            Low (≤10)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />
            OK
          </span>
        </div>
      </div>

      <InventoryTable
        locations={locationCols}
        variants={variantRows}
        totalVariants={variants.length}
      />

      <p className="text-xs text-slate-400">
        Numbers show units on hand.{" "}
        <span className="text-slate-500">+N</span> below a cell = units in transit (not yet received).
        Refresh the page for latest figures.
      </p>
    </div>
  );
}
