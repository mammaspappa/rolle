import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { redis } from "@/server/jobs/redis";
import { AdminJobCard } from "./AdminJobCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface SessionUser {
  name?: string | null;
  email?: string | null;
  role?: string;
}

async function checkDbHealth(): Promise<"ok" | "error"> {
  try {
    await db.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedisHealth(): Promise<"ok" | "error"> {
  try {
    const pong = await redis.ping();
    return pong === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;
  if (role !== "ADMIN") redirect("/");

  const [
    dbHealth,
    redisHealth,
    productCount,
    variantCount,
    movementCount,
    forecastCount,
    costRecordCount,
    openAlertCount,
    resolvedAlertCount,
    lastRuns,
  ] = await Promise.all([
    checkDbHealth(),
    checkRedisHealth(),
    db.product.count(),
    db.productVariant.count(),
    db.stockMovement.count(),
    db.demandForecast.count(),
    db.costRecord.count(),
    db.alert.count({ where: { isResolved: false } }),
    db.alert.count({ where: { isResolved: true } }),
    redis.mget(
      "job:last-run:demand-forecast",
      "job:last-run:reorder-check",
      "job:last-run:cost-snapshot",
      "job:last-run:data-retention"
    ),
  ]);

  const [lastForecast, lastReorder, lastCostSnapshot, lastDataRetention] = lastRuns;

  const stats = [
    { label: "Products", value: productCount },
    { label: "Variants", value: variantCount },
    { label: "Stock Movements", value: movementCount },
    { label: "Forecasts", value: forecastCount },
    { label: "Cost Records", value: costRecordCount },
    { label: "Open Alerts", value: openAlertCount },
    { label: "Resolved Alerts", value: resolvedAlertCount },
  ];

  const jobs = [
    {
      jobKey: "demand-forecast",
      label: "Demand Forecast",
      description: "Runs WMA + exponential smoothing to produce weekly demand forecasts for all variants.",
      schedule: "0 2 * * * (nightly 02:00 UTC)",
      lastRun: lastForecast,
    },
    {
      jobKey: "reorder-check",
      label: "Reorder Check",
      description: "Scans inventory levels and creates STOCKOUT/LOW_STOCK alerts and draft POs/TOs.",
      schedule: "0 3 * * * (nightly 03:00 UTC)",
      lastRun: lastReorder,
    },
    {
      jobKey: "cost-snapshot",
      label: "Cost Snapshot",
      description: "Takes a daily snapshot of carrying costs and inventory value by location.",
      schedule: "0 1 * * * (nightly 01:00 UTC)",
      lastRun: lastCostSnapshot,
    },
    {
      jobKey: "data-retention",
      label: "Data Retention",
      description: "Purges resolved alerts (>90d), old forecasts (>18mo), and old cost records (>2yr).",
      schedule: "0 4 1 * * (monthly 04:00 UTC, 1st of month)",
      lastRun: lastDataRetention,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">System health, database statistics, and job management.</p>
      </div>

      {/* Health Strip */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">System Health</h2>
        <div className="flex gap-3 flex-wrap">
          <HealthBadge label="PostgreSQL" status={dbHealth} />
          <HealthBadge label="Redis" status={redisHealth} />
        </div>
      </section>

      {/* DB Stats */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Database Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.map(({ label, value }) => (
            <Card key={label} className="py-4">
              <CardContent className="px-4 py-0 text-center">
                <div className="text-2xl font-bold">{value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Job Cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Background Jobs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <AdminJobCard key={job.jobKey} {...job} />
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthBadge({ label, status }: { label: string; status: "ok" | "error" }) {
  return (
    <div className={[
      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
      status === "ok"
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-red-50 border-red-200 text-red-700",
    ].join(" ")}>
      {status === "ok" ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      {label}
      <Badge variant={status === "ok" ? "outline" : "destructive"} className="text-xs ml-1">
        {status}
      </Badge>
    </div>
  );
}
