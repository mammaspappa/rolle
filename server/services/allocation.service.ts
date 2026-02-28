/**
 * Allocation Engine
 *
 * When warehouse stock is insufficient to fill all store requests,
 * this engine scores each requesting store and greedy-allocates in priority order.
 *
 * Score = (belowSafety ? 1000 : 0)
 *       + (1 / (daysOfStock + 0.1)) × 100    ← urgency
 *       + revenueTierWeight × 10              ← A=30, B=20, C=10
 *
 * Returns an AllocationProposal — never auto-executes.
 */

import { db } from "@/server/db";
import { RevenueTier } from "@prisma/client";

const TIER_WEIGHT: Record<RevenueTier, number> = {
  A: 30,
  B: 20,
  C: 10,
};

export interface StoreNeed {
  locationId: string;
  locationCode: string;
  locationName: string;
  revenueTier: RevenueTier;
  quantityAvailable: number; // onHand - reserved
  safetyStock: number;       // from product record
  avgDailySales: number;     // derived from latest forecast
  daysOfStock: number;       // quantityAvailable / avgDailySales
  score: number;
  suggestedQty: number;      // filled by allocate()
  belowSafety: boolean;
}

export interface AllocationProposal {
  productVariantId: string;
  variantSku: string;
  productName: string;
  warehouseAvailable: number;
  totalRequested: number;   // sum of all store needs
  fullyFulfilled: boolean;
  stores: StoreNeed[];      // sorted by score desc, suggestedQty populated
}

function scoreStore(need: Omit<StoreNeed, "score" | "suggestedQty">): number {
  return (need.belowSafety ? 1000 : 0) +
    (1 / (need.daysOfStock + 0.1)) * 100 +
    TIER_WEIGHT[need.revenueTier] * 10;
}

/**
 * Compute an allocation proposal for a product variant.
 *
 * @param productVariantId
 * @param warehouseAvailableOverride  If provided, uses this qty instead of live DB value.
 */
