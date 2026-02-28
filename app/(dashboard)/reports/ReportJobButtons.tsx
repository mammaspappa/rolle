"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle } from "lucide-react";

export function ReportJobButtons() {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  function runSnapshot() {
    setDone(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/jobs/trigger?job=cost-snapshot", { method: "POST" });
        if (res.ok) {
          setDone(true);
          router.refresh();
        }
      } catch {
        // silently fail
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {done && (
        <span className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="w-3.5 h-3.5" />
          Snapshot complete
        </span>
      )}
      <Button
        onClick={runSnapshot}
        disabled={isPending}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Running…" : "Run Cost Snapshot"}
      </Button>
    </div>
  );
}
