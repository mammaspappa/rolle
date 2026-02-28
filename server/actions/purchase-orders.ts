"use server";

import { db } from "@/server/db";
import { MovementType, PurchaseOrderStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return (session.user as { id: string; name: string }).id;
}

async function nextOrderNumber(prefix: string) {
  const count = await db.purchaseOrder.count();
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

export type POLineInput = {
  productVariantId: string;
  quantityOrdered: number;
  unitCost: number;
  currency: string;
};

export async function createPurchaseOrder(data: {
  supplierId: string;
  destinationId: string;
  expectedArrival?: string;
  currency: string;
  notes?: string;
  lines: POLineInput[];
}) {
  const userId = await getUser();
  if (data.lines.length === 0) throw new Error("At least one line required");

  const orderNumber = await nextOrderNumber("PO");
  const totalCost = data.lines.reduce(
    (sum, l) => sum + l.quantityOrdered * l.unitCost,
    0
  );

  const po = await db.purchaseOrder.create({
    data: {
      orderNumber,
      supplierId: data.supplierId,
      destinationId: data.destinationId,
      expectedArrival: data.expectedArrival ? new Date(data.expectedArrival) : null,
      currency: data.currency,
      totalCost,
      notes: data.notes,
      createdById: userId,
      status: PurchaseOrderStatus.DRAFT,
      lines: {
        create: data.lines.map((l) => ({
          productVariantId: l.productVariantId,
          quantityOrdered: l.quantityOrdered,
          unitCost: l.unitCost,
          currency: l.currency,
        })),
      },
    },
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${po.id}`);
}

export async function advancePOStatus(poId: string) {
  await getUser();

  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });

  const next: Record<string, PurchaseOrderStatus> = {
    DRAFT: PurchaseOrderStatus.SENT,
    SENT: PurchaseOrderStatus.CONFIRMED,
  };

  const nextStatus = next[po.status];
  if (!nextStatus) throw new Error(`Cannot advance from status ${po.status}`);

  await db.purchaseOrder.update({
    where: { id: poId },
    data: { status: nextStatus },
  });

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
}

export async function receivePOLines(
  poId: string,
  receipts: { lineId: string; quantityReceiving: number }[]
) {
  const userId = await getUser();

  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: { include: { productVariant: true } } },
  });

  if (!["CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new Error("PO must be CONFIRMED or PARTIALLY_RECEIVED to receive");
  }

  await db.$transaction(async (tx) => {
    for (const receipt of receipts) {
      if (receipt.quantityReceiving <= 0) continue;

      const line = po.lines.find((l) => l.id === receipt.lineId);
      if (!line) continue;

      const remaining = line.quantityOrdered - line.quantityReceived;
      const qty = Math.min(receipt.quantityReceiving, remaining);
      if (qty <= 0) continue;

      // Update line
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: qty } },
      });

      // Write movement + update inventory level
      await tx.stockMovement.create({
        data: {
          type: MovementType.PURCHASE_RECEIPT,
          productVariantId: line.productVariantId,
          toLocationId: po.destinationId,
          quantity: qty,
          unitCost: Number(line.unitCost),
          referenceType: "PurchaseOrder",
          referenceId: po.id,
          performedById: userId,
        },
      });

      await tx.inventoryLevel.upsert({
        where: {
          locationId_productVariantId: {
            locationId: po.destinationId,
            productVariantId: line.productVariantId,
          },
        },
        create: {
          locationId: po.destinationId,
          productVariantId: line.productVariantId,
          quantityOnHand: qty,
        },
        update: { quantityOnHand: { increment: qty } },
      });
    }

    // Determine new PO status
    const updatedLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: poId },
    });
    const allReceived = updatedLines.every(
      (l) => l.quantityReceived >= l.quantityOrdered
    );
    const anyReceived = updatedLines.some((l) => l.quantityReceived > 0);

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: allReceived
          ? PurchaseOrderStatus.COMPLETED
          : anyReceived
          ? PurchaseOrderStatus.PARTIALLY_RECEIVED
          : po.status,
        actualArrival: allReceived ? new Date() : undefined,
      },
    });
  });

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function cancelPO(poId: string) {
  await getUser();
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (["COMPLETED", "CANCELLED"].includes(po.status)) {
    throw new Error("Cannot cancel a completed or already cancelled PO");
  }
  await db.purchaseOrder.update({
    where: { id: poId },
    data: { status: PurchaseOrderStatus.CANCELLED },
  });
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
}
