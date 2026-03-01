"use server";

import { z } from "zod/v4";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

const SuggestionSchema = z.object({
  area: z.enum([
    "INVENTORY", "FORECASTS", "ALLOCATION", "ALERTS",
    "REPORTS", "PURCHASE_ORDERS", "TRANSFER_ORDERS", "OTHER",
  ]),
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  priority: z.coerce.number().int().min(1).max(4),
});

export async function submitSuggestion(_prev: unknown, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Not authenticated" };

  const parsed = SuggestionSchema.safeParse({
    area:        formData.get("area"),
    title:       formData.get("title"),
    description: formData.get("description"),
    priority:    formData.get("priority"),
  });
  if (!parsed.success) return { error: "Invalid form data" };

  const user = await db.user.findUnique({
    where: { email: (session.user as { email: string }).email },
    select: { id: true },
  });
  if (!user) return { error: "User not found" };

  await db.suggestion.create({
    data: { ...parsed.data, submittedById: user.id },
  });

  revalidatePath("/suggestions");
  return { success: true as const };
}

const ReviewSchema = z.object({
  id:        z.string().cuid(),
  status:    z.enum(["OPEN", "UNDER_REVIEW", "PLANNED", "REJECTED"]),
  adminNote: z.string().max(1000).optional(),
});

export async function reviewSuggestion(_prev: unknown, formData: FormData) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return { error: "Forbidden" };

  const parsed = ReviewSchema.safeParse({
    id:        formData.get("id"),
    status:    formData.get("status"),
    adminNote: formData.get("adminNote") || undefined,
  });
  if (!parsed.success) return { error: "Invalid form data" };

  await db.suggestion.update({
    where: { id: parsed.data.id },
    data: {
      status:    parsed.data.status,
      adminNote: parsed.data.adminNote ?? null,
    },
  });

  revalidatePath("/suggestions");
  revalidatePath("/admin/suggestions");
  return { success: true as const };
}
