import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Brand group */}
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: g === 0 ? 4 : g === 1 ? 3 : 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-4 flex items-center gap-4"
            >
              <Skeleton className="w-9 h-9 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-52" />
              </div>
              <div className="text-right space-y-1 shrink-0">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-24 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
