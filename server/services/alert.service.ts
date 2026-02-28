/**
 * Alert Service
 *
 * Creates and resolves alerts.
 * Sends email notifications via Resend for CRITICAL alerts.
 */

import { db } from "@/server/db";
import { AlertSeverity, AlertType } from "@prisma/client";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM ?? "inventory@rolle.com";
const EMAIL_RECIPIENTS = (process.env.EMAIL_ALERT_RECIPIENTS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// ── Alert creation ────────────────────────────────────────────────────────────

/**
 * Resolve an alert by ID.
 */
export async function resolveAlert(alertId: string, resolvedById: string): Promise<void> {
  await db.alert.update({
    where: { id: alertId },
    data: { isResolved: true, resolvedById, resolvedAt: new Date() },
  });
}

/**
 * Bulk-resolve all alerts of a given type for a location.
 */
export async function resolveAlertsForLocation(
  locationId: string,
  types: AlertType[],
  resolvedById: string
): Promise<number> {
  const result = await db.alert.updateMany({
    where: {
      locationId,
      type: { in: types },
      isResolved: false,
    },
    data: { isResolved: true, resolvedById, resolvedAt: new Date() },
  });
  return result.count;
}

// ── Email notification ────────────────────────────────────────────────────────

/**
 * Send an email for a CRITICAL alert.
 * Silently skips if RESEND_API_KEY is not configured.
 */
export async function sendCriticalAlertEmail(params: {
  alertType: AlertType;
  message: string;
  locationCode?: string;
  variantSku?: string;
}): Promise<void> {
  if (!resend || EMAIL_RECIPIENTS.length === 0) return;

  const subject = `[CRITICAL] ${params.alertType.replace("_", " ")} — Rolle Inventory`;
  const body = `
    <h2 style="color:#dc2626">⚠️ Critical Inventory Alert</h2>
    <p><strong>Type:</strong> ${params.alertType}</p>
    <p><strong>Message:</strong> ${params.message}</p>
    ${params.locationCode ? `<p><strong>Location:</strong> ${params.locationCode}</p>` : ""}
    ${params.variantSku ? `<p><strong>Variant SKU:</strong> ${params.variantSku}</p>` : ""}
    <p style="color:#6b7280;font-size:12px">
      Sent at ${new Date().toISOString()} by Rolle Inventory System.
      <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/alerts">View alerts →</a>
    </p>
  `;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_RECIPIENTS,
      subject,
      html: body,
    });
  } catch (err) {
    console.error("[alert.service] Failed to send email:", err);
  }
}

/**
 * Scan all unresolved CRITICAL alerts and send emails for those
 * created in the last hour that haven't had emails sent yet.
 * (Simple approach: send on creation, use the alert's createdAt as guard.)
 */
export async function notifyNewCriticalAlerts(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000); // last 1 hour

  const criticals = await db.alert.findMany({
    where: {
      severity: AlertSeverity.CRITICAL,
      isResolved: false,
      createdAt: { gte: since },
    },
    include: {
      productVariant: { select: { sku: true } },
      location: { select: { code: true } },
    },
  });

  for (const alert of criticals) {
    await sendCriticalAlertEmail({
      alertType: alert.type,
      message: alert.message,
      locationCode: alert.location?.code,
      variantSku: alert.productVariant?.sku,
    });
  }

  return criticals.length;
}
