/**
 * POST /api/jobs/trigger?job=demand-forecast|reorder-check
 *
 * Admin-only endpoint to manually trigger background jobs.
 * Runs the job synchronously (within the request) for simplicity in dev.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  runDemandForecasting,
  type ForecastAlgorithm,
} from "@/server/services/forecasting.service";
import { runReorderCheck } from "@/server/jobs/reorder-check.job";
import { runCostSnapshot } from "@/server/services/cost-snapshot.service";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const job = req.nextUrl.searchParams.get("job");

  switch (job) {
    case "demand-forecast": {
      const raw = req.nextUrl.searchParams.get("method");
      const method = raw ? (raw as ForecastAlgorithm) : undefined;
      const upserted = await runDemandForecasting(undefined, { method });
      return NextResponse.json({ job, upserted, method: method ?? "auto" });
    }
    case "reorder-check": {
      const result = await runReorderCheck();
      return NextResponse.json({ job, ...result });
    }
    case "cost-snapshot": {
      const written = await runCostSnapshot();
      return NextResponse.json({ job, written });
    }
    default:
      return NextResponse.json(
        { error: `Unknown job "${job}". Valid options: demand-forecast, reorder-check, cost-snapshot` },
        { status: 400 }
      );
  }
}
