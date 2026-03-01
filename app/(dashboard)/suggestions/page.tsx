import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { SuggestionForm } from "./SuggestionForm";
import Link from "next/link";
import { Lightbulb, ShieldCheck } from "lucide-react";

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

interface SessionUser { email?: string | null; role?: string }

export default async function SuggestionsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  // Fetch this user's own past submissions for context
  const mine = user?.email
    ? await db.suggestion.findMany({
        where: { submittedBy: { email: user.email } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, area: true, title: true, priority: true,
          status: true, adminNote: true, createdAt: true,
        },
      })
    : [];

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h1 className="text-2xl font-semibold text-slate-900">Suggestions</h1>
          </div>
          <p className="text-sm text-slate-500">
            Share ideas for improving the platform. All suggestions are reviewed by the team.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/suggestions"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2.5 py-1.5 bg-white shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Review all
          </Link>
        )}
      </div>

      {/* Submission form */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">New suggestion</h2>
        <SuggestionForm />
      </div>

      {/* User's own past submissions */}
      {mine.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Your submissions</h2>
          <div className="space-y-2">
            {mine.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-lg px-4 py-3 space-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {AREA_LABEL[s.area] ?? s.area}
                      </span>
                      <span className={`text-xs ${PRIORITY_STYLE[s.priority]}`}>
                        {PRIORITY_LABEL[s.priority]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-1">{s.title}</p>
                    {s.adminNote && (
                      <p className="text-xs text-slate-500 mt-1 italic">
                        Team note: {s.adminNote}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status]}`}
                  >
                    {s.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(s.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
