"use client";

import { useActionState } from "react";
import { submitSuggestion } from "@/server/actions/suggestions";

const AREAS = [
  { value: "INVENTORY",       label: "Inventory" },
  { value: "FORECASTS",       label: "Forecasts" },
  { value: "ALLOCATION",      label: "Allocation" },
  { value: "ALERTS",          label: "Alerts" },
  { value: "REPORTS",         label: "Reports" },
  { value: "PURCHASE_ORDERS", label: "Purchase Orders" },
  { value: "TRANSFER_ORDERS", label: "Transfer Orders" },
  { value: "OTHER",           label: "Other" },
] as const;

const PRIORITIES = [
  { value: "1", label: "Low — nice to have" },
  { value: "2", label: "Medium — would improve workflow" },
  { value: "3", label: "High — causes friction regularly" },
  { value: "4", label: "Critical — blocking my work" },
] as const;

type State = { success: true } | { error: string } | null;

export function SuggestionForm() {
  const [state, action, pending] = useActionState(submitSuggestion, null as State);

  if (state && "success" in state) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center space-y-2">
        <p className="text-green-800 font-semibold">Suggestion submitted — thank you!</p>
        <p className="text-sm text-green-700">
          Your idea has been logged and will be reviewed by the team.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-green-700 underline underline-offset-2 hover:text-green-900"
        >
          Submit another suggestion
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state && "error" in state && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {"error" in state ? state.error : ""}
        </p>
      )}

      {/* Platform area */}
      <div className="space-y-1.5">
        <label htmlFor="area" className="block text-sm font-medium text-slate-700">
          Platform area <span className="text-red-500">*</span>
        </label>
        <select
          id="area"
          name="area"
          required
          defaultValue=""
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="" disabled>Select the area this relates to…</option>
          {AREAS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Short title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={5}
          maxLength={120}
          placeholder="e.g. Add export to CSV on the forecasts page"
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Describe the improvement, the problem it solves, and any ideas you have for how it could work…"
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
        />
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Priority <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRIORITIES.map((p) => (
            <label
              key={p.value}
              className="flex items-center gap-2.5 border border-slate-200 rounded-md px-3 py-2 text-sm cursor-pointer hover:border-slate-400 has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50 transition-colors"
            >
              <input
                type="radio"
                name="priority"
                value={p.value}
                defaultChecked={p.value === "3"}
                className="accent-slate-800"
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto px-6 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Submitting…" : "Submit suggestion"}
      </button>
    </form>
  );
}
