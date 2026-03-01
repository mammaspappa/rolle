import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ReviewForm } from "./ReviewForm";
import { Lightbulb } from "lucide-react";

interface SessionUser { role?: string }

const AREA_LABEL: Record<string, string> = {
  INVENTORY: "Inventory", FORECASTS: "Forecasts", ALLOCATION: "Allocation",
  ALERTS: "Alerts", REPORTS: "Reports", PURCHASE_ORDERS: "Purchase Orders",
  TRANSFER_ORDERS: "Transfer Orders", OTHER: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN:         "bg-slate-100 text-slate-600",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  PLANNED:      "bg-green-100 text-green-700",
  REJECTED:     "bg-red-100 text-red-600",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "Low", 2: "Medium", 3: "High", 4: "Critical",
};
const PRIORITY_STYLE: Record<number, string> = {
  1: "text-slate-400", 2: "text-slate-600", 3: "text-amber-600 font-medium", 4: "text-red-600 font-semibold",
};

const AREA_FILTER_OPTIONS = [
  "ALL", "INVENTORY", "FORECASTS", "ALLOCATION", "ALERTS",
  "REPORTS", "PURCHASE_ORDERS", "TRANSFER_ORDERS", "OTHER",
] as const;
type AreaFilter = (typeof AREA_FILTER_OPTIONS)[number];

const STATUS_FILTER_OPTIONS = ["ALL", "OPEN", "UNDER_REVIEW", "PLANNED", "REJECTED"] as const;
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number];

export default async function AdminSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;
  if (role !== "ADMIN") redirect("/");

  const { area: areaParam, status: statusParam } = await searchParams;
  const areaFilter = (AREA_FILTER_OPTIONS.includes(areaParam as AreaFilter)
    ? areaParam
    : "ALL") as AreaFilter;
  const statusFilter = (STATUS_FILTER_OPTIONS.includes(statusParam as StatusFilter)
    ? statusParam
    : "ALL") as StatusFilter;

  const suggestions = await db.suggestion.findMany({
    where: {
      ...(areaFilter !== "ALL" ? { area: areaFilter as never } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter as never } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      submittedBy: { select: { name: true, email: true, role: true } },
    },
  });

  const counts = await db.suggestion.groupBy({
    by: ["status"],
    _count: true,
  });
  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h1 className="text-2xl font-bold tracking-tight">Suggestions — Admin Review</h1>
      </div>

      {/* Status summary strip */}
      <div className="flex gap-3 flex-wrap text-xs">
        {["OPEN", "UNDER_REVIEW", "PLANNED", "REJECTED"].map((s) => (
          <div key={s} className={`px-3 py-1.5 rounded-full font-medium ${STATUS_STYLE[s]}`}>
            {s.replace(/_/g, " ")}: {countByStatus[s] ?? 0}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-slate-500 self-center">Area:</span>
        {AREA_FILTER_OPTIONS.map((a) => (
          <a
            key={a}
            href={`/admin/suggestions?area=${a}&status=${statusFilter}`}
            className={`px-2.5 py-1 rounded-md border transition-colors ${
              areaFilter === a
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            {a === "ALL" ? "All areas" : (AREA_LABEL[a] ?? a)}
          </a>
        ))}
        <span className="text-slate-300 self-center">|</span>
        <span className="text-slate-500 self-center">Status:</span>
        {STATUS_FILTER_OPTIONS.map((s) => (
          <a
            key={s}
            href={`/admin/suggestions?area=${areaFilter}&status=${s}`}
            className={`px-2.5 py-1 rounded-md border transition-colors ${
              statusFilter === s
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
          </a>
        ))}
      </div>

      {/* Suggestion list */}
      {suggestions.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-8 text-center">
          No suggestions match the current filters.
        </p>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
            >
              {/* Meta row */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {AREA_LABEL[s.area] ?? s.area}
                  </span>
                  <span className={PRIORITY_STYLE[s.priority]}>
                    {PRIORITY_LABEL[s.priority]} priority
                  </span>
                  <span className="text-slate-400">
                    by {s.submittedBy.name} ({s.submittedBy.role.replace(/_/g, " ")})
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">
                    {new Date(s.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status]}`}>
                  {s.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Content */}
              <div>
                <p className="font-semibold text-slate-800">{s.title}</p>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{s.description}</p>
              </div>

              {/* Review form */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500 mb-2 font-medium">Review</p>
                <ReviewForm
                  id={s.id}
                  currentStatus={s.status}
                  currentNote={s.adminNote}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
