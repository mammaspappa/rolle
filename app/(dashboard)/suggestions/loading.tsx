import { Skeleton } from "@/components/ui/skeleton";

export default function SuggestionsLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}
