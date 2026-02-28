"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RunReorderButton() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string>("");
  const router = useRouter();

  function run() {
    setSummary("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/jobs/trigger?job=reorder-check", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
          setSummary(`+${data.alerts} alerts, ${data.pos} POs, ${data.tos} TOs`);
          router.refresh();
        }
      } catch {
        // silently fail
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {summary && <span className="text-xs text-slate-500">{summary}</span>}
      <Button
        onClick={run}
        disabled={isPending}
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Running…" : "Reorder Check"}
      </Button>
    </div>
  );
}
