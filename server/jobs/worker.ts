/**
 * Background Worker Entry Point
 *
 * Run this in a separate process alongside the Next.js dev server:
 *   npx tsx server/jobs/worker.ts
 *
 * Or add to package.json scripts:
 *   "worker": "tsx server/jobs/worker.ts"
 *
 * In production, run this as a separate process / container.
 */

import { startDemandForecastWorker } from "./demand-forecast.job";
import { startReorderCheckWorker } from "./reorder-check.job";
import { startCostSnapshotWorker } from "./cost-snapshot.job";
import { startDataRetentionWorker } from "./data-retention.job";
import { demandForecastQueue, reorderCheckQueue, costSnapshotQueue, dataRetentionQueue } from "./queues";
import { redis } from "./redis";

console.log("[worker] starting Rolle background workers…");

// Start workers
const demandForecastWorker = startDemandForecastWorker();
const reorderCheckWorker = startReorderCheckWorker();
const costSnapshotWorker = startCostSnapshotWorker();
const dataRetentionWorker = startDataRetentionWorker();

const workers = [demandForecastWorker, reorderCheckWorker, costSnapshotWorker, dataRetentionWorker];

// Write last-run timestamps to Redis on completion
demandForecastWorker.on("completed", () => {
  redis.set("job:last-run:demand-forecast", new Date().toISOString());
});

reorderCheckWorker.on("completed", () => {
  redis.set("job:last-run:reorder-check", new Date().toISOString());
});

costSnapshotWorker.on("completed", () => {
  redis.set("job:last-run:cost-snapshot", new Date().toISOString());
});

dataRetentionWorker.on("completed", () => {
  redis.set("job:last-run:data-retention", new Date().toISOString());
});

// Schedule nightly jobs (run once at startup for development convenience)
// In production, use a proper scheduler (cron, BullMQ scheduler, etc.)
async function scheduleNightlyJobs() {
  // Remove any existing repeatable jobs and re-add them
  await demandForecastQueue.obliterate({ force: false });

  // Nightly at 02:00 UTC
  await demandForecastQueue.add("nightly-forecast", {}, {
    repeat: { pattern: "0 2 * * *" },
  });

  await reorderCheckQueue.add("nightly-reorder-check", {}, {
    repeat: { pattern: "0 3 * * *" },
  });

  await costSnapshotQueue.add("nightly-cost-snapshot", {}, {
    repeat: { pattern: "0 1 * * *" },
  });

  // Monthly at 04:00 UTC on the 1st of each month
  await dataRetentionQueue.add("monthly-data-retention", {}, {
    repeat: { pattern: "0 4 1 * *" },
  });

  console.log("[worker] nightly jobs scheduled (01:00 UTC cost snapshot, 02:00 UTC forecast, 03:00 UTC reorder check, 04:00 UTC 1st-of-month data retention)");
}

scheduleNightlyJobs().catch(console.error);

// Graceful shutdown
async function shutdown() {
  console.log("[worker] shutting down…");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
