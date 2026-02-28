"use server";

import { db } from "@/server/db";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const user = session.user as { id: string; role: string };
  if (user.role !== "ADMIN") throw new Error("Only admins can manage users");
  return user.id;
}

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: Role;
  locationId?: string;
}) {
  await requireAdmin();

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error(`Email "${data.email}" is already registered`);

  const hashed = await bcrypt.hash(data.password, 12);

  await db.user.create({
    data: {
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      password: hashed,
      role: data.role,
      locationId: data.locationId || null,
    },
  });

  revalidatePath("/settings");
}

export async function updateUser(
  userId: string,
  data: {
    name?: string;
    role?: Role;
    locationId?: string | null;
    isActive?: boolean;
  }
) {
  await requireAdmin();

  await db.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.locationId !== undefined && { locationId: data.locationId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  revalidatePath("/settings");
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireAdmin();

  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
  const hashed = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id: userId },
    data: { password: hashed },
  });
}
