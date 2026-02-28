/**
 * Cost Snapshot Job — nightly carrying cost snapshot.
 */

import { Worker } from "bullmq";
import { bullConnection } from "./redis";
import { runCostSnapshot } from "@/server/services/cost-snapshot.service";

export function startCostSnapshotWorker() {
  const worker = new Worker(
    "cost-snapshot",
    async (job) => {
      console.log(`[cost-snapshot] starting job ${job.id}`);
      const written = await runCostSnapshot();
      console.log(`[cost-snapshot] wrote ${written} cost records`);
      return { written };
    },
    { connection: bullConnection, concurrency: 1 }
  );

  worker.on("completed", (job, result) => {
    console.log(`[cost-snapshot] job ${job.id} completed — ${result.written} rows`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[cost-snapshot] job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export { runCostSnapshot };
