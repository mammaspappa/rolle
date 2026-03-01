"use server";

import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return (session.user as { id: string; role: string }).id;
}

export async function createProduct(data: {
  sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string;
  description?: string;
  supplierId: string;
  unitCost: number;
  retailPrice: number;
  currency: string;
  leadTimeDays: number;
  reorderPoint: number;
  safetyStock: number;
}) {
  await getUser();

  const existing = await db.product.findUnique({ where: { sku: data.sku } });
  if (existing) throw new Error(`SKU "${data.sku}" is already in use`);

  const product = await db.product.create({
    data: {
      sku: data.sku.trim().toUpperCase(),
      name: data.name.trim(),
      brand: data.brand.trim(),
      category: data.category,
      subcategory: data.subcategory?.trim() || null,
      description: data.description?.trim() || null,
      supplierId: data.supplierId,
      unitCost: data.unitCost,
      retailPrice: data.retailPrice,
      currency: data.currency,
      leadTimeDays: data.leadTimeDays,
      reorderPoint: data.reorderPoint,
      safetyStock: data.safetyStock,
    },
  });

  revalidatePath("/products");
  redirect(`/products/${product.id}`);
}

export async function createProductVariant(data: {
  productId: string;
  sku: string;
  size?: string;
  color?: string;
  unitCost?: number;
}) {
  await getUser();

  const existing = await db.productVariant.findUnique({ where: { sku: data.sku } });
  if (existing) throw new Error(`Variant SKU "${data.sku}" is already in use`);

  // Get all active locations to seed InventoryLevel rows
  const locations = await db.location.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const variant = await db.productVariant.create({
    data: {
      productId: data.productId,
      sku: data.sku.trim().toUpperCase(),
      size: data.size?.trim() || null,
      color: data.color?.trim() || null,
      unitCost: data.unitCost ?? null,
      inventoryLevels: {
        create: locations.map((loc) => ({
          locationId: loc.id,
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityInTransit: 0,
        })),
      },
    },
  });

  revalidatePath(`/products/${data.productId}`);
  return variant;
}

export async function updateProductVariant(
  variantId: string,
  productId: string,
  data: {
    color?: string;
    size?: string;
    unitCost?: number | null;
  }
) {
  await getUser();

  await db.productVariant.update({
    where: { id: variantId },
    data: {
      ...(data.color !== undefined && { color: data.color?.trim() || null }),
      ...(data.size !== undefined && { size: data.size?.trim() || null }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
    },
  });

  revalidatePath(`/products/${productId}`);
}

export async function updateProduct(
  productId: string,
  data: {
    name?: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    supplierId?: string;
    unitCost?: number;
    retailPrice?: number;
    leadTimeDays?: number;
    reorderPoint?: number;
    safetyStock?: number;
  }
) {
  await getUser();

  await db.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.brand !== undefined && { brand: data.brand.trim() }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.subcategory !== undefined && { subcategory: data.subcategory?.trim() || null }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      ...(data.retailPrice !== undefined && { retailPrice: data.retailPrice }),
      ...(data.leadTimeDays !== undefined && { leadTimeDays: data.leadTimeDays }),
      ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
      ...(data.safetyStock !== undefined && { safetyStock: data.safetyStock }),
    },
  });

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}
