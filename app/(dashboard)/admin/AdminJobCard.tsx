"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  jobKey: string;
  label: string;
  description: string;
  schedule: string;
  lastRun: string | null;
}

type Status = "idle" | "running" | "done" | "error";

export function AdminJobCard({ jobKey, label, description, schedule, lastRun }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);

  async function handleRunNow() {
    setStatus("running");
    setResult(null);
    try {
      const res = await fetch(`/api/jobs/trigger?job=${jobKey}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setResult(data.error ?? "Unknown error");
        return;
      }
      setStatus("done");
      // Build a human-readable summary from the response
      const parts: string[] = [];
      if ("upserted" in data) parts.push(`${data.upserted} forecasts written`);
      if ("alerts" in data && "pos" in data) {
        parts.push(`${data.alerts} alerts, ${data.pos} POs, ${data.tos} TOs`);
      } else if ("alerts" in data) {
        parts.push(`${data.alerts} alerts purged`);
      }
      if ("written" in data) parts.push(`${data.written} records written`);
      if ("forecasts" in data) parts.push(`${data.forecasts} forecasts purged`);
      if ("costRecords" in data) parts.push(`${data.costRecords} cost records purged`);
      setResult(parts.length > 0 ? parts.join(", ") : "Completed");
    } catch {
      setStatus("error");
      setResult("Network error");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleRunNow}
            disabled={status === "running"}
            className="shrink-0"
          >
            {status === "running" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            Run Now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Schedule:</span>
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{schedule}</code>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Last run: </span>
          {lastRun
            ? formatDistanceToNow(new Date(lastRun), { addSuffix: true })
            : "Never"}
        </div>
        {result && (
          <div className={[
            "flex items-center gap-1.5 text-xs mt-2 p-2 rounded",
            status === "done" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
          ].join(" ")}>
            {status === "done" ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            {result}
          </div>
        )}
        {status === "running" && (
          <Badge variant="secondary" className="text-xs">Running…</Badge>
        )}
      </CardContent>
    </Card>
  );
}
