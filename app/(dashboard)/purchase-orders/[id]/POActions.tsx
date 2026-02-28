"use client";

import { useTransition } from "react";
import { advancePOStatus, cancelPO } from "@/server/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Props {
  poId: string;
  canAdvance: boolean;
  nextLabel?: string;
  canCancel: boolean;
}

export function POActions({ poId, canAdvance, nextLabel, canCancel }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function advance() {
    startTransition(async () => {
      await advancePOStatus(poId);
      router.refresh();
    });
  }

  function cancel() {
    if (!confirm("Cancel this purchase order?")) return;
    startTransition(async () => {
      await cancelPO(poId);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {canAdvance && nextLabel && (
        <Button size="sm" onClick={advance} disabled={isPending}>
          {isPending ? "Updating…" : nextLabel}
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={cancel} disabled={isPending}>
          Cancel PO
        </Button>
      )}
    </div>
  );
}
