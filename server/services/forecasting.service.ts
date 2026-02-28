/**
 * Demand Forecasting Service
 *
 * Four algorithms in increasing order of complexity:
 *
 *  1. MOVING_AVG_12W — Weighted Moving Average (12-week window, linear weights)
 *  2. HOLT_WINTERS   — Triple Exponential Smoothing with additive seasonality (m=13 weeks)
 *  3. CROSTON_SBC    — Croston's method with Syntetos-Boylan Correction; for intermittent demand
 *  4. ENSEMBLE       — MAPE-weighted combination of all three; walk-forward hold-out evaluation
 *
 * Algorithm selection:
 *  - Pass `options.method` to force a specific algorithm for every target.
 *  - Omit `options.method` ("auto") to let `selectAlgorithm()` pick per-SKU per-location
 *    based on demand sparsity and history length.
 *
 * Called by the nightly BullMQ job and by POST /api/jobs/trigger?job=demand-forecast.
 */

import { db } from "@/server/db";
import { ForecastMethod } from "@prisma/client";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
  eachWeekOfInterval,
} from "date-fns";

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKS_WINDOW = 26; // history window fetched from DB (6 months)
const WMA_WINDOW   = 12; // WMA only uses the most-recent 12 of the 26 weeks
const HW_SEASON    = 13; // quarterly seasonal period (2 × 13 = 26 = 2 full cycles)
const HW_ALPHA     = 0.2; // Holt-Winters level smoothing
const HW_BETA      = 0.1; // Holt-Winters trend smoothing
const HW_GAMMA     = 0.3; // Holt-Winters seasonal smoothing
const CR_ALPHA     = 0.1; // Croston alpha (applied to both size and interval streams)
const ENS_HOLDOUT  = 4;  // weeks withheld for MAPE evaluation inside ENSEMBLE

// ── Public type ───────────────────────────────────────────────────────────────

export type ForecastAlgorithm =
  | "MOVING_AVG_12W"
  | "HOLT_WINTERS"
  | "CROSTON_SBC"
  | "ENSEMBLE";

// ── Date helpers ──────────────────────────────────────────────────────────────

function weekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 }); // Monday
}
function weekEnd(d: Date): Date {
  return endOfWeek(d, { weekStartsOn: 1 }); // Sunday
}

// ── Algorithm 1: Weighted Moving Average ─────────────────────────────────────

/**
 * Linear-weighted moving average.
 * Uses the last `WMA_WINDOW` values; oldest weight = 1, newest weight = n.
 */
function wma(values: number[]): number {
  const window = values.slice(-WMA_WINDOW);
  if (window.length === 0) return 0;
  let num = 0, den = 0;
  window.forEach((v, i) => {
    const w = i + 1;
    num += v * w;
    den += w;
  });
  return den === 0 ? 0 : num / den;
}

// ── Algorithm 2: Holt-Winters Triple Exponential Smoothing ───────────────────

/**
 * Additive Holt-Winters with seasonal period m = HW_SEASON (13 weeks).
 *
 * Requires values.length >= m * 2 (26 weeks); falls back to WMA otherwise.
 *
 * Init:
 *   Level  L = mean of first m observations
 *   Trend  T = 0 (insufficient data to estimate reliably with only 2 cycles)
 *   Season S[i] = values[i] - L  for i in [0, m)
 *
 * Recursion over values[m ..]:
 *   L_new     = α(D - S[i%m]) + (1-α)(L + T)
 *   T_new     = β(L_new - L)  + (1-β)T
 *   S[i%m]    = γ(D - L_new)  + (1-γ)S[i%m]
 *
 * Forecast h=1: L + T + S[n % m]
 */
