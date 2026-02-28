/**
 * Cost Snapshot Service
 *
 * Nightly snapshot of carrying costs per variant × location:
 *   dailyCarryingCost = quantityOnHand × unitCost × (annualRate / 365)
 *
 * Annual rate comes from CategoryCarryingRate table,
 * overridden by Product.annualCarryingRateOverride if set.
 */

import { db } from "@/server/db";

const DEFAULT_ANNUAL_RATE = 0.25; // 25% fallback

/**
 * Take a snapshot of carrying costs for today.
 * Upserts one CostRecord per active variant × location.
 * Returns the number of rows written.
 */
export async function runCostSnapshot(date?: Date): Promise<number> {
  const today = date ?? new Date();
  // Normalise to midnight UTC to match @db.Date
  today.setUTCHours(0, 0, 0, 0);

  // Load category carrying rates
  const categoryRates = await db.categoryCarryingRate.findMany();
  const rateByCategory = new Map(
    categoryRates.map((r) => [r.category, Number(r.annualRate)])
  );

  // Load all active inventory levels with product cost/category
  const levels = await db.inventoryLevel.findMany({
    where: {
      location: { isActive: true },
      productVariant: { isActive: true },
    },
    include: {
      productVariant: {
        include: {
          product: {
            select: {
              category: true,
              unitCost: true,
              annualCarryingRateOverride: true,
            },
          },
        },
      },
    },
  });

  let written = 0;

  for (const level of levels) {
    const product = level.productVariant.product;
    const unitCost = Number(level.productVariant.unitCost ?? product.unitCost);
    const annualRate =
      product.annualCarryingRateOverride !== null
        ? Number(product.annualCarryingRateOverride)
        : (rateByCategory.get(product.category) ?? DEFAULT_ANNUAL_RATE);

    const dailyCarryingCost =
      level.quantityOnHand * unitCost * (annualRate / 365);

    await db.costRecord.upsert({
      where: {
        date_productVariantId_locationId: {
          date: today,
          productVariantId: level.productVariantId,
          locationId: level.locationId,
        },
      },
      create: {
        date: today,
        productVariantId: level.productVariantId,
        locationId: level.locationId,
        quantityOnHand: level.quantityOnHand,
        unitCost,
        annualCarryingRate: annualRate,
        dailyCarryingCost,
      },
      update: {
        quantityOnHand: level.quantityOnHand,
        unitCost,
        annualCarryingRate: annualRate,
        dailyCarryingCost,
      },
    });

    written++;
  }

  return written;
}

/**
 * Get total inventory value (sum of quantityOnHand × unitCost) as of the
 * most recent snapshot date, grouped by location.
 */
export async function getInventoryValueByLocation(): Promise<
  { locationId: string; locationCode: string; locationName: string; totalValue: number }[]
> {
  // Most recent snapshot date
  const latest = await db.costRecord.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latest) return [];

  const records = await db.costRecord.findMany({
    where: { date: latest.date },
    include: {
      location: { select: { code: true, name: true } },
    },
  });

  const byLocation = new Map<string, { locationCode: string; locationName: string; total: number }>();

  for (const r of records) {
    const value = r.quantityOnHand * Number(r.unitCost);
    const existing = byLocation.get(r.locationId);
    if (existing) {
      existing.total += value;
    } else {
      byLocation.set(r.locationId, {
        locationCode: r.location.code,
        locationName: r.location.name,
        total: value,
      });
    }
  }

  return Array.from(byLocation.entries())
    .map(([locationId, { locationCode, locationName, total }]) => ({
      locationId,
      locationCode,
      locationName,
      totalValue: total,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Get daily total carrying cost for the last N days (for a trend chart).
 */
export async function getDailyCarryingCostTrend(
  days = 30
): Promise<{ date: string; totalCost: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const records = await db.costRecord.groupBy({
    by: ["date"],
    where: { date: { gte: since } },
    _sum: { dailyCarryingCost: true },
    orderBy: { date: "asc" },
  });

  return records.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    totalCost: Number(r._sum.dailyCarryingCost ?? 0),
  }));
}
