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
import { demandForecastQueue, reorderCheckQueue, costSnapshotQueue } from "./queues";

console.log("[worker] starting Rolle background workers…");

// Start workers
const workers = [
  startDemandForecastWorker(),
  startReorderCheckWorker(),
  startCostSnapshotWorker(),
];

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

  console.log("[worker] nightly jobs scheduled (01:00 UTC cost snapshot, 02:00 UTC forecast, 03:00 UTC reorder check)");
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