function holtWinters(values: number[]): number {
  if (values.length < HW_SEASON * 2) {
    return wma(values);
  }

  const m = HW_SEASON;

  // Initialise
  let L = values.slice(0, m).reduce((a, b) => a + b, 0) / m;
  let T = 0;
  const S = values.slice(0, m).map((v) => v - L);

  // Run recursion over values[m ..]
  for (let i = m; i < values.length; i++) {
    const D = values[i];
    const si = i % m;
    const L_prev = L;
    L = HW_ALPHA * (D - S[si]) + (1 - HW_ALPHA) * (L + T);
    T = HW_BETA  * (L - L_prev) + (1 - HW_BETA)  * T;
    S[si] = HW_GAMMA * (D - L) + (1 - HW_GAMMA) * S[si];
  }

  return Math.max(0, L + T + S[values.length % m]);
}

// ── Algorithm 3: Croston's Method with Syntetos-Boylan Correction ─────────────

/**
 * Purpose-built for intermittent demand: weeks with zero sales are treated as
 * signals about the inter-demand interval, not as zero-demand observations.
 *
 * Two parallel exponential smoothing streams:
 *   z — smoothed demand SIZE  (updated only on non-zero observations)
 *   q — smoothed inter-demand INTERVAL (periods between non-zero obs)
 *
 * SBC bias correction (Syntetos & Boylan 2005):
 *   forecast = (z / q) × (1 − α/2)
 *
 * Returns 0 if there are no non-zero observations in history.
 */
function crostonSBC(values: number[]): number {
  const firstNonZero = values.findIndex((v) => v > 0);
  if (firstNonZero === -1) return 0;

  let z = values[firstNonZero]; // demand size estimate
  let q = firstNonZero + 1;    // inter-demand interval estimate
  let lastNonZero = firstNonZero;

  for (let i = firstNonZero + 1; i < values.length; i++) {
    if (values[i] > 0) {
      const interval = i - lastNonZero;
      z = CR_ALPHA * values[i] + (1 - CR_ALPHA) * z;
      q = CR_ALPHA * interval  + (1 - CR_ALPHA) * q;
      lastNonZero = i;
    }
  }

  return Math.max(0, (z / q) * (1 - CR_ALPHA / 2));
}

// ── Algorithm 4: MAPE-Weighted Ensemble ───────────────────────────────────────

/**
 * Walk-forward MAPE evaluation over the last ENS_HOLDOUT weeks.
 *
 * For each hold-out position k (0 … ENS_HOLDOUT-1):
 *   history = values[0 .. n-ENS_HOLDOUT+k]    (grows by 1 each step)
 *   actual  = values[n-ENS_HOLDOUT+k]
 *   Each sub-algorithm is run on `history` and its error is accumulated.
 *
 * Weights:  w_A = 1 / (MAPE_A + ε)   (ε = 0.01 avoids division by zero)
 *
 * Final forecast = weighted combination run on full history.
 * Also returns the mean normalised MAPE across all sub-algorithms as mapeScore.
 *
 * Falls back to WMA when values.length < ENS_HOLDOUT + 2.
 */
function ensembleForecast(values: number[]): { forecast: number; mapeScore: number } {
  const n = values.length;
  if (n < ENS_HOLDOUT + 2) {
    return { forecast: wma(values), mapeScore: 0 };
  }

  let errWma = 0, errHw = 0, errCr = 0;

  for (let k = 0; k < ENS_HOLDOUT; k++) {
    const cutoff = n - ENS_HOLDOUT + k;
    const history = values.slice(0, cutoff);
    const actual  = values[cutoff];

    const fWma = wma(history);
    const fHw  = holtWinters(history);
    const fCr  = crostonSBC(history);

    const denom = Math.max(actual, 1); // avoid /0 on zero-sales weeks
    errWma += Math.abs(actual - fWma) / denom;
    errHw  += Math.abs(actual - fHw)  / denom;
    errCr  += Math.abs(actual - fCr)  / denom;
  }

  const mapeWma = errWma / ENS_HOLDOUT;
  const mapeHw  = errHw  / ENS_HOLDOUT;
  const mapeCr  = errCr  / ENS_HOLDOUT;

  const EPS = 0.01;
  const wWma = 1 / (mapeWma + EPS);
  const wHw  = 1 / (mapeHw  + EPS);
  const wCr  = 1 / (mapeCr  + EPS);
  const wSum = wWma + wHw + wCr;

  const fWma = wma(values);
  const fHw  = holtWinters(values);
  const fCr  = crostonSBC(values);

  const forecast = (fWma * wWma + fHw * wHw + fCr * wCr) / wSum;
  const mapeScore = parseFloat(((mapeWma + mapeHw + mapeCr) / 3).toFixed(4));

  return { forecast: Math.max(0, forecast), mapeScore };
}

