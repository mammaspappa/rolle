import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      {/* Grid skeleton — header row + data rows */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="bg-slate-900 px-4 py-3 flex items-center gap-2">
          <Skeleton className="h-4 w-40 bg-slate-700" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-12 bg-slate-700 shrink-0" />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`px-4 py-2.5 flex items-center gap-2 border-b border-slate-100 last:border-0 ${
              i % 2 === 0 ? "bg-white" : "bg-slate-50"
            }`}
          >
            <div className="w-[200px] shrink-0 space-y-1">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: 10 }).map((_, j) => (
              <Skeleton key={j} className="h-6 w-12 rounded shrink-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
