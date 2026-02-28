"use client";

import { useTransition } from "react";
import { resolveAllAlerts } from "@/server/actions/alerts";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export function ResolveAllButton() {
  const [isPending, startTransition] = useTransition();

  function handleResolveAll() {
    if (!confirm("Resolve all open alerts?")) return;
    startTransition(() => resolveAllAlerts());
  }

  return (
    <Button
      onClick={handleResolveAll}
      disabled={isPending}
      size="sm"
      variant="outline"
      className="gap-1.5 text-xs"
    >
      <CheckCircle className="w-3.5 h-3.5" />
      {isPending ? "Resolving…" : "Resolve All"}
    </Button>
  );
}