// ── Algorithm selector ────────────────────────────────────────────────────────

/**
 * Auto-selects the most appropriate algorithm for a given demand history.
 *
 * Rules (applied only when `force` is not supplied):
 *   zeroRate >= 0.5           → CROSTON_SBC  (majority of weeks have no sales)
 *   length >= HW_SEASON * 2  → HOLT_WINTERS (enough data for two seasonal cycles)
 *   otherwise                 → MOVING_AVG_12W (safe fallback)
 *
 * `ENSEMBLE` is only used when explicitly forced — it requires ENS_HOLDOUT + 2
 * data points and is computationally heavier.
 */
export function selectAlgorithm(
  values: number[],
  force?: ForecastAlgorithm
): ForecastAlgorithm {
  if (force) return force;

  const n = values.length;
  if (n === 0) return "MOVING_AVG_12W";

  const zeroRate = values.filter((v) => v === 0).length / n;

  if (zeroRate >= 0.5)         return "CROSTON_SBC";
  if (n >= HW_SEASON * 2)     return "HOLT_WINTERS";
  return "MOVING_AVG_12W";
}

// ── Confidence interval helper ────────────────────────────────────────────────

/** Sample standard deviation */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

interface ForecastTarget {
  productVariantId: string;
  locationId: string;
}

/**
 * Run demand forecasting for all active variant × location pairs (or a subset).
 * Writes results to the DemandForecast table via upsert.
 * Returns the number of rows upserted.
 *
 * @param targets   Subset of variant×location pairs to forecast; defaults to all.
 * @param options   `method` forces a specific algorithm for every target;
 *                  omit for automatic per-SKU selection.
 */
