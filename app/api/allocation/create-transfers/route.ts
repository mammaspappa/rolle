/**
 * POST /api/allocation/create-transfers
 *
 * Creates draft Transfer Orders from the warehouse to stores based on an allocation proposal.
 * Each store with qty > 0 gets one Transfer Order.
 *
 * Body: {
 *   productVariantId: string,
 *   warehouseId: string,
 *   lines: { locationId: string; qty: number }[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { TransferOrderStatus } from "@prisma/client";

async function nextTONumber() {
  const count = await db.transferOrder.count();
  return `TO-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { productVariantId, warehouseId, lines } = body as {
    productVariantId: string;
    warehouseId: string;
    lines: { locationId: string; qty: number }[];
  };

  if (!productVariantId || !warehouseId || !lines?.length) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const variant = await db.productVariant.findUnique({
    where: { id: productVariantId },
    include: { product: { select: { unitCost: true } } },
  });
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const unitCost = Number(variant.unitCost ?? variant.product.unitCost);
  let created = 0;

  for (const line of lines) {
    if (line.qty <= 0) continue;

    const orderNumber = await nextTONumber();
    await db.transferOrder.create({
      data: {
        orderNumber,
        fromLocationId: warehouseId,
        toLocationId: line.locationId,
        notes: `Allocation proposal — ${variant.sku}`,
        requestedById: userId,
        status: TransferOrderStatus.REQUESTED,
        lines: {
          create: {
            productVariantId,
            quantityRequested: line.qty,
            unitCost,
          },
        },
      },
    });
    created++;
  }

  return NextResponse.json({ created });
}
