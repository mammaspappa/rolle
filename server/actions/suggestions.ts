"use server";

import { z } from "zod/v4";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { appendFileSync } from "fs";
import { join } from "path";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low — nice to have",
  2: "Medium — would improve workflow",
  3: "High — causes friction regularly",
  4: "Critical — blocking my work",
};

function appendSuggestionLog(entry: {
  area: string;
  priority: number;
  title: string;
  description: string;
  submitterEmail: string;
  submitterName?: string | null;
}) {
  try {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const line = [
      "================================================================================",
      `Date:         ${now}`,
      `Area:         ${entry.area}`,
      `Priority:     ${PRIORITY_LABELS[entry.priority] ?? entry.priority}`,
      `Title:        ${entry.title}`,
      `Submitted by: ${entry.submitterName ?? "Unknown"} <${entry.submitterEmail}>`,
      "",
      "Description:",
      entry.description,
      "================================================================================",
      "",
    ].join("\n");

    appendFileSync(join(process.cwd(), "suggestions.log"), line, "utf8");
  } catch {
    // Non-fatal — DB record is the source of truth
  }
}

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

  const email = (session.user as { email: string }).email;
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!user) return { error: "User not found" };

  await db.suggestion.create({
    data: { ...parsed.data, submittedById: user.id },
  });

  appendSuggestionLog({
    area:          parsed.data.area,
    priority:      parsed.data.priority,
    title:         parsed.data.title,
    description:   parsed.data.description,
    submitterEmail: email,
    submitterName: user.name,
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
