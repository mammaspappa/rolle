/**
 * Demand Forecast Job
 *
 * Processes jobs from the "demand-forecast" queue.
 * Calls the forecasting service to write DemandForecast rows for next week.
 */

import { Worker } from "bullmq";
import { bullConnection } from "./redis";
import { runDemandForecasting } from "@/server/services/forecasting.service";

export function startDemandForecastWorker() {
  const worker = new Worker(
    "demand-forecast",
    async (job) => {
      console.log(`[demand-forecast] starting job ${job.id}`);
      const count = await runDemandForecasting();
      console.log(`[demand-forecast] upserted ${count} forecast rows`);
      return { upserted: count };
    },
    { connection: bullConnection, concurrency: 1 }
  );

  worker.on("completed", (job, result) => {
    console.log(`[demand-forecast] job ${job.id} completed — ${result.upserted} rows`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[demand-forecast] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
