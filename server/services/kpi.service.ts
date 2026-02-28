/**
 * KPI Service
 *
 * Calculates the five core inventory KPIs:
 *   Fill Rate      = units shipped / units requested × 100
 *   Inventory Turnover = COGS / avg inventory value (rolling 12 months)
 *   Days of Stock  = quantityOnHand / avgDailySales (average across active lines)
 *   Overstock Ratio = qty with DOS > 90 days / total qty
 *   GMROI          = gross margin / avg inventory cost
 */

import { db } from "@/server/db";
import { subMonths, subWeeks, startOfWeek, eachWeekOfInterval } from "date-fns";

function weekStart(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

// ── Fill Rate ─────────────────────────────────────────────────────────────────

/**
 * Fill rate across all Transfer Orders completed in the last N months.
 * = sum(quantityConfirmed) / sum(quantityRequested) × 100
 */
export async function getFillRate(months = 3): Promise<number> {
  const since = subMonths(new Date(), months);

  const lines = await db.transferOrderLine.findMany({
    where: {
      transferOrder: {
        status: { in: ["COMPLETED", "PARTIALLY_RECEIVED"] },
        updatedAt: { gte: since },
      },
    },
    select: { quantityRequested: true, quantityReceived: true },
  });

  if (lines.length === 0) return 100;

  const requested = lines.reduce((s, l) => s + l.quantityRequested, 0);
  const confirmed = lines.reduce((s, l) => s + (l.quantityReceived ?? 0), 0);

  return requested === 0 ? 100 : Math.min(100, (confirmed / requested) * 100);
}

// ── Inventory Turnover ────────────────────────────────────────────────────────

/**
 * Inventory turnover = COGS (12-month rolling) / avg inventory value.
 * Uses cost records for avg inventory value.
 */
export async function getInventoryTurnover(): Promise<number> {
  const now = new Date();
  const oneYearAgo = subMonths(now, 12);

  // COGS = sum of SALE movements × unit cost in the last 12 months
  const sales = await db.stockMovement.aggregate({
    where: {
      type: "SALE",
      occurredAt: { gte: oneYearAgo },
    },
    _sum: { quantity: true },
  });

  // Approximate COGS using current average unit cost
  const avgCost = await db.productVariant.aggregate({
    _avg: { unitCost: true },
    where: { isActive: true },
  });

  const unitsSold = sales._sum.quantity ?? 0;
  const avgUnitCost = Number(avgCost._avg.unitCost ?? 0);
  const cogs = unitsSold * avgUnitCost;

  // Avg inventory value from cost records (last 90 days, or current if none)
  const recentCostRecords = await db.costRecord.aggregate({
    where: { date: { gte: subMonths(now, 3) } },
    _avg: { dailyCarryingCost: true },
  });

  // Fall back to current inventory value
  const currentLevels = await db.inventoryLevel.findMany({
    where: { location: { isActive: true }, productVariant: { isActive: true } },
    include: {
      productVariant: { select: { unitCost: true, product: { select: { unitCost: true } } } },
    },
  });

  const currentValue = currentLevels.reduce((s, l) => {
    const cost = Number(l.productVariant.unitCost ?? l.productVariant.product.unitCost);
    return s + l.quantityOnHand * cost;
  }, 0);

  const avgInventoryValue = currentValue || 1; // avoid divide by zero

  return cogs === 0 ? 0 : cogs / avgInventoryValue;
}

// ── Days of Stock ─────────────────────────────────────────────────────────────

/**
 * Average days of stock across all active store variant × location lines.
 * DOS = quantityOnHand / avgDailySales
 */
export async function getAverageDaysOfStock(weeksWindow = 12): Promise<number> {
  const now = new Date();
  const since = subWeeks(weekStart(now), weeksWindow);

  const stores = await db.location.findMany({
    where: { type: "STORE", isActive: true },
    select: { id: true },
  });
  const storeIds = stores.map((s) => s.id);

  const levels = await db.inventoryLevel.findMany({
    where: {
      locationId: { in: storeIds },
      productVariant: { isActive: true },
      quantityOnHand: { gt: 0 },
    },
    select: { productVariantId: true, locationId: true, quantityOnHand: true },
  });

  if (levels.length === 0) return 0;

  // Batch-load sales
  const variantIds = Array.from(new Set(levels.map((l) => l.productVariantId)));
  const locationIds = Array.from(new Set(levels.map((l) => l.locationId)));

  const salesAgg = await db.stockMovement.groupBy({
    by: ["productVariantId", "fromLocationId"],
    where: {
      type: "SALE",
      productVariantId: { in: variantIds },
      fromLocationId: { in: locationIds },
      occurredAt: { gte: since },
    },
    _sum: { quantity: true },
  });

  const salesMap = new Map(
    salesAgg.map((r) => [`${r.productVariantId}:${r.fromLocationId}`, r._sum.quantity ?? 0])
  );

  const daysWindow = weeksWindow * 7;
  let totalDOS = 0;
  let count = 0;

  for (const level of levels) {
    const totalSales =
      salesMap.get(`${level.productVariantId}:${level.locationId}`) ?? 0;
    const avgDailySales = totalSales / daysWindow;
    if (avgDailySales > 0) {
      totalDOS += level.quantityOnHand / avgDailySales;
      count++;
    }
  }

  return count === 0 ? 0 : totalDOS / count;
}

/**
 * Inventory health breakdown — how many variant×location lines fall into each DOS band.
 */
export async function getInventoryHealthBands(weeksWindow = 12): Promise<
  { band: string; label: string; count: number; qty: number; colour: string }[]
> {
  const now = new Date();
  const since = subWeeks(weekStart(now), weeksWindow);

  const stores = await db.location.findMany({
    where: { type: "STORE", isActive: true },
    select: { id: true },
  });
  const storeIds = stores.map((s) => s.id);

  const levels = await db.inventoryLevel.findMany({
    where: {
      locationId: { in: storeIds },
      productVariant: { isActive: true },
    },
    select: { productVariantId: true, locationId: true, quantityOnHand: true },
  });

  const variantIds = Array.from(new Set(levels.map((l) => l.productVariantId)));
  const locationIds = Array.from(new Set(levels.map((l) => l.locationId)));

  const salesAgg = await db.stockMovement.groupBy({
    by: ["productVariantId", "fromLocationId"],
    where: {
      type: "SALE",
      productVariantId: { in: variantIds },
      fromLocationId: { in: locationIds },
      occurredAt: { gte: since },
    },
    _sum: { quantity: true },
  });

  const salesMap = new Map(
    salesAgg.map((r) => [`${r.productVariantId}:${r.fromLocationId}`, r._sum.quantity ?? 0])
  );

  const daysWindow = weeksWindow * 7;

  const bands = [
    { band: "stockout", label: "Stockout", min: -1, max: 0, colour: "#ef4444", count: 0, qty: 0 },
    { band: "critical", label: "< 7 days", min: 0, max: 7, colour: "#f97316", count: 0, qty: 0 },
    { band: "low", label: "7–14 days", min: 7, max: 14, colour: "#eab308", count: 0, qty: 0 },
    { band: "ok", label: "14–30 days", min: 14, max: 30, colour: "#22c55e", count: 0, qty: 0 },
    { band: "good", label: "30–90 days", min: 30, max: 90, colour: "#3b82f6", count: 0, qty: 0 },
    { band: "overstock", label: "> 90 days", min: 90, max: Infinity, colour: "#8b5cf6", count: 0, qty: 0 },
  ];

  for (const level of levels) {
    const qty = level.quantityOnHand;
    if (qty === 0) {
      bands[0].count++;
      bands[0].qty += qty;
      continue;
    }

    const totalSales = salesMap.get(`${level.productVariantId}:${level.locationId}`) ?? 0;
    const avgDailySales = totalSales / daysWindow;
    const dos = avgDailySales > 0 ? qty / avgDailySales : Infinity;

    for (const band of bands.slice(1)) {
      if (dos > band.min && dos <= band.max) {
        band.count++;
        band.qty += qty;
        break;
      }
    }
  }

  return bands.map(({ band, label, count, qty, colour }) => ({
    band,
    label,
    count,
    qty,
    colour,
  }));
}

// ── Overstock Ratio ───────────────────────────────────────────────────────────

export async function getOverstockRatio(weeksWindow = 12): Promise<number> {
  const bands = await getInventoryHealthBands(weeksWindow);
  const total = bands.reduce((s, b) => s + b.qty, 0);
  const overstockQty = bands.find((b) => b.band === "overstock")?.qty ?? 0;
  return total === 0 ? 0 : (overstockQty / total) * 100;
}

// ── GMROI ─────────────────────────────────────────────────────────────────────

/**
 * GMROI = gross margin / avg inventory cost.
 * Uses last 12 months of sales and current inventory value.
 */
export async function getGMROI(months = 12): Promise<number> {
  const since = subMonths(new Date(), months);

  // Gross margin = sum of (retailPrice - unitCost) × qty for sales
  const sales = await db.stockMovement.findMany({
    where: { type: "SALE", occurredAt: { gte: since } },
    include: {
      productVariant: {
        include: { product: { select: { retailPrice: true, unitCost: true } } },
      },
    },
  });

  const grossMargin = sales.reduce((s, m) => {
    const cost = Number(m.unitCost ?? m.productVariant.unitCost ?? m.productVariant.product.unitCost);
    const retail = Number(m.productVariant.product.retailPrice);
    return s + (retail - cost) * m.quantity;
  }, 0);

  // Avg inventory cost = current total value
  const levels = await db.inventoryLevel.findMany({
    where: { location: { isActive: true }, productVariant: { isActive: true } },
    include: {
      productVariant: {
        include: { product: { select: { unitCost: true } } },
      },
    },
  });

  const avgInventoryCost = levels.reduce((s, l) => {
    const cost = Number(l.productVariant.unitCost ?? l.productVariant.product.unitCost);
    return s + l.quantityOnHand * cost;
  }, 0);

  return avgInventoryCost === 0 ? 0 : grossMargin / avgInventoryCost;
}

// ── Weekly sales vs forecast trend ───────────────────────────────────────────

/**
 * Last N weeks of actual sales vs forecast demand.
 * Aggregated across all store locations.
 */
export async function getSalesvsForecastTrend(weeks = 12): Promise<
  { week: string; actual: number; forecast: number }[]
> {
  const now = new Date();
  const since = subWeeks(weekStart(now), weeks);

  const weeksArr = eachWeekOfInterval(
    { start: since, end: weekStart(now) },
    { weekStartsOn: 1 }
  );

  // Actual sales per week (all stores)
  const salesMovements = await db.stockMovement.findMany({
    where: {
      type: "SALE",
      occurredAt: { gte: since },
    },
    select: { quantity: true, occurredAt: true },
  });

  const salesByWeek = new Map<string, number>();
  for (const m of salesMovements) {
    const ws = weekStart(m.occurredAt).toISOString();
    salesByWeek.set(ws, (salesByWeek.get(ws) ?? 0) + m.quantity);
  }

  // Forecast demand per week (take actualDemand if populated, else forecastedDemand)
  const forecasts = await db.demandForecast.findMany({
    where: { periodStart: { gte: since } },
    select: { periodStart: true, forecastedDemand: true, actualDemand: true },
  });

  const forecastByWeek = new Map<string, number>();
  for (const f of forecasts) {
    const ws = new Date(f.periodStart).toISOString();
    const demand = f.actualDemand ?? Number(f.forecastedDemand);
    forecastByWeek.set(ws, (forecastByWeek.get(ws) ?? 0) + demand);
  }

  return weeksArr.map((w) => ({
    week: w.toISOString().slice(0, 10),
    actual: salesByWeek.get(w.toISOString()) ?? 0,
    forecast: Math.round(forecastByWeek.get(w.toISOString()) ?? 0),
  }));
}

// ── All KPIs at once ──────────────────────────────────────────────────────────

export interface KPISummary {
  fillRate: number;            // %
  inventoryTurnover: number;   // ratio
  avgDaysOfStock: number;      // days
  overstockRatio: number;      // %
  gmroi: number;               // ratio
  totalInventoryValue: number; // EUR
  totalCarryingCostToday: number; // EUR/day
}

export async function getKPISummary(): Promise<KPISummary> {
  const [
    fillRate,
    inventoryTurnover,
    avgDaysOfStock,
    overstockRatio,
    gmroi,
  ] = await Promise.all([
    getFillRate(),
    getInventoryTurnover(),
    getAverageDaysOfStock(),
    getOverstockRatio(),
    getGMROI(),
  ]);

  // Total inventory value at cost
  const levels = await db.inventoryLevel.findMany({
    where: { location: { isActive: true }, productVariant: { isActive: true } },
    include: {
      productVariant: {
        include: { product: { select: { unitCost: true } } },
      },
    },
  });

  const totalInventoryValue = levels.reduce((s, l) => {
    const cost = Number(l.productVariant.unitCost ?? l.productVariant.product.unitCost);
    return s + l.quantityOnHand * cost;
  }, 0);

  // Today's total carrying cost from latest snapshot
  const latestDate = await db.costRecord.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  let totalCarryingCostToday = 0;
  if (latestDate) {
    const agg = await db.costRecord.aggregate({
      where: { date: latestDate.date },
      _sum: { dailyCarryingCost: true },
    });
    totalCarryingCostToday = Number(agg._sum.dailyCarryingCost ?? 0);
  }

  return {
    fillRate,
    inventoryTurnover,
    avgDaysOfStock,
    overstockRatio,
    gmroi,
    totalInventoryValue,
    totalCarryingCostToday,
  };
}
