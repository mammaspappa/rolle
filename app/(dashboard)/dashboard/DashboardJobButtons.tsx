"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle } from "lucide-react";

export function DashboardJobButtons() {
  const [isPending, startTransition] = useTransition();
  const [lastRun, setLastRun] = useState("");
  const router = useRouter();

  async function triggerJob(job: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/jobs/trigger?job=${job}`, { method: "POST" });
        if (res.ok) {
          setLastRun(job);
          router.refresh();
        }
      } catch {
        // silently fail
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {lastRun && (
        <span className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="w-3.5 h-3.5" />
          {lastRun} done
        </span>
      )}
      <Button
        onClick={() => triggerJob("cost-snapshot")}
        disabled={isPending}
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
        Snapshot
      </Button>
      <Button
        onClick={() => triggerJob("reorder-check")}
        disabled={isPending}
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
        Reorder Check
      </Button>
    </div>
  );
}
