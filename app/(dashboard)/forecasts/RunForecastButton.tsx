"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle } from "lucide-react";

export function RunForecastButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ upserted: number } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  function run() {
    setResult(null);
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/jobs/trigger?job=demand-forecast", {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Job failed");
        setResult(data);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {result && (
        <span className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="w-3.5 h-3.5" />
          {result.upserted} forecasts updated
        </span>
      )}
      <Button
        onClick={run}
        disabled={isPending}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Running…" : "Run Forecasts"}
      </Button>
    </div>
  );
}
