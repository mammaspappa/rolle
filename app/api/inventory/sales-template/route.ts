import { NextResponse } from "next/server";

export async function GET() {
  const csv = [
    "date,sku,location_code,quantity",
    "2026-02-27,RLE-BAG-001-BLK,STORE-PAR,2",
    "2026-02-27,RLE-BAG-001-BRN,STORE-NYC,1",
    "2026-02-26,RLE-WTC-002-SLV-40,STORE-LON,1",
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="sales-import-template.csv"',
    },
  });
}
