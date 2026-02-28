"use server";

import { db } from "@/server/db";
import { MovementType, TransferOrderStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return (session.user as { id: string }).id;
}

async function nextTONumber() {
  const count = await db.transferOrder.count();
  return `TO-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

export type TOLineInput = {
  productVariantId: string;
  quantityRequested: number;
  unitCost: number;
};

export async function createTransferOrder(data: {
  fromLocationId: string;
  toLocationId: string;
  expectedArrival?: string;
  notes?: string;
  lines: TOLineInput[];
}) {
  const userId = await getUser();
  if (data.lines.length === 0) throw new Error("At least one line required");
  if (data.fromLocationId === data.toLocationId) {
    throw new Error("Source and destination must be different");
  }

  const orderNumber = await nextTONumber();

  const to = await db.transferOrder.create({
    data: {
      orderNumber,
      fromLocationId: data.fromLocationId,
      toLocationId: data.toLocationId,
      expectedArrival: data.expectedArrival ? new Date(data.expectedArrival) : null,
      notes: data.notes,
      requestedById: userId,
      status: TransferOrderStatus.REQUESTED,
      lines: {
        create: data.lines.map((l) => ({
          productVariantId: l.productVariantId,
          quantityRequested: l.quantityRequested,
          unitCost: l.unitCost,
        })),
      },
    },
  });

  revalidatePath("/transfer-orders");
  redirect(`/transfer-orders/${to.id}`);
}

export async function approveTransferOrder(toId: string) {
  const userId = await getUser();

  const to = await db.transferOrder.findUniqueOrThrow({
    where: { id: toId },
    include: { lines: true },
  });

  if (to.status !== TransferOrderStatus.REQUESTED) {
    throw new Error("Only REQUESTED orders can be approved");
  }

  await db.$transaction(async (tx) => {
    // Reserve stock at source
    for (const line of to.lines) {
      await tx.inventoryLevel.update({
        where: {
          locationId_productVariantId: {
            locationId: to.fromLocationId,
            productVariantId: line.productVariantId,
          },
        },
        data: { quantityReserved: { increment: line.quantityRequested } },
      });
    }

    await tx.transferOrder.update({
      where: { id: toId },
      data: {
        status: TransferOrderStatus.APPROVED,
        approvedById: userId,
      },
    });
  });

  revalidatePath(`/transfer-orders/${toId}`);
  revalidatePath("/transfer-orders");
}

export async function shipTransferOrder(toId: string) {
  const userId = await getUser();

  const to = await db.transferOrder.findUniqueOrThrow({
    where: { id: toId },
    include: { lines: { include: { productVariant: true } } },
  });

  if (to.status !== TransferOrderStatus.APPROVED) {
    throw new Error("Only APPROVED orders can be shipped");
  }

  await db.$transaction(async (tx) => {
    for (const line of to.lines) {
      const qty = line.quantityRequested;

      // Deduct from source: reduce onHand and reserved
      await tx.inventoryLevel.update({
        where: {
          locationId_productVariantId: {
            locationId: to.fromLocationId,
            productVariantId: line.productVariantId,
          },
        },
        data: {
          quantityOnHand: { decrement: qty },
          quantityReserved: { decrement: qty },
        },
      });

      // Add to in-transit at destination
      await tx.inventoryLevel.upsert({
        where: {
          locationId_productVariantId: {
            locationId: to.toLocationId,
            productVariantId: line.productVariantId,
          },
        },
        create: {
          locationId: to.toLocationId,
          productVariantId: line.productVariantId,
          quantityInTransit: qty,
        },
        update: { quantityInTransit: { increment: qty } },
      });

      // Write TRANSFER_OUT movement
      await tx.stockMovement.create({
        data: {
          type: MovementType.TRANSFER_OUT,
          productVariantId: line.productVariantId,
          fromLocationId: to.fromLocationId,
          toLocationId: to.toLocationId,
          quantity: qty,
          unitCost: Number(line.unitCost),
          referenceType: "TransferOrder",
          referenceId: to.id,
          performedById: userId,
        },
      });

      await tx.transferOrderLine.update({
        where: { id: line.id },
        data: { quantityShipped: qty },
      });
    }

    await tx.transferOrder.update({
      where: { id: toId },
      data: { status: TransferOrderStatus.IN_TRANSIT },
    });
  });

  revalidatePath(`/transfer-orders/${toId}`);
  revalidatePath("/transfer-orders");
  revalidatePath("/inventory");
}

export async function receiveTOLines(
  toId: string,
  receipts: { lineId: string; quantityReceiving: number }[]
) {
  const userId = await getUser();

  const to = await db.transferOrder.findUniqueOrThrow({
    where: { id: toId },
    include: { lines: true },
  });

  if (!["IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(to.status)) {
    throw new Error("TO must be IN_TRANSIT or PARTIALLY_RECEIVED to receive");
  }

  await db.$transaction(async (tx) => {
    for (const receipt of receipts) {
      if (receipt.quantityReceiving <= 0) continue;
      const line = to.lines.find((l) => l.id === receipt.lineId);
      if (!line) continue;

      const remaining = line.quantityShipped - line.quantityReceived;
      const qty = Math.min(receipt.quantityReceiving, remaining);
      if (qty <= 0) continue;

      // Add to destination on-hand, remove from in-transit
      await tx.inventoryLevel.update({
        where: {
          locationId_productVariantId: {
            locationId: to.toLocationId,
            productVariantId: line.productVariantId,
          },
        },
        data: {
          quantityOnHand: { increment: qty },
          quantityInTransit: { decrement: qty },
        },
      });

      await tx.stockMovement.create({
        data: {
          type: MovementType.TRANSFER_IN,
          productVariantId: line.productVariantId,
          fromLocationId: to.fromLocationId,
          toLocationId: to.toLocationId,
          quantity: qty,
          unitCost: Number(line.unitCost),
          referenceType: "TransferOrder",
          referenceId: to.id,
          performedById: userId,
        },
      });

      await tx.transferOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: qty } },
      });
    }

    const updatedLines = await tx.transferOrderLine.findMany({
      where: { transferOrderId: toId },
    });
    const allReceived = updatedLines.every(
      (l) => l.quantityReceived >= l.quantityShipped
    );

    await tx.transferOrder.update({
      where: { id: toId },
      data: {
        status: allReceived
          ? TransferOrderStatus.COMPLETED
          : TransferOrderStatus.PARTIALLY_RECEIVED,
        actualArrival: allReceived ? new Date() : undefined,
      },
    });
  });

  revalidatePath(`/transfer-orders/${toId}`);
  revalidatePath("/transfer-orders");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function cancelTransferOrder(toId: string) {
  const userId = await getUser();

  const to = await db.transferOrder.findUniqueOrThrow({
    where: { id: toId },
    include: { lines: true },
  });

  if (["COMPLETED", "CANCELLED", "IN_TRANSIT"].includes(to.status)) {
    throw new Error("Cannot cancel a completed, in-transit, or already cancelled order");
  }

  await db.$transaction(async (tx) => {
    // Release reserved stock if approved
    if (to.status === TransferOrderStatus.APPROVED) {
      for (const line of to.lines) {
        await tx.inventoryLevel.update({
          where: {
            locationId_productVariantId: {
              locationId: to.fromLocationId,
              productVariantId: line.productVariantId,
            },
          },
          data: { quantityReserved: { decrement: line.quantityRequested } },
        });
      }
    }

    await tx.transferOrder.update({
      where: { id: toId },
      data: { status: TransferOrderStatus.CANCELLED },
    });
  });

  revalidatePath(`/transfer-orders/${toId}`);
  revalidatePath("/transfer-orders");
}
