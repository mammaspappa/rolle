import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrdersLoading() {
  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex gap-6">
          {["Order #", "Supplier", "Status", "Lines", "Total", "Expected", "By"].map((h) => (
            <Skeleton key={h} className="h-4 w-16" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`px-4 py-2.5 flex gap-6 items-center border-b border-slate-100 last:border-0 ${
              i % 2 !== 0 ? "bg-slate-50/40" : ""
            }`}
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
