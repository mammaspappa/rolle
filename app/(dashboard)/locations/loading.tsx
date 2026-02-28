import { Skeleton } from "@/components/ui/skeleton";

export default function LocationsLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>
      {["Warehouse", "Tier A Stores", "Tier B Stores", "Tier C Stores"].map((group) => (
        <div key={group} className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
            {Array.from({ length: group === "Warehouse" ? 1 : group.includes("A") ? 6 : group.includes("B") ? 7 : 7 }).map((_, i) => (
              <div
                key={i}
                className={`px-4 py-2.5 flex items-center gap-4 border-b border-slate-100 last:border-0 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
