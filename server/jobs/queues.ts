/**
 * BullMQ queue definitions.
 * Import queues here to enqueue jobs; import workers in worker.ts to process them.
 */

import { Queue } from "bullmq";
import { bullConnection } from "./redis";

export const demandForecastQueue = new Queue("demand-forecast", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const reorderCheckQueue = new Queue("reorder-check", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const costSnapshotQueue = new Queue("cost-snapshot", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

/** Enqueue a demand forecast run (optionally scoped to specific targets). */
export async function enqueueDemandForecast(data: Record<string, unknown> = {}) {
  return demandForecastQueue.add("run", data);
}

/** Enqueue a reorder check pass. */
export async function enqueueReorderCheck(data: Record<string, unknown> = {}) {
  return reorderCheckQueue.add("run", data);
}

/** Enqueue a nightly cost snapshot. */
export async function enqueueCostSnapshot(data: Record<string, unknown> = {}) {
  return costSnapshotQueue.add("run", data);
}
