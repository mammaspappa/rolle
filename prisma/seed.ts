import { PrismaClient, LocationType, RevenueTier, Role, MovementType } from "@prisma/client";
import { createHash } from "crypto";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

// Simple password hash for seed data — replace with bcrypt in production
function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  // Load .env.local (gitignored) so seed-only credentials don't need to be
  // exported in the shell. Already-set env vars are never overwritten.
  try {
    const lines = readFileSync(".env.local", "utf8").split("\n");
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local absent — rely on env vars already in process.env
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env.local"
    );
  }

  console.log("Seeding database...");

  // ---------------------------------------------------------------------------
  // Locations: 1 warehouse + 20 global stores
  // ---------------------------------------------------------------------------
  const locationData: {
    code: string;
    name: string;
    type: LocationType;
    city: string;
    country: string;
    timezone: string;
    currency: string;
    revenueTier: RevenueTier;
  }[] = [
    // Warehouse
    {
      code: "WH-CENTRAL",
      name: "Central Warehouse",
      type: LocationType.WAREHOUSE,
      city: "Lyon",
      country: "France",
      timezone: "Europe/Paris",
      currency: "EUR",
      revenueTier: RevenueTier.A,
    },
    // Tier A — flagship stores, highest revenue
    {
      code: "STORE-PAR",
      name: "Paris Flagship",
      type: LocationType.STORE,
      city: "Paris",
      country: "France",
      timezone: "Europe/Paris",
      currency: "EUR",
      revenueTier: RevenueTier.A,
    },
    {
      code: "STORE-NYC",
      name: "New York Fifth Avenue",
      type: LocationType.STORE,
      city: "New York",
      country: "United States",
      timezone: "America/New_York",
      currency: "USD",
      revenueTier: RevenueTier.A,
    },
    {
      code: "STORE-LON",
      name: "London Bond Street",
      type: LocationType.STORE,
      city: "London",
      country: "United Kingdom",
      timezone: "Europe/London",
      currency: "GBP",
      revenueTier: RevenueTier.A,
    },
    {
      code: "STORE-TYO",
      name: "Tokyo Ginza",
      type: LocationType.STORE,
      city: "Tokyo",
      country: "Japan",
      timezone: "Asia/Tokyo",
      currency: "JPY",
      revenueTier: RevenueTier.A,
    },
    {
      code: "STORE-DXB",
      name: "Dubai Mall",
      type: LocationType.STORE,
      city: "Dubai",
      country: "United Arab Emirates",
      timezone: "Asia/Dubai",
      currency: "AED",
      revenueTier: RevenueTier.A,
    },
    {
      code: "STORE-HKG",
      name: "Hong Kong Central",
      type: LocationType.STORE,
      city: "Hong Kong",
      country: "Hong Kong SAR",
      timezone: "Asia/Hong_Kong",
      currency: "HKD",
      revenueTier: RevenueTier.A,
    },
    // Tier B — strong performers
    {
      code: "STORE-MIL",
      name: "Milan Via Montenapoleone",
      type: LocationType.STORE,
      city: "Milan",
      country: "Italy",
      timezone: "Europe/Rome",
      currency: "EUR",
      revenueTier: RevenueTier.B,
    },
    {
      code: "STORE-SIN",
      name: "Singapore Marina Bay",
      type: LocationType.STORE,
      city: "Singapore",
      country: "Singapore",
      timezone: "Asia/Singapore",
      currency: "SGD",
      revenueTier: RevenueTier.B,
    },
    {
      code: "STORE-LAX",
      name: "Los Angeles Beverly Hills",
      type: LocationType.STORE,
      city: "Los Angeles",
      country: "United States",
      timezone: "America/Los_Angeles",
      currency: "USD",
      revenueTier: RevenueTier.B,
    },
    {
      code: "STORE-SHA",
      name: "Shanghai Jing'an",
      type: LocationType.STORE,
      city: "Shanghai",
      country: "China",
      timezone: "Asia/Shanghai",
      currency: "CNY",
      revenueTier: RevenueTier.B,
    },
    {
      code: "STORE-ZRH",
      name: "Zurich Bahnhofstrasse",
      type: LocationType.STORE,
      city: "Zurich",
      country: "Switzerland",
      timezone: "Europe/Zurich",
      currency: "CHF",
      revenueTier: RevenueTier.B,
    },
    {
      code: "STORE-SEO",
      name: "Seoul Cheongdam",
      type: LocationType.STORE,
      city: "Seoul",
      country: "South Korea",
      timezone: "Asia/Seoul",
      currency: "KRW",
      revenueTier: RevenueTier.B,
    },
    {
      code: "STORE-SYD",
      name: "Sydney CBD",
      type: LocationType.STORE,
      city: "Sydney",
      country: "Australia",
      timezone: "Australia/Sydney",
      currency: "AUD",
      revenueTier: RevenueTier.B,
    },
    // Tier C — developing markets
    {
      code: "STORE-BER",
      name: "Berlin Kurfürstendamm",
      type: LocationType.STORE,
      city: "Berlin",
      country: "Germany",
      timezone: "Europe/Berlin",
      currency: "EUR",
      revenueTier: RevenueTier.C,
    },
    {
      code: "STORE-MAD",
      name: "Madrid Serrano",
      type: LocationType.STORE,
      city: "Madrid",
      country: "Spain",
      timezone: "Europe/Madrid",
      currency: "EUR",
      revenueTier: RevenueTier.C,
    },
    {
      code: "STORE-SAO",
      name: "São Paulo Jardins",
      type: LocationType.STORE,
      city: "São Paulo",
      country: "Brazil",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      revenueTier: RevenueTier.C,
    },
    {
      code: "STORE-RUH",
      name: "Riyadh Kingdom Centre",
      type: LocationType.STORE,
      city: "Riyadh",
      country: "Saudi Arabia",
      timezone: "Asia/Riyadh",
      currency: "SAR",
      revenueTier: RevenueTier.C,
    },
    {
      code: "STORE-MIA",
      name: "Miami Design District",
      type: LocationType.STORE,
      city: "Miami",
      country: "United States",
      timezone: "America/New_York",
      currency: "USD",
      revenueTier: RevenueTier.C,
    },
    {
      code: "STORE-TOR",
      name: "Toronto Bloor Street",
      type: LocationType.STORE,
      city: "Toronto",
      country: "Canada",
      timezone: "America/Toronto",
      currency: "CAD",
      revenueTier: RevenueTier.C,
    },
    {
      code: "STORE-MSC",
      name: "Moscow Tretyakov Gallery",
      type: LocationType.STORE,
      city: "Moscow",
      country: "Russia",
      timezone: "Europe/Moscow",
      currency: "RUB",
      revenueTier: RevenueTier.C,
    },
  ];

  const locations = await Promise.all(
    locationData.map((data) =>
      prisma.location.upsert({
        where: { code: data.code },
        update: data,
        create: data,
      })
    )
  );

  console.log(`✓ ${locations.length} locations seeded`);

  // ---------------------------------------------------------------------------
  // Admin user
  // ---------------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "System Admin",
      password: hashPassword(adminPassword),
      role: Role.ADMIN,
    },
  });

  console.log(`✓ Admin user seeded (email: ${adminEmail})`);

  // ---------------------------------------------------------------------------
  // Demo supplier
  // ---------------------------------------------------------------------------
  const supplier = await prisma.supplier.upsert({
    where: { id: "demo-supplier-1" },
    update: {},
    create: {
      id: "demo-supplier-1",
      name: "Maison Artisanale SA",
      contactEmail: "orders@maison-artisanale.fr",
      country: "France",
      currency: "EUR",
      defaultLeadDays: 45,
    },
  });

  console.log(`✓ Demo supplier seeded`);

  // ---------------------------------------------------------------------------
  // Category carrying rates (luxury goods: 20–30% annually)
  // ---------------------------------------------------------------------------
  const categoryRates = [
    { category: "Handbag", annualRate: 0.28 },
    { category: "Watch", annualRate: 0.22 },
    { category: "Shoes", annualRate: 0.30 },
    { category: "Jewellery", annualRate: 0.20 },
    { category: "Accessory", annualRate: 0.25 },
    { category: "Ready-to-Wear", annualRate: 0.35 },
    { category: "Fragrance", annualRate: 0.18 },
  ];

  await Promise.all(
    categoryRates.map(({ category, annualRate }) =>
      prisma.categoryCarryingRate.upsert({
        where: { category },
        update: { annualRate },
        create: { category, annualRate },
      })
    )
  );

  console.log(`✓ Category carrying rates seeded`);

  // ---------------------------------------------------------------------------
  // Demo products with variants
  // On variant creation, seed InventoryLevel(qty=0) for all 21 locations.
  // ---------------------------------------------------------------------------
  const warehouse = locations.find((l) => l.code === "WH-CENTRAL")!;

  const demoProducts = [
    {
      sku: "HB-001",
      name: "Classic Tote",
      brand: "Maison Artisanale",
      category: "Handbag",
      unitCost: 850,
      retailPrice: 2200,
      leadTimeDays: 45,
      variants: [
        { sku: "HB-001-BLK", color: "Black" },
        { sku: "HB-001-TAN", color: "Tan" },
        { sku: "HB-001-BRG", color: "Burgundy" },
      ],
    },
    {
      sku: "WT-001",
      name: "Heritage Chronograph",
      brand: "Maison Artisanale",
      category: "Watch",
      unitCost: 4200,
      retailPrice: 9500,
      leadTimeDays: 60,
      variants: [
        { sku: "WT-001-SLV", color: "Silver" },
        { sku: "WT-001-GLD", color: "Gold" },
      ],
    },
    {
      sku: "SH-001",
      name: "Signature Pump",
      brand: "Maison Artisanale",
      category: "Shoes",
      unitCost: 380,
      retailPrice: 950,
      leadTimeDays: 30,
      variants: [
        { sku: "SH-001-BLK-36", color: "Black", size: "36" },
        { sku: "SH-001-BLK-37", color: "Black", size: "37" },
        { sku: "SH-001-BLK-38", color: "Black", size: "38" },
        { sku: "SH-001-NUD-37", color: "Nude", size: "37" },
        { sku: "SH-001-NUD-38", color: "Nude", size: "38" },
      ],
    },
  ];

  for (const productData of demoProducts) {
    const { variants, ...productFields } = productData;

    const product = await prisma.product.upsert({
      where: { sku: productFields.sku },
      update: {},
      create: {
        ...productFields,
        currency: "EUR",
        supplierId: supplier.id,
      },
    });

    for (const variantData of variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: variantData.sku },
        update: {},
        create: {
          ...variantData,
          productId: product.id,
        },
      });

      // Seed InventoryLevel rows for all locations (qty = 0)
      await Promise.all(
        locations.map((location) =>
          prisma.inventoryLevel.upsert({
            where: {
              locationId_productVariantId: {
                locationId: location.id,
                productVariantId: variant.id,
              },
            },
            update: {},
            create: {
              locationId: location.id,
              productVariantId: variant.id,
              quantityOnHand: 0,
              quantityReserved: 0,
              quantityInTransit: 0,
            },
          })
        )
      );
    }

    console.log(
      `✓ Product "${product.name}" seeded with ${variants.length} variants`
    );
  }

  // ---------------------------------------------------------------------------
  // Realistic initial stock
  // Warehouse holds the bulk. Tier A stores stocked well, B moderate, C light.
  // A few deliberate stockouts for realism (Gold watch at several stores).
  // ---------------------------------------------------------------------------
  console.log("Seeding initial stock levels...");

  const allVariants = await prisma.productVariant.findMany({
    include: { product: true },
  });

  // Stock table: variantSku -> locationCode -> qty
  // Warehouse gets the most; flagship stores next; stockouts at some Tier C
  const stockTable: Record<string, Record<string, number>> = {
    // --- Classic Tote Black ---
    "HB-001-BLK": {
      "WH-CENTRAL": 48, "STORE-PAR": 4, "STORE-NYC": 5, "STORE-LON": 3,
      "STORE-TYO": 4, "STORE-DXB": 3, "STORE-HKG": 4, "STORE-MIL": 2,
      "STORE-SIN": 2, "STORE-LAX": 3, "STORE-SHA": 2, "STORE-ZRH": 1,
      "STORE-SEO": 2, "STORE-SYD": 1, "STORE-BER": 1, "STORE-MAD": 1,
      "STORE-SAO": 0, "STORE-RUH": 1, "STORE-MIA": 2, "STORE-TOR": 1, "STORE-MSC": 0,
    },
    // --- Classic Tote Tan ---
    "HB-001-TAN": {
      "WH-CENTRAL": 32, "STORE-PAR": 3, "STORE-NYC": 3, "STORE-LON": 2,
      "STORE-TYO": 2, "STORE-DXB": 3, "STORE-HKG": 2, "STORE-MIL": 2,
      "STORE-SIN": 1, "STORE-LAX": 2, "STORE-SHA": 1, "STORE-ZRH": 1,
      "STORE-SEO": 1, "STORE-SYD": 1, "STORE-BER": 0, "STORE-MAD": 1,
      "STORE-SAO": 0, "STORE-RUH": 1, "STORE-MIA": 1, "STORE-TOR": 0, "STORE-MSC": 0,
    },
    // --- Classic Tote Burgundy ---
    "HB-001-BRG": {
      "WH-CENTRAL": 20, "STORE-PAR": 2, "STORE-NYC": 2, "STORE-LON": 1,
      "STORE-TYO": 2, "STORE-DXB": 1, "STORE-HKG": 2, "STORE-MIL": 1,
      "STORE-SIN": 1, "STORE-LAX": 1, "STORE-SHA": 1, "STORE-ZRH": 0,
      "STORE-SEO": 1, "STORE-SYD": 0, "STORE-BER": 0, "STORE-MAD": 0,
      "STORE-SAO": 0, "STORE-RUH": 0, "STORE-MIA": 1, "STORE-TOR": 0, "STORE-MSC": 0,
    },
    // --- Heritage Chronograph Silver ---
    "WT-001-SLV": {
      "WH-CENTRAL": 15, "STORE-PAR": 2, "STORE-NYC": 2, "STORE-LON": 1,
      "STORE-TYO": 2, "STORE-DXB": 2, "STORE-HKG": 2, "STORE-MIL": 1,
      "STORE-SIN": 1, "STORE-LAX": 1, "STORE-SHA": 1, "STORE-ZRH": 2,
      "STORE-SEO": 1, "STORE-SYD": 0, "STORE-BER": 1, "STORE-MAD": 0,
      "STORE-SAO": 0, "STORE-RUH": 1, "STORE-MIA": 1, "STORE-TOR": 0, "STORE-MSC": 0,
    },
    // --- Heritage Chronograph Gold --- (scarce, several stockouts)
    "WT-001-GLD": {
      "WH-CENTRAL": 6, "STORE-PAR": 1, "STORE-NYC": 1, "STORE-LON": 0,
      "STORE-TYO": 1, "STORE-DXB": 1, "STORE-HKG": 1, "STORE-MIL": 0,
      "STORE-SIN": 0, "STORE-LAX": 0, "STORE-SHA": 1, "STORE-ZRH": 1,
      "STORE-SEO": 0, "STORE-SYD": 0, "STORE-BER": 0, "STORE-MAD": 0,
      "STORE-SAO": 0, "STORE-RUH": 0, "STORE-MIA": 0, "STORE-TOR": 0, "STORE-MSC": 0,
    },
    // --- Signature Pump Black 36 ---
    "SH-001-BLK-36": {
      "WH-CENTRAL": 24, "STORE-PAR": 3, "STORE-NYC": 2, "STORE-LON": 2,
      "STORE-TYO": 3, "STORE-DXB": 2, "STORE-HKG": 2, "STORE-MIL": 2,
      "STORE-SIN": 1, "STORE-LAX": 2, "STORE-SHA": 2, "STORE-ZRH": 1,
      "STORE-SEO": 2, "STORE-SYD": 1, "STORE-BER": 1, "STORE-MAD": 1,
      "STORE-SAO": 0, "STORE-RUH": 1, "STORE-MIA": 1, "STORE-TOR": 1, "STORE-MSC": 0,
    },
    // --- Signature Pump Black 37 ---
    "SH-001-BLK-37": {
      "WH-CENTRAL": 30, "STORE-PAR": 4, "STORE-NYC": 3, "STORE-LON": 3,
      "STORE-TYO": 3, "STORE-DXB": 2, "STORE-HKG": 2, "STORE-MIL": 2,
      "STORE-SIN": 2, "STORE-LAX": 2, "STORE-SHA": 2, "STORE-ZRH": 1,
      "STORE-SEO": 2, "STORE-SYD": 1, "STORE-BER": 2, "STORE-MAD": 1,
      "STORE-SAO": 1, "STORE-RUH": 1, "STORE-MIA": 2, "STORE-TOR": 1, "STORE-MSC": 1,
    },
    // --- Signature Pump Black 38 ---
    "SH-001-BLK-38": {
      "WH-CENTRAL": 22, "STORE-PAR": 3, "STORE-NYC": 3, "STORE-LON": 2,
      "STORE-TYO": 2, "STORE-DXB": 2, "STORE-HKG": 2, "STORE-MIL": 1,
      "STORE-SIN": 1, "STORE-LAX": 2, "STORE-SHA": 2, "STORE-ZRH": 1,
      "STORE-SEO": 1, "STORE-SYD": 1, "STORE-BER": 1, "STORE-MAD": 1,
      "STORE-SAO": 0, "STORE-RUH": 1, "STORE-MIA": 1, "STORE-TOR": 1, "STORE-MSC": 0,
    },
    // --- Signature Pump Nude 37 ---
    "SH-001-NUD-37": {
      "WH-CENTRAL": 18, "STORE-PAR": 2, "STORE-NYC": 2, "STORE-LON": 2,
      "STORE-TYO": 2, "STORE-DXB": 2, "STORE-HKG": 1, "STORE-MIL": 2,
      "STORE-SIN": 1, "STORE-LAX": 2, "STORE-SHA": 1, "STORE-ZRH": 1,
      "STORE-SEO": 1, "STORE-SYD": 1, "STORE-BER": 0, "STORE-MAD": 1,
      "STORE-SAO": 0, "STORE-RUH": 1, "STORE-MIA": 1, "STORE-TOR": 0, "STORE-MSC": 0,
    },
    // --- Signature Pump Nude 38 ---
    "SH-001-NUD-38": {
      "WH-CENTRAL": 14, "STORE-PAR": 2, "STORE-NYC": 2, "STORE-LON": 1,
      "STORE-TYO": 1, "STORE-DXB": 1, "STORE-HKG": 1, "STORE-MIL": 1,
      "STORE-SIN": 1, "STORE-LAX": 1, "STORE-SHA": 1, "STORE-ZRH": 0,
      "STORE-SEO": 1, "STORE-SYD": 0, "STORE-BER": 0, "STORE-MAD": 0,
      "STORE-SAO": 0, "STORE-RUH": 0, "STORE-MIA": 1, "STORE-TOR": 0, "STORE-MSC": 0,
    },
  };

  for (const variant of allVariants) {
    const variantStock = stockTable[variant.sku];
    if (!variantStock) continue;

    for (const location of locations) {
      const qty = variantStock[location.code] ?? 0;
      if (qty === 0) continue;

      await prisma.inventoryLevel.update({
        where: {
          locationId_productVariantId: {
            locationId: location.id,
            productVariantId: variant.id,
          },
        },
        data: { quantityOnHand: qty },
      });

      // Record as INITIAL_STOCK movement
      await prisma.stockMovement.create({
        data: {
          type: MovementType.INITIAL_STOCK,
          productVariantId: variant.id,
          toLocationId: location.id,
          quantity: qty,
          unitCost: Number(variant.product.unitCost),
          notes: "Opening stock balance",
          performedById: admin.id,
        },
      });
    }
  }

  console.log(`✓ Initial stock levels seeded`);

  console.log("\nSeed complete.");
  console.log(`  Locations: ${locations.length}`);
  console.log(`  Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
