import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface ImportRow {
  product_sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  supplier_name: string;
  unit_cost: number;
  retail_price: number;
  currency: string;
  lead_time_days: number;
  variant_sku: string;
  size: string;
  color: string;
  _row: number;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = session.user as { role?: string };
  if (role !== "ADMIN" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const rows: ImportRow[] = body.rows ?? [];

  if (!rows.length) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  // Collect all unique supplier names and resolve them to IDs
  const supplierNames = Array.from(new Set(rows.map((r) => r.supplier_name.trim()).filter(Boolean)));
  const suppliers = await db.supplier.findMany({
    where: { name: { in: supplierNames } },
    select: { id: true, name: true },
  });
  const supplierByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  // Group rows by product SKU so we upsert each product once
  const byProduct = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const key = row.product_sku.toUpperCase();
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key)!.push(row);
  }

  for (const [productSku, productRows] of Array.from(byProduct.entries())) {
    const first = productRows[0];
    const supplierId = supplierByName.get(first.supplier_name.trim().toLowerCase());

    if (!supplierId) {
      for (const r of productRows) {
        errors.push(`Row ${r._row}: unknown supplier "${first.supplier_name}"`);
      }
      continue;
    }

    // Upsert the product
    const productData = {
      name: first.name.trim(),
      brand: first.brand.trim(),
      category: first.category.trim(),
      subcategory: first.subcategory.trim() || null,
      supplierId,
      unitCost: first.unit_cost,
      retailPrice: first.retail_price,
      currency: first.currency.trim().toUpperCase() || "EUR",
      leadTimeDays: first.lead_time_days || 30,
    };

    let product: { id: string };
    try {
      product = await db.product.upsert({
        where: { sku: productSku },
        create: { sku: productSku, ...productData },
        update: productData,
        select: { id: true },
      });
    } catch (err) {
      errors.push(`Product ${productSku}: ${(err as Error).message}`);
      continue;
    }

    // Upsert each variant
    for (const row of productRows) {
      if (!row.variant_sku.trim()) {
        errors.push(`Row ${row._row}: variant_sku is required`);
        continue;
      }

      const variantSku = row.variant_sku.trim().toUpperCase();
      const variantData = {
        productId: product.id,
        size: row.size.trim() || null,
        color: row.color.trim() || null,
      };

      try {
        const existing = await db.productVariant.findUnique({
          where: { sku: variantSku },
          select: { id: true },
        });

        if (existing) {
          await db.productVariant.update({
            where: { sku: variantSku },
            data: { size: variantData.size, color: variantData.color },
          });
          updated++;
        } else {
          await db.productVariant.create({ data: { sku: variantSku, ...variantData } });
          created++;
        }
      } catch (err) {
        errors.push(`Variant ${variantSku} (row ${row._row}): ${(err as Error).message}`);
      }
    }
  }

  return NextResponse.json({ created, updated, errors });
}
