"use server";

import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return (session.user as { id: string; role: string });
}

export async function createSupplier(data: {
  name: string;
  country: string;
  currency: string;
  defaultLeadDays: number;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const user = await getUser();
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(user.role)) {
    throw new Error("Only admins and warehouse managers can create suppliers");
  }

  await db.supplier.create({
    data: {
      name: data.name.trim(),
      country: data.country.trim(),
      currency: data.currency.toUpperCase(),
      defaultLeadDays: data.defaultLeadDays,
      contactEmail: data.contactEmail?.trim() || null,
      contactPhone: data.contactPhone?.trim() || null,
    },
  });

  revalidatePath("/suppliers");
}

export async function updateSupplier(
  supplierId: string,
  data: {
    name?: string;
    country?: string;
    currency?: string;
    defaultLeadDays?: number;
    contactEmail?: string;
    contactPhone?: string;
  }
) {
  const user = await getUser();
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(user.role)) {
    throw new Error("Only admins and warehouse managers can update suppliers");
  }

  await db.supplier.update({
    where: { id: supplierId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.country !== undefined && { country: data.country.trim() }),
      ...(data.currency !== undefined && { currency: data.currency.toUpperCase() }),
      ...(data.defaultLeadDays !== undefined && { defaultLeadDays: data.defaultLeadDays }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail?.trim() || null }),
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone?.trim() || null }),
    },
  });

  revalidatePath("/suppliers");
}
