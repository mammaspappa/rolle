import { NextResponse } from "next/server";

const CSV_HEADER =
  "product_sku,name,brand,category,subcategory,supplier_name,unit_cost,retail_price,currency,lead_time_days,variant_sku,size,color";

const CSV_EXAMPLE = [
  "RLE-BAG-001,Quilted Flap Bag,Chanel,Handbag,Evening,Maison Chanel,3800,8500,EUR,45,RLE-BAG-001-BLK,,Black",
  "RLE-BAG-001,Quilted Flap Bag,Chanel,Handbag,Evening,Maison Chanel,3800,8500,EUR,45,RLE-BAG-001-BGE,,Beige",
  "RLE-WTC-002,Royal Oak Offshore,Audemars Piguet,Watch,,AP Manufacture,18000,42000,CHF,60,RLE-WTC-002-42,,42mm",
].join("\n");

export async function GET() {
  const body = `${CSV_HEADER}\n${CSV_EXAMPLE}\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-import-template.csv"`,
    },
  });
}