export async function runDemandForecasting(
  targets?: ForecastTarget[],
  options?: { method?: ForecastAlgorithm }
): Promise<number> {
  const now = new Date();
  const nextWeekStart = weekStart(addWeeks(now, 1));
  const nextWeekEnd   = weekEnd(addWeeks(now, 1));
  const windowStart   = subWeeks(weekStart(now), WEEKS_WINDOW);

  // Load all targets if none specified
  if (!targets) {
    const levels = await db.inventoryLevel.findMany({
      select: { productVariantId: true, locationId: true },
      distinct: ["productVariantId", "locationId"],
    });
    targets = levels;
  }
  if (targets.length === 0) return 0;

  // Batch-load all SALE movements in the window for all targets
  const variantIds  = Array.from(new Set(targets.map((t) => t.productVariantId)));
  const locationIds = Array.from(new Set(targets.map((t) => t.locationId)));

  const movements = await db.stockMovement.findMany({
    where: {
      type: "SALE",
      productVariantId: { in: variantIds },
      fromLocationId:   { in: locationIds },
      occurredAt: { gte: windowStart },
    },
    select: {
      productVariantId: true,
      fromLocationId:   true,
      quantity:         true,
      occurredAt:       true,
    },
  });

  // Check for MANUAL overrides for next week (skip those targets)
  const manualOverrides = await db.demandForecast.findMany({
    where: {
      productVariantId: { in: variantIds },
      locationId:       { in: locationIds },
      periodStart:      nextWeekStart,
      forecastMethod:   ForecastMethod.MANUAL,
    },
    select: { productVariantId: true, locationId: true },
  });
  const manualSet = new Set(
    manualOverrides.map((m) => `${m.productVariantId}:${m.locationId}`)
  );

  // Build weekly sales buckets: variantId → locationId → week-index → units
  const weeks = eachWeekOfInterval(
    { start: windowStart, end: weekStart(now) },
    { weekStartsOn: 1 }
  );
  const weekIndex = new Map(weeks.map((w, i) => [w.toISOString(), i]));

  type WeeklyMap = Map<string, Map<string, number[]>>;
  const weeklyUnits: WeeklyMap = new Map();

  for (const m of movements) {
    if (!m.fromLocationId) continue;
    const wk  = weekStart(m.occurredAt).toISOString();
    const idx = weekIndex.get(wk);
    if (idx === undefined) continue;

    if (!weeklyUnits.has(m.productVariantId))
      weeklyUnits.set(m.productVariantId, new Map());
    const locMap = weeklyUnits.get(m.productVariantId)!;

    if (!locMap.has(m.fromLocationId))
      locMap.set(m.fromLocationId, new Array(weeks.length).fill(0));

    locMap.get(m.fromLocationId)![idx] += m.quantity;
  }

  let upserted = 0;

  for (const { productVariantId, locationId } of targets) {
    if (manualSet.has(`${productVariantId}:${locationId}`)) continue;

    const values: number[] =
      weeklyUnits.get(productVariantId)?.get(locationId) ??
      new Array(weeks.length).fill(0);

    // Select and run algorithm
    const algorithm = selectAlgorithm(values, options?.method);

    let forecastedDemand: number;
    let mapeScore: number | null = null;

    if (algorithm === "ENSEMBLE") {
      const result = ensembleForecast(values);
      forecastedDemand = result.forecast;
      mapeScore = result.mapeScore;
    } else if (algorithm === "HOLT_WINTERS") {
      forecastedDemand = holtWinters(values);
    } else if (algorithm === "CROSTON_SBC") {
      forecastedDemand = crostonSBC(values);
    } else {
      forecastedDemand = wma(values);
    }

    const sd = stddev(values);
    const confidenceLow  = Math.max(0, forecastedDemand - sd);
    const confidenceHigh = forecastedDemand + sd;

    await db.demandForecast.upsert({
      where: {
        productVariantId_locationId_periodStart: {
          productVariantId,
          locationId,
          periodStart: nextWeekStart,
        },
      },
      create: {
        productVariantId,
        locationId,
        periodStart:      nextWeekStart,
        periodEnd:        nextWeekEnd,
        forecastedDemand,
        forecastMethod:   algorithm as ForecastMethod,
        confidenceLow,
        confidenceHigh,
        mapeScore,
      },
      update: {
        forecastedDemand,
        forecastMethod:   algorithm as ForecastMethod,
        confidenceLow,
        confidenceHigh,
        mapeScore,
        generatedAt:      new Date(),
      },
    });

    upserted++;
  }

  return upserted;
}

// ── Read helpers (unchanged) ───────────────────────────────────────────────────

/**
 * Get the most recent forecast for a variant × location, or null.
 */
export async function getLatestForecast(
  productVariantId: string,
  locationId: string
) {
  return db.demandForecast.findFirst({
    where: { productVariantId, locationId },
    orderBy: { periodStart: "desc" },
  });
}

/**
 * Get weekly sales history for a variant × location (last N weeks).
 */
export async function getWeeklySalesHistory(
  productVariantId: string,
  locationId: string,
  weeks = WEEKS_WINDOW
): Promise<{ weekStart: Date; units: number }[]> {
  const since = subWeeks(weekStart(new Date()), weeks);
  const movements = await db.stockMovement.findMany({
    where: {
      type: "SALE",
      productVariantId,
      fromLocationId: locationId,
      occurredAt: { gte: since },
    },
    select: { quantity: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });

  const buckets = new Map<string, number>();
  for (const m of movements) {
    const ws = weekStart(m.occurredAt).toISOString();
    buckets.set(ws, (buckets.get(ws) ?? 0) + m.quantity);
  }

  const allWeeks = eachWeekOfInterval(
    { start: since, end: weekStart(new Date()) },
    { weekStartsOn: 1 }
  );

  return allWeeks.map((w) => ({
    weekStart: w,
    units: buckets.get(w.toISOString()) ?? 0,
  }));
}
