import { db } from "@/server/db";
import {
  getKPISummary,
  getInventoryHealthBands,
  getAverageDaysOfStock,
} from "@/server/services/kpi.service";
import {
  getInventoryValueByLocation,
  getDailyCarryingCostTrend,
} from "@/server/services/cost-snapshot.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarryingCostChart } from "./CarryingCostChart";
import { ReportJobButtons } from "./ReportJobButtons";
import { format } from "date-fns";

// ── data ─────────────────────────────────────────────────────────────────────

async function getReportData() {
  const [kpis, healthBands, valueByLocation, carryingTrend, categoryRates] =
    await Promise.all([
      getKPISummary(),
      getInventoryHealthBands(),
      getInventoryValueByLocation(),
      getDailyCarryingCostTrend(30),
      db.categoryCarryingRate.findMany({ orderBy: { category: "asc" } }),
    ]);

  // Latest cost records grouped by location for the table
  const latestDate = await db.costRecord.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const costByLocation: {
    code: string;
    name: string;
    inventoryValue: number;
    dailyCarryingCost: number;
    annualProjectedCost: number;
  }[] = [];

  if (latestDate) {
    const records = await db.costRecord.findMany({
      where: { date: latestDate.date },
      include: { location: { select: { code: true, name: true } } },
    });

    const byLoc = new Map<
      string,
      { code: string; name: string; value: number; carry: number }
    >();
    for (const r of records) {
      const value = r.quantityOnHand * Number(r.unitCost);
      const carry = Number(r.dailyCarryingCost);
      const existing = byLoc.get(r.locationId);
      if (existing) {
        existing.value += value;
        existing.carry += carry;
      } else {
        byLoc.set(r.locationId, {
          code: r.location.code,
          name: r.location.name,
          value,
          carry,
        });
      }
    }

    for (const v of Array.from(byLoc.values())) {
      costByLocation.push({
        code: v.code,
        name: v.name,
        inventoryValue: v.value,
        dailyCarryingCost: v.carry,
        annualProjectedCost: v.carry * 365,
      });
    }
    costByLocation.sort((a, b) => b.inventoryValue - a.inventoryValue);
  }

  return {
    kpis,
    healthBands,
    valueByLocation,
    carryingTrend,
    categoryRates,
    costByLocation,
    snapshotDate: latestDate?.date ?? null,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(1)}k`;
  return `€${n.toFixed(2)}`;
}

function fmt(n: number, d = 1) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const d = await getReportData();

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cost tracking, KPI summary, and inventory health.
            {d.snapshotDate && (
              <span className="ml-2 text-slate-400">
                Latest snapshot: {format(new Date(d.snapshotDate), "d MMM yyyy")}
              </span>
            )}
          </p>
        </div>
        <ReportJobButtons />
      </div>

      {/* KPI summary */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          KPI Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Fill Rate", value: fmt(d.kpis.fillRate) + "%", note: "≥ 95% target" },
            { label: "Avg Days of Stock", value: d.kpis.avgDaysOfStock > 0 ? fmt(d.kpis.avgDaysOfStock, 0) + "d" : "—", note: "store lines" },
            { label: "Turnover", value: d.kpis.inventoryTurnover > 0 ? fmt(d.kpis.inventoryTurnover) + "×" : "—", note: "12-month rolling" },
            { label: "Overstock", value: fmt(d.kpis.overstockRatio) + "%", note: "qty > 90d DOS" },
            { label: "GMROI", value: d.kpis.gmroi > 0 ? fmt(d.kpis.gmroi) + "×" : "—", note: "gross margin / cost" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-400">{kpi.label}</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{kpi.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{kpi.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Carrying cost trend */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Daily Carrying Cost — Last 30 Days
        </h2>
        <Card>
          <CardContent className="pt-4">
            {d.carryingTrend.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No cost snapshots yet. Run a cost snapshot to populate this chart.
              </div>
            ) : (
              <CarryingCostChart data={d.carryingTrend} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Cost by location table */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Inventory Cost by Location
        </h2>
        {d.costByLocation.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg py-12 text-center text-slate-400 text-sm">
            No cost snapshot data. Run a cost snapshot first.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500">Location</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500">Inventory Value</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500">Daily Carry Cost</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500">Annual Projected</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500">Rate</th>
                </tr>
              </thead>
              <tbody>
                {d.costByLocation.map((row, i) => (
                  <tr
                    key={row.code}
                    className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-slate-600">{row.code}</span>
                      <span className="ml-2 text-slate-500">{row.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {fmtCurrency(row.inventoryValue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {fmtCurrency(row.dailyCarryingCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {fmtCurrency(row.annualProjectedCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {row.inventoryValue > 0
                        ? fmt((row.dailyCarryingCost * 365 / row.inventoryValue) * 100) + "%"
                        : "—"}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-slate-50 border-t border-slate-200 font-medium">
                  <td className="px-4 py-2.5 text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-right text-slate-900">
                    {fmtCurrency(d.costByLocation.reduce((s, r) => s + r.inventoryValue, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {fmtCurrency(d.costByLocation.reduce((s, r) => s + r.dailyCarryingCost, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {fmtCurrency(d.costByLocation.reduce((s, r) => s + r.annualProjectedCost, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Category carrying rates */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Category Carrying Rates
        </h2>
        {d.categoryRates.length === 0 ? (
          <p className="text-sm text-slate-400">No category rates configured.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {d.categoryRates.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-slate-700">{r.category}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {(Number(r.annualRate) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">annual carrying rate</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inventory health bands detail */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Inventory Health Breakdown
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {d.healthBands.map((b) => (
            <div
              key={b.band}
              className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-center"
            >
              <div className="w-3 h-3 rounded-sm mx-auto mb-2" style={{ backgroundColor: b.colour }} />
              <p className="text-xs text-slate-500">{b.label}</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{b.count}</p>
              <p className="text-xs text-slate-400">lines</p>
              <p className="text-xs text-slate-500 mt-1">{b.qty.toLocaleString()} units</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
