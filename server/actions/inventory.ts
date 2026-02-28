"use server";

import { db } from "@/server/db";
import { MovementType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";

interface RecordMovementParams {
  type: MovementType;
  productVariantId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  occurredAt?: Date;
}

/**
 * Atomically records a stock movement and updates InventoryLevel(s).
 * This is the single entry point for all stock mutations.
 * Application code must NEVER update InventoryLevel directly.
 */
export async function recordStockMovement(params: RecordMovementParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as { id: string }).id;

  const {
    type,
    productVariantId,
    fromLocationId,
    toLocationId,
    quantity,
    unitCost,
    referenceType,
    referenceId,
    notes,
    occurredAt,
  } = params;

  if (quantity <= 0) throw new Error("Quantity must be positive");

  await db.$transaction(async (tx) => {
    // 1. Write the immutable ledger entry
    await tx.stockMovement.create({
      data: {
        type,
        productVariantId,
        fromLocationId,
        toLocationId,
        quantity,
        unitCost,
        referenceType,
        referenceId,
        notes,
        performedById: userId,
        occurredAt: occurredAt ?? new Date(),
      },
    });

    // 2. Update source location
    if (fromLocationId) {
      await tx.inventoryLevel.upsert({
        where: {
          locationId_productVariantId: {
            locationId: fromLocationId,
            productVariantId,
          },
        },
        create: {
          locationId: fromLocationId,
          productVariantId,
          quantityOnHand: 0,
        },
        update: {
          quantityOnHand: { decrement: quantity },
        },
      });
    }

    // 3. Update destination location
    if (toLocationId) {
      await tx.inventoryLevel.upsert({
        where: {
          locationId_productVariantId: {
            locationId: toLocationId,
            productVariantId,
          },
        },
        create: {
          locationId: toLocationId,
          productVariantId,
          quantityOnHand: quantity,
        },
        update: {
          quantityOnHand: { increment: quantity },
        },
      });
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await invalidateCache(CACHE_KEYS.INVENTORY_GRID);
}

/**
 * Adjust stock at a location (positive = add, negative = remove).
 * Creates an ADJUSTMENT movement and updates the level.
 */
export async function adjustStock(params: {
  productVariantId: string;
  locationId: string;
  quantityDelta: number; // positive or negative
  unitCost: number;
  notes: string;
}) {
  const { productVariantId, locationId, quantityDelta, unitCost, notes } = params;
  if (quantityDelta === 0) throw new Error("Delta cannot be zero");

  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as { id: string }).id;

  await db.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        type: quantityDelta > 0 ? MovementType.ADJUSTMENT : MovementType.ADJUSTMENT,
        productVariantId,
        toLocationId: quantityDelta > 0 ? locationId : undefined,
        fromLocationId: quantityDelta < 0 ? locationId : undefined,
        quantity: Math.abs(quantityDelta),
        unitCost,
        notes,
        performedById: userId,
      },
    });

    await tx.inventoryLevel.upsert({
      where: {
        locationId_productVariantId: { locationId, productVariantId },
      },
      create: {
        locationId,
        productVariantId,
        quantityOnHand: Math.max(0, quantityDelta),
      },
      update: {
        quantityOnHand: { increment: quantityDelta },
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await invalidateCache(CACHE_KEYS.INVENTORY_GRID);
}

/**
 * Apply a physical stock count for one location.
 * For each variant where actualQty ≠ quantityOnHand, creates a COUNT_CORRECTION
 * movement and updates InventoryLevel to the actual value.
 */
export async function applyPhysicalCount(params: {
  locationId: string;
  counts: { productVariantId: string; actualQty: number }[];
  notes?: string;
}): Promise<{ corrected: number; unchanged: number }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as { id: string }).id;

  const { locationId, counts, notes } = params;

  const existing = await db.inventoryLevel.findMany({
    where: {
      locationId,
      productVariantId: { in: counts.map((c) => c.productVariantId) },
    },
    select: { productVariantId: true, quantityOnHand: true },
  });
  const onHandMap = new Map(existing.map((e) => [e.productVariantId, e.quantityOnHand]));

  const variants = await db.productVariant.findMany({
    where: { id: { in: counts.map((c) => c.productVariantId) } },
    include: { product: { select: { unitCost: true } } },
  });
  const costMap = new Map(
    variants.map((v) => [v.id, Number(v.unitCost ?? v.product.unitCost)])
  );

  let corrected = 0;
  let unchanged = 0;

  await db.$transaction(async (tx) => {
    for (const { productVariantId, actualQty } of counts) {
      if (actualQty < 0) continue;
      const currentQty = onHandMap.get(productVariantId) ?? 0;
      const delta = actualQty - currentQty;

      if (delta === 0) {
        await tx.inventoryLevel.updateMany({
          where: { locationId, productVariantId },
          data: { lastCountedAt: new Date() },
        });
        unchanged++;
        continue;
      }

      const unitCost = costMap.get(productVariantId) ?? 0;

      await tx.stockMovement.create({
        data: {
          type: MovementType.COUNT_CORRECTION,
          productVariantId,
          toLocationId: delta > 0 ? locationId : undefined,
          fromLocationId: delta < 0 ? locationId : undefined,
          quantity: Math.abs(delta),
          unitCost,
          notes: notes || `Physical count: was ${currentQty}, actual ${actualQty}`,
          performedById: userId,
        },
      });

      await tx.inventoryLevel.upsert({
        where: { locationId_productVariantId: { locationId, productVariantId } },
        create: { locationId, productVariantId, quantityOnHand: actualQty, lastCountedAt: new Date() },
        update: { quantityOnHand: actualQty, lastCountedAt: new Date() },
      });

      corrected++;
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await invalidateCache(CACHE_KEYS.INVENTORY_GRID);
  return { corrected, unchanged };
}

/**
 * Record sales in batch — creates SALE movements and decrements InventoryLevel.
 * Used by CSV import and the POS webhook.
 */
export async function recordSales(
  sales: {
    productVariantId: string;
    locationId: string;
    quantity: number;
    unitCost: number;
    occurredAt: Date;
  }[],
  performedById: string
): Promise<{ recorded: number; errors: string[] }> {
  const errors: string[] = [];
  let recorded = 0;

  await db.$transaction(async (tx) => {
    for (const sale of sales) {
      if (sale.quantity <= 0) {
        errors.push(`Skipped zero-qty sale for variant ${sale.productVariantId}`);
        continue;
      }

      try {
        await tx.stockMovement.create({
          data: {
            type: MovementType.SALE,
            productVariantId: sale.productVariantId,
            fromLocationId: sale.locationId,
            quantity: sale.quantity,
            unitCost: sale.unitCost,
            performedById,
            occurredAt: sale.occurredAt,
          },
        });

        await tx.inventoryLevel.upsert({
          where: {
            locationId_productVariantId: {
              locationId: sale.locationId,
              productVariantId: sale.productVariantId,
            },
          },
          create: {
            locationId: sale.locationId,
            productVariantId: sale.productVariantId,
            quantityOnHand: 0,
          },
          update: { quantityOnHand: { decrement: sale.quantity } },
        });

        recorded++;
      } catch (err) {
        errors.push(`Error on variant ${sale.productVariantId}: ${(err as Error).message}`);
      }
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await invalidateCache(CACHE_KEYS.INVENTORY_GRID);
  return { recorded, errors };
}
