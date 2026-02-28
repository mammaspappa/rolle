import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const location = await db.location.findUnique({
    where: { id: locationId },
    select: { code: true, name: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const levels = await db.inventoryLevel.findMany({
    where: { locationId },
    include: {
      productVariant: {
        include: { product: { select: { name: true, brand: true, category: true } } },
      },
    },
    orderBy: { productVariant: { sku: "asc" } },
  });

  const header = "sku,brand,product_name,color,size,system_qty,actual_qty\n";
  const rows = levels
    .map((l) => {
      const v = l.productVariant;
      const cols = [
        v.sku,
        `"${v.product.brand}"`,
        `"${v.product.name}"`,
        v.color ?? "",
        v.size ?? "",
        l.quantityOnHand,
        "", // actual_qty — to be filled in by staff
      ];
      return cols.join(",");
    })
    .join("\n");

  const csv = header + rows;
  const filename = `stock-count-${location.code}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
