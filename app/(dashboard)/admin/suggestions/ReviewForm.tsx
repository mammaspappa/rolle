"use client";

import { useActionState } from "react";
import { reviewSuggestion } from "@/server/actions/suggestions";

type State = { success?: true; error?: string } | null;

interface Props {
  id: string;
  currentStatus: string;
  currentNote: string | null;
}

export function ReviewForm({ id, currentStatus, currentNote }: Props) {
  const [state, action, pending] = useActionState(reviewSuggestion, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />

      <select
        name="status"
        defaultValue={currentStatus}
        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
      >
        <option value="OPEN">Open</option>
        <option value="UNDER_REVIEW">Under Review</option>
        <option value="PLANNED">Planned</option>
        <option value="REJECTED">Rejected</option>
      </select>

      <textarea
        name="adminNote"
        defaultValue={currentNote ?? ""}
        rows={2}
        placeholder="Optional note visible to submitter…"
        className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
      />

      {state && "error" in state && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-xs text-green-600">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="text-xs px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
