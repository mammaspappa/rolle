/**
 * Safety Stock & Reorder Point Service
 *
 * Formula:
 *   Safety Stock = Z × σ_demand × √(leadTimeWeeks)   [Z=1.65 for 95% service level]
 *   Reorder Point = (avgWeeklyDemand × leadTimeWeeks) + safetyStock
 */

import { db } from "@/server/db";
import { subWeeks, startOfWeek, eachWeekOfInterval } from "date-fns";

const WEEKS_WINDOW = 12;
const Z_95 = 1.65; // 95% service level

function weekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 }); // Monday
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface SafetyStockResult {
  safetyStock: number;
  reorderPoint: number;
  avgWeeklyDemand: number;
  demandStddev: number;
}

/**
 * Calculate safety stock and reorder point for one variant at one location.
 * Reads the last WEEKS_WINDOW weeks of SALE movements.
 */
export async function calculateSafetyStock(
  productVariantId: string,
  locationId: string,
  leadTimeDays: number,
  zScore = Z_95
): Promise<SafetyStockResult> {
  const now = new Date();
  const windowStart = subWeeks(weekStart(now), WEEKS_WINDOW);

  const movements = await db.stockMovement.findMany({
    where: {
      type: "SALE",
      productVariantId,
      fromLocationId: locationId,
      occurredAt: { gte: windowStart },
    },
    select: { quantity: true, occurredAt: true },
  });

  const weeks = eachWeekOfInterval(
    { start: windowStart, end: weekStart(now) },
    { weekStartsOn: 1 }
  );

  const buckets = new Array(weeks.length).fill(0);
  for (const m of movements) {
    const ws = weekStart(m.occurredAt).toISOString();
    const idx = weeks.findIndex((w) => w.toISOString() === ws);
    if (idx !== -1) buckets[idx] += m.quantity;
  }

  const avgWeeklyDemand = average(buckets);
  const demandStddev = stddev(buckets);
  const leadTimeWeeks = leadTimeDays / 7;

  const safetyStock = Math.ceil(zScore * demandStddev * Math.sqrt(leadTimeWeeks));
  const reorderPoint = Math.ceil(avgWeeklyDemand * leadTimeWeeks) + safetyStock;

  return { safetyStock, reorderPoint, avgWeeklyDemand, demandStddev };
}

/**
 * Recompute and persist safety stock + reorder point on the Product record.
 * Aggregates across all active variants at the warehouse.
 * Respects manualReorderOverride and manualSafetyOverride flags.
 */
export async function refreshProductSafetyStock(productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      variants: { where: { isActive: true }, select: { id: true } },
    },
  });
  if (!product || product.manualReorderOverride) return;

  const warehouse = await db.location.findFirst({
    where: { type: "WAREHOUSE", isActive: true },
    select: { id: true },
  });
  if (!warehouse) return;

  const results: SafetyStockResult[] = [];
  for (const variant of product.variants) {
    const r = await calculateSafetyStock(variant.id, warehouse.id, product.leadTimeDays);
    results.push(r);
  }
  if (results.length === 0) return;

  const avgSafety = Math.round(
    results.reduce((s, r) => s + r.safetyStock, 0) / results.length
  );
  const avgROP = Math.round(
    results.reduce((s, r) => s + r.reorderPoint, 0) / results.length
  );

  const data: Record<string, number> = { reorderPoint: avgROP };
  if (!product.manualSafetyOverride) data.safetyStock = avgSafety;

  await db.product.update({ where: { id: productId }, data });
}

/**
 * Run safety stock refresh for all active products.
 * Returns the number of products updated.
 */
export async function refreshAllSafetyStocks(): Promise<number> {
  const products = await db.product.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const { id } of products) {
    await refreshProductSafetyStock(id);
  }
  return products.length;
}
