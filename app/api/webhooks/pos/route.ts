/**
 * POS Webhook — POST /api/webhooks/pos
 *
 * Accepts real-time sale events from point-of-sale systems.
 *
 * Authentication: Bearer token via WEBHOOK_SECRET env var.
 *
 * Request body (JSON):
 * {
 *   "sales": [
 *     {
 *       "sku": "RLE-BAG-001-BLK",
 *       "location_code": "STORE-PAR",
 *       "quantity": 1,
 *       "occurred_at": "2026-02-27T14:30:00Z"   // optional, defaults to now
 *     }
 *   ]
 * }
 *
 * Response: { recorded: number, errors: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { recordSales } from "@/server/actions/inventory";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
// System user ID to attribute webhook-sourced movements to.
// Falls back to any ADMIN user found in the database.
let systemUserId: string | null = null;

async function getSystemUserId(): Promise<string> {
  if (systemUserId) return systemUserId;
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  if (!admin) throw new Error("No active admin user found to attribute webhook sales");
  systemUserId = admin.id;
  return systemUserId;
}

interface SaleEvent {
  sku: string;
  location_code: string;
  quantity: number;
  occurred_at?: string;
}

export async function POST(req: NextRequest) {
  // Authenticate via Bearer token
  if (WEBHOOK_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { sales?: SaleEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const events: SaleEvent[] = body.sales ?? [];
  if (!events.length) {
    return NextResponse.json({ error: "No sales in payload" }, { status: 400 });
  }

  // Resolve SKUs and locations
  const skus = Array.from(new Set(events.map((e) => e.sku.toUpperCase())));
  const codes = Array.from(new Set(events.map((e) => e.location_code.toUpperCase())));

  const [variants, locations] = await Promise.all([
    db.productVariant.findMany({
      where: { sku: { in: skus } },
      include: { product: { select: { unitCost: true } } },
    }),
    db.location.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    }),
  ]);

  const variantBySku = new Map(variants.map((v) => [v.sku, v]));
  const locationByCode = new Map(locations.map((l) => [l.code, l]));

  const errors: string[] = [];
  const sales: Parameters<typeof recordSales>[0] = [];

  for (const event of events) {
    const variant = variantBySku.get(event.sku.toUpperCase());
    if (!variant) { errors.push(`Unknown SKU: ${event.sku}`); continue; }

    const location = locationByCode.get(event.location_code.toUpperCase());
    if (!location) { errors.push(`Unknown location: ${event.location_code}`); continue; }

    if (event.quantity <= 0) { errors.push(`Invalid quantity for ${event.sku}`); continue; }

    sales.push({
      productVariantId: variant.id,
      locationId: location.id,
      quantity: event.quantity,
      unitCost: Number(variant.unitCost ?? variant.product.unitCost),
      occurredAt: event.occurred_at ? new Date(event.occurred_at) : new Date(),
    });
  }

  let recorded = 0;
  if (sales.length > 0) {
    const userId = await getSystemUserId();
    const result = await recordSales(sales, userId);
    recorded = result.recorded;
    errors.push(...result.errors);
  }

  return NextResponse.json({ recorded, errors });
}
