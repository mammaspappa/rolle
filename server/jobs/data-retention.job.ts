/**
 * Data Retention Job
 *
 * Purges old rows that are no longer needed:
 *  - Resolved Alerts older than 90 days
 *  - DemandForecast rows with periodStart older than 18 months
 *  - CostRecord rows with date older than 2 years
 *
 * StockMovement is NEVER deleted (immutable financial ledger).
 */

import { Worker } from "bullmq";
import { db } from "@/server/db";
import { bullConnection } from "./redis";
import { subDays, subMonths, subYears } from "date-fns";

export async function runDataRetention(): Promise<{
  alerts: number;
  forecasts: number;
  costRecords: number;
}> {
  const now = new Date();

  const [alerts, forecasts, costRecords] = await Promise.all([
    db.alert.deleteMany({
      where: {
        isResolved: true,
        createdAt: { lt: subDays(now, 90) },
      },
    }),
    db.demandForecast.deleteMany({
      where: {
        periodStart: { lt: subMonths(now, 18) },
      },
    }),
    db.costRecord.deleteMany({
      where: {
        date: { lt: subYears(now, 2) },
      },
    }),
  ]);

  console.log(
    `[data-retention] purged: ${alerts.count} alerts, ${forecasts.count} forecasts, ${costRecords.count} cost records`
  );

  return {
    alerts: alerts.count,
    forecasts: forecasts.count,
    costRecords: costRecords.count,
  };
}

export function startDataRetentionWorker() {
  const worker = new Worker(
    "data-retention",
    async (job) => {
      console.log(`[data-retention] starting job ${job.id}`);
      const result = await runDataRetention();
      return result;
    },
    { connection: bullConnection, concurrency: 1 }
  );

  worker.on("completed", (job, result) => {
    console.log(`[data-retention] job ${job.id} completed`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[data-retention] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
