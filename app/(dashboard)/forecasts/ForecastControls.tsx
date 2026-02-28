"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Algorithm = "auto" | "MOVING_AVG_12W" | "HOLT_WINTERS" | "CROSTON_SBC" | "ENSEMBLE";

const ALGORITHM_LABELS: Record<Algorithm, string> = {
  auto:           "Auto-select",
  MOVING_AVG_12W: "WMA (12-week)",
  HOLT_WINTERS:   "Holt-Winters",
  CROSTON_SBC:    "Croston SBC",
  ENSEMBLE:       "Ensemble",
};

export function ForecastControls() {
  const [algorithm, setAlgorithm] = useState<Algorithm>("auto");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ upserted: number; method: string } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  function run() {
    setResult(null);
    setError("");
    startTransition(async () => {
      try {
        const url =
          algorithm === "auto"
            ? "/api/jobs/trigger?job=demand-forecast"
            : `/api/jobs/trigger?job=demand-forecast&method=${algorithm}`;
        const res  = await fetch(url, { method: "POST" });
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
          {result.method && result.method !== "auto" && (
            <span className="text-slate-400 ml-1">· {ALGORITHM_LABELS[result.method as Algorithm] ?? result.method}</span>
          )}
        </span>
      )}
      <Select
        value={algorithm}
        onValueChange={(v) => setAlgorithm(v as Algorithm)}
        disabled={isPending}
      >
        <SelectTrigger className="w-40 h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(ALGORITHM_LABELS) as [Algorithm, string][]).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={run} disabled={isPending} size="sm" variant="outline">
        <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Running…" : "Run Forecasts"}
      </Button>
    </div>
  );
}
