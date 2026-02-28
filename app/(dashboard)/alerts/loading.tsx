import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Severity groups */}
      {["CRITICAL", "WARNING", "INFO"].map((severity) => (
        <div key={severity} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: severity === "CRITICAL" ? 2 : severity === "WARNING" ? 4 : 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-4 flex items-start gap-3"
            >
              <Skeleton className="w-4 h-4 rounded-full mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-7 w-20 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
