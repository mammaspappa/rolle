import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { recordSales } from "@/server/actions/inventory";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface SaleRow {
  date: string;
  sku: string;
  location_code: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const rows: SaleRow[] = body.rows ?? [];

  if (!rows.length) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  // Resolve SKUs → variant IDs
  const skus = Array.from(new Set(rows.map((r) => r.sku.toUpperCase())));
  const variants = await db.productVariant.findMany({
    where: { sku: { in: skus } },
    include: { product: { select: { unitCost: true } } },
  });
  const variantBySku = new Map(variants.map((v) => [v.sku, v]));

  // Resolve location codes → location IDs
  const codes = Array.from(new Set(rows.map((r) => r.location_code.toUpperCase())));
  const locations = await db.location.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const locationByCode = new Map(locations.map((l) => [l.code, l]));

  const errors: string[] = [];
  const sales: {
    productVariantId: string;
    locationId: string;
    quantity: number;
    unitCost: number;
    occurredAt: Date;
  }[] = [];

  for (const row of rows) {
    const variant = variantBySku.get(row.sku.toUpperCase());
    if (!variant) {
      errors.push(`Unknown SKU: ${row.sku}`);
      continue;
    }

    const location = locationByCode.get(row.location_code.toUpperCase());
    if (!location) {
      errors.push(`Unknown location code: ${row.location_code}`);
      continue;
    }

    const occurredAt = new Date(row.date);
    if (isNaN(occurredAt.getTime())) {
      errors.push(`Invalid date "${row.date}" for SKU ${row.sku}`);
      continue;
    }

    const unitCost = Number(variant.unitCost ?? variant.product.unitCost);

    sales.push({
      productVariantId: variant.id,
      locationId: location.id,
      quantity: row.quantity,
      unitCost,
      occurredAt,
    });
  }

  const { recorded, errors: recordErrors } = await recordSales(sales, userId);

  return NextResponse.json({
    recorded,
    skipped: errors.length + recordErrors.length,
    errors: [...errors, ...recordErrors],
  });
}
