"use client";

import { useTransition } from "react";
import { approveTransferOrder, shipTransferOrder, cancelTransferOrder } from "@/server/actions/transfer-orders";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Props { toId: string; canApprove: boolean; canShip: boolean; canCancel: boolean }

export function TOActions({ toId, canApprove, canShip, canCancel }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function approve() {
    startTransition(async () => { await approveTransferOrder(toId); router.refresh(); });
  }
  function ship() {
    if (!confirm("Mark this transfer as shipped? Stock will be deducted from the source location.")) return;
    startTransition(async () => { await shipTransferOrder(toId); router.refresh(); });
  }
  function cancel() {
    if (!confirm("Cancel this transfer order?")) return;
    startTransition(async () => { await cancelTransferOrder(toId); router.refresh(); });
  }

  return (
    <div className="flex gap-2">
      {canApprove && <Button size="sm" onClick={approve} disabled={isPending}>Approve</Button>}
      {canShip && <Button size="sm" onClick={ship} disabled={isPending}>Mark as Shipped</Button>}
      {canCancel && (
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={cancel} disabled={isPending}>
          Cancel
        </Button>
      )}
    </div>
  );
}
