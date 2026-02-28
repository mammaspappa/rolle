"use server";

import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return (session.user as { id: string }).id;
}

export async function resolveAlert(alertId: string) {
  const userId = await getUser();
  await db.alert.update({
    where: { id: alertId },
    data: { isResolved: true, resolvedById: userId, resolvedAt: new Date() },
  });
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function resolveAllAlerts(severity?: string) {
  const userId = await getUser();
  await db.alert.updateMany({
    where: {
      isResolved: false,
      ...(severity ? { severity: severity as "CRITICAL" | "WARNING" | "INFO" } : {}),
    },
    data: { isResolved: true, resolvedById: userId, resolvedAt: new Date() },
  });
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}