export async function computeAllocationProposal(
  productVariantId: string,
  warehouseAvailableOverride?: number
): Promise<AllocationProposal> {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { id: productVariantId },
    include: {
      product: {
        select: { name: true, safetyStock: true, reorderPoint: true },
      },
    },
  });

  // --- Warehouse available stock ---
  const warehouse = await db.location.findFirstOrThrow({
    where: { type: "WAREHOUSE", isActive: true },
    select: { id: true },
  });

  let warehouseAvailable = warehouseAvailableOverride ?? 0;
  if (warehouseAvailableOverride === undefined) {
    const whl = await db.inventoryLevel.findUnique({
      where: {
        locationId_productVariantId: {
          locationId: warehouse.id,
          productVariantId,
        },
      },
      select: { quantityOnHand: true, quantityReserved: true },
    });
    warehouseAvailable = Math.max(
      0,
      (whl?.quantityOnHand ?? 0) - (whl?.quantityReserved ?? 0)
    );
  }

  // --- Store inventory levels ---
  const stores = await db.location.findMany({
    where: { type: "STORE", isActive: true },
    select: { id: true, code: true, name: true, revenueTier: true },
    orderBy: { code: "asc" },
  });

  // Batch load inventory levels and latest forecasts
  const storeIds = stores.map((s) => s.id);

  const levels = await db.inventoryLevel.findMany({
    where: {
      productVariantId,
      locationId: { in: storeIds },
    },
    select: { locationId: true, quantityOnHand: true, quantityReserved: true },
  });
  const levelByStore = new Map(levels.map((l) => [l.locationId, l]));

  // Use most recent forecast to get avgDailySales
  const forecasts = await db.demandForecast.findMany({
    where: {
      productVariantId,
      locationId: { in: storeIds },
    },
    orderBy: { periodStart: "desc" },
    distinct: ["locationId"],
    select: { locationId: true, forecastedDemand: true },
  });
  const forecastByStore = new Map(
    forecasts.map((f) => [f.locationId, Number(f.forecastedDemand)])
  );

  const safetyStock = variant.product.safetyStock;

  // Build store needs (only stores that need stock)
  const storeNeeds: Omit<StoreNeed, "score" | "suggestedQty">[] = [];

  for (const store of stores) {
    const level = levelByStore.get(store.id);
    const qtyAvailable = Math.max(
      0,
      (level?.quantityOnHand ?? 0) - (level?.quantityReserved ?? 0)
    );
    // avgDailySales from weekly forecast / 7
    const weeklyForecast = forecastByStore.get(store.id) ?? 0;
    const avgDailySales = weeklyForecast / 7;
    const daysOfStock = avgDailySales > 0 ? qtyAvailable / avgDailySales : 999;
    const belowSafety = qtyAvailable < safetyStock;

    // Only include stores that are below reorder point or have < 7 days of stock
    if (belowSafety || daysOfStock < 14) {
      storeNeeds.push({
        locationId: store.id,
        locationCode: store.code,
        locationName: store.name,
        revenueTier: store.revenueTier,
        quantityAvailable: qtyAvailable,
        safetyStock,
        avgDailySales,
        daysOfStock,
        belowSafety,
      });
    }
  }

  // Score and sort
  const scored = storeNeeds
    .map((n) => ({ ...n, score: scoreStore(n), suggestedQty: 0 }))
    .sort((a, b) => b.score - a.score);

  // Greedy allocation
  let remaining = warehouseAvailable;
  const totalRequested = scored.reduce(
    (s, n) => s + Math.max(0, safetyStock * 2 - n.quantityAvailable),
    0
  );

  for (const need of scored) {
    if (remaining <= 0) break;
    // Target: bring store up to (safetyStock * 2)
    const desired = Math.max(0, safetyStock * 2 - need.quantityAvailable);
    const allocated = Math.min(desired, remaining);
    need.suggestedQty = allocated;
    remaining -= allocated;
  }

  return {
    productVariantId,
    variantSku: variant.sku,
    productName: variant.product.name,
    warehouseAvailable,
    totalRequested,
    fullyFulfilled: totalRequested <= warehouseAvailable,
    stores: scored,
  };
}

/**
 * Get all variants that currently have stores needing allocation
 * (at least one store below reorder point with positive warehouse stock).
 */
export async function getVariantsNeedingAllocation(): Promise<
  { id: string; sku: string; productName: string; storesBelow: number }[]
> {
  const warehouse = await db.location.findFirst({
    where: { type: "WAREHOUSE", isActive: true },
    select: { id: true },
  });
  if (!warehouse) return [];

  const storeIds = await db.location
    .findMany({ where: { type: "STORE", isActive: true }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

  const variants = await db.productVariant.findMany({
    where: { isActive: true },
    include: {
      product: { select: { name: true, safetyStock: true, reorderPoint: true } },
    },
  });

  const results: { id: string; sku: string; productName: string; storesBelow: number }[] = [];

  for (const variant of variants) {
    // Check warehouse has stock
    const whl = await db.inventoryLevel.findUnique({
      where: {
        locationId_productVariantId: {
          locationId: warehouse.id,
          productVariantId: variant.id,
        },
      },
      select: { quantityOnHand: true, quantityReserved: true },
    });
    const warehouseAvail = Math.max(
      0,
      (whl?.quantityOnHand ?? 0) - (whl?.quantityReserved ?? 0)
    );
    if (warehouseAvail === 0) continue;

    // Count stores below safety stock
    const storeLevels = await db.inventoryLevel.findMany({
      where: {
        productVariantId: variant.id,
        locationId: { in: storeIds },
      },
      select: { quantityOnHand: true, quantityReserved: true },
    });

    const storesBelow = storeLevels.filter(
      (l) => l.quantityOnHand - l.quantityReserved < variant.product.safetyStock
    ).length;

    if (storesBelow > 0) {
      results.push({
        id: variant.id,
        sku: variant.sku,
        productName: variant.product.name,
        storesBelow,
      });
    }
  }

  return results;
}
