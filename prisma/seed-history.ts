/**
 * Historical Data Seeder
 *
 * Loads 6 months of realistic sales, transfer, and inventory data.
 * Run AFTER `npm run db:seed` (needs locations, products, variants, users).
 *
 * Usage:  npm run db:seed:history
 */

import {
  PrismaClient,
  MovementType,
  ForecastMethod,
  PurchaseOrderStatus,
  TransferOrderStatus,
  AlertType,
  AlertSeverity,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Deterministic PRNG ────────────────────────────────────────────────────
class Rng {
  private s: number;
  constructor(seed = 2026) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }
  int(lo: number, hi: number): number {
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }
  /** Poisson-distributed random integer, capped at 30 */
  poisson(λ: number): number {
    if (λ <= 0) return 0;
    const L = Math.exp(-Math.min(λ, 20));
    let k = 0,
      p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L && k < 40);
    return k - 1;
  }
}

const rng = new Rng(2026);

// ─── Date helpers (no extra deps) ──────────────────────────────────────────
const MS_PER_DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
const addWeeks = (d: Date, n: number) => addDays(d, n * 7);

// Simulation window
const START = new Date("2025-09-01T00:00:00.000Z");
const END = new Date("2026-02-28T23:59:59.999Z");

// ─── Rates & multipliers ───────────────────────────────────────────────────
/** Expected weekly unit sales by category × revenue tier */
const SALES_RATE: Record<string, Record<string, number>> = {
  Handbag: { A: 1.1, B: 0.55, C: 0.2 },
  Watch: { A: 0.55, B: 0.28, C: 0.09 },
  Shoes: { A: 1.3, B: 0.7, C: 0.28 },
};

/** Variant-level popularity multipliers */
const VARIANT_MULT: Record<string, number> = {
  "HB-001-BLK": 1.25,
  "HB-001-TAN": 1.0,
  "HB-001-BRG": 0.72,
  "WT-001-SLV": 1.1,
  "WT-001-GLD": 0.8,
  "SH-001-BLK-36": 0.85,
  "SH-001-BLK-37": 1.3,
  "SH-001-BLK-38": 1.15,
  "SH-001-NUD-37": 0.9,
  "SH-001-NUD-38": 0.72,
};

/** Monthly seasonal index */
const SEASONAL: Record<number, number> = {
  9: 1.0,
  10: 1.18,
  11: 1.6,
  12: 1.95,
  1: 0.68,
  2: 1.05,
};

// ─── Warehouse opening stock (6 months of projected demand + buffer) ────────
const WH_INIT: Record<string, number> = {
  "HB-001-BLK": 460,
  "HB-001-TAN": 340,
  "HB-001-BRG": 230,
  "WT-001-SLV": 170,
  "WT-001-GLD": 75,
  "SH-001-BLK-36": 300,
  "SH-001-BLK-37": 390,
  "SH-001-BLK-38": 350,
  "SH-001-NUD-37": 270,
  "SH-001-NUD-38": 200,
};

/** Store opening stock by variant × tier */
const STORE_INIT: Record<string, Record<string, number>> = {
  "HB-001-BLK": { A: 6, B: 3, C: 1 },
  "HB-001-TAN": { A: 4, B: 2, C: 1 },
  "HB-001-BRG": { A: 3, B: 2, C: 0 },
  "WT-001-SLV": { A: 3, B: 2, C: 1 },
  "WT-001-GLD": { A: 2, B: 1, C: 0 },
  "SH-001-BLK-36": { A: 4, B: 3, C: 1 },
  "SH-001-BLK-37": { A: 6, B: 4, C: 1 },
  "SH-001-BLK-38": { A: 5, B: 3, C: 1 },
  "SH-001-NUD-37": { A: 4, B: 2, C: 1 },
  "SH-001-NUD-38": { A: 3, B: 2, C: 0 },
};

// Replenishment thresholds (in weeks of expected demand)
const REORDER_WEEKS = 3;
const REPLENISH_TO_WEEKS = 12;

// ─── Types ─────────────────────────────────────────────────────────────────
type MovementRow = {
  type: MovementType;
  productVariantId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  quantity: number;
  unitCost: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  performedById: string;
  occurredAt: Date;
};

type ForecastRow = {
  productVariantId: string;
  locationId: string;
  periodStart: Date;
  periodEnd: Date;
  forecastedDemand: number;
  actualDemand: number;
  forecastMethod: ForecastMethod;
  confidenceLow: number;
  confidenceHigh: number;
  generatedAt: Date;
};

type CostRow = {
  date: Date;
  productVariantId: string;
  locationId: string;
  quantityOnHand: number;
  unitCost: number;
  annualCarryingRate: number;
  dailyCarryingCost: number;
};

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("🗑  Clearing existing historical data…");

  // Delete in dependency order (no FK constraint violations)
  await prisma.costRecord.deleteMany({});
  await prisma.demandForecast.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.transferOrderLine.deleteMany({});
  await prisma.transferOrder.deleteMany({});
  await prisma.purchaseOrderLine.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});

  // Reset all inventory levels to zero
  await prisma.inventoryLevel.updateMany({
    data: { quantityOnHand: 0, quantityReserved: 0, quantityInTransit: 0 },
  });

  console.log("✓ Cleared\n");

  // ── Load reference data ─────────────────────────────────────────────────
  const [locations, allVariants, admin, supplier, categoryRates] =
    await Promise.all([
      prisma.location.findMany(),
      prisma.productVariant.findMany({ include: { product: true } }),
      prisma.user.findFirst({ where: { role: "ADMIN" } }),
      prisma.supplier.findFirst(),
      prisma.categoryCarryingRate.findMany(),
    ]);

  if (!admin) throw new Error("Admin user not found — run npm run db:seed first");
  if (!supplier) throw new Error("Supplier not found — run npm run db:seed first");

  const warehouse = locations.find((l) => l.code === "WH-CENTRAL")!;
  const stores = locations.filter((l) => l.type === "STORE");
  const locationByCode = new Map(locations.map((l) => [l.code, l]));
  const variantBySku = new Map(allVariants.map((v) => [v.sku, v]));
  const rateByCategory = new Map(
    categoryRates.map((r) => [r.category, Number(r.annualRate)])
  );

  // ── Scheduled PO receipts (feed warehouse stock back into simulation) ───
  // These mirror the completed POs created in Phase 7 so the simulation
  // sees the restocked warehouse quantities at the correct dates.
  const PO_RECEIPTS: {
    arrivalDate: Date;
    sku: string;
    qty: number;
    unitCost: number;
  }[] = [
    // PO-2025-000001: Q4 holiday restocking — arrived 2025-11-18
    { arrivalDate: new Date("2025-11-18"), sku: "HB-001-BLK", qty: 100, unitCost: 850 },
    { arrivalDate: new Date("2025-11-18"), sku: "HB-001-TAN", qty: 80,  unitCost: 850 },
    { arrivalDate: new Date("2025-11-18"), sku: "HB-001-BRG", qty: 50,  unitCost: 850 },
    { arrivalDate: new Date("2025-11-18"), sku: "WT-001-SLV", qty: 40,  unitCost: 4200 },
    { arrivalDate: new Date("2025-11-18"), sku: "WT-001-GLD", qty: 20,  unitCost: 4200 },
    // PO-2026-000001: Spring footwear restocking — arrived 2026-02-05
    { arrivalDate: new Date("2026-02-05"), sku: "SH-001-BLK-36", qty: 80,  unitCost: 380 },
    { arrivalDate: new Date("2026-02-05"), sku: "SH-001-BLK-37", qty: 100, unitCost: 380 },
    { arrivalDate: new Date("2026-02-05"), sku: "SH-001-BLK-38", qty: 90,  unitCost: 380 },
    { arrivalDate: new Date("2026-02-05"), sku: "SH-001-NUD-37", qty: 80,  unitCost: 380 },
    { arrivalDate: new Date("2026-02-05"), sku: "SH-001-NUD-38", qty: 60,  unitCost: 380 },
  ];

  // ── In-memory inventory state: inv[variantId][locationId] ──────────────
  const inv: Record<string, Record<string, number>> = {};
  for (const v of allVariants) {
    inv[v.id] = {};
    for (const loc of locations) inv[v.id][loc.id] = 0;
  }

  // ── Accumulators ────────────────────────────────────────────────────────
  const movements: MovementRow[] = [];
  const forecasts: ForecastRow[] = [];

  // Weekly cost snapshots: weekEnd → variantId → locationId → qty
  const weekSnapshots: Array<{
    date: Date;
    state: Record<string, Record<string, number>>;
  }> = [];

  // ── Phase 1: Opening stock (Aug 31 2025) ────────────────────────────────
  console.log("📦 Initialising opening stock…");
  const initDay = addDays(START, -1); // Aug 31 2025

  for (const v of allVariants) {
    const whQty = WH_INIT[v.sku] ?? 60;
    inv[v.id][warehouse.id] = whQty;

    movements.push({
      type: MovementType.INITIAL_STOCK,
      productVariantId: v.id,
      fromLocationId: null,
      toLocationId: warehouse.id,
      quantity: whQty,
      unitCost: Number(v.product.unitCost),
      referenceType: null,
      referenceId: null,
      notes: "Opening warehouse stock — start of historical simulation",
      performedById: admin.id,
      occurredAt: initDay,
    });
  }

  // Distribute opening stock to stores
  for (const store of stores) {
    const tier = store.revenueTier as "A" | "B" | "C";
    for (const v of allVariants) {
      const initQtys = STORE_INIT[v.sku];
      if (!initQtys) continue;
      const qty = Math.min(initQtys[tier] ?? 0, inv[v.id][warehouse.id]);
      if (qty === 0) continue;

      inv[v.id][warehouse.id] -= qty;
      inv[v.id][store.id] += qty;

      const unitCost = Number(v.unitCost ?? v.product.unitCost);
      movements.push({
        type: MovementType.TRANSFER_OUT,
        productVariantId: v.id,
        fromLocationId: warehouse.id,
        toLocationId: store.id,
        quantity: qty,
        unitCost,
        referenceType: null,
        referenceId: null,
        notes: "Opening store allocation",
        performedById: admin.id,
        occurredAt: initDay,
      });
      movements.push({
        type: MovementType.TRANSFER_IN,
        productVariantId: v.id,
        fromLocationId: warehouse.id,
        toLocationId: store.id,
        quantity: qty,
        unitCost,
        referenceType: null,
        referenceId: null,
        notes: "Opening store allocation",
        performedById: admin.id,
        occurredAt: initDay,
      });
    }
  }

  // ── Phase 2: Weekly simulation (Sep 1 2025 → Feb 28 2026) ──────────────
  console.log("📅 Simulating 26 weeks of transactions…");

  let weekStart = START;
  let weekNum = 0;
  let totalSaleUnits = 0;
  let totalTransferUnits = 0;

  while (weekStart <= END) {
    const weekEnd = addDays(weekStart, 6);
    const clampedEnd = weekEnd > END ? END : weekEnd;
    const month = weekStart.getUTCMonth() + 1; // 1-based
    const seasonal = SEASONAL[month] ?? 1.0;

    // ── PO receipts falling within this week ──────────────────────────────
    for (const receipt of PO_RECEIPTS) {
      if (receipt.arrivalDate >= weekStart && receipt.arrivalDate <= weekEnd) {
        const v = variantBySku.get(receipt.sku);
        if (!v) continue;
        inv[v.id][warehouse.id] += receipt.qty;
        movements.push({
          type: MovementType.PURCHASE_RECEIPT,
          productVariantId: v.id,
          fromLocationId: null,
          toLocationId: warehouse.id,
          quantity: receipt.qty,
          unitCost: receipt.unitCost,
          referenceType: "PurchaseOrder",
          referenceId: null, // PO DB records created later in Phase 7
          notes: `Purchase order receipt`,
          performedById: admin.id,
          occurredAt: receipt.arrivalDate,
        });
      }
    }

    for (const v of allVariants) {
      const category = v.product.category;
      const rates = SALES_RATE[category] ?? { A: 0.5, B: 0.25, C: 0.1 };
      const varMult = VARIANT_MULT[v.sku] ?? 1.0;
      const unitCost = Number(v.unitCost ?? v.product.unitCost);

      for (const store of stores) {
        const tier = store.revenueTier as "A" | "B" | "C";
        const baseRate = rates[tier] ?? 0.1;
        const λ = baseRate * varMult * seasonal; // expected weekly demand

        // ── Replenishment ──────────────────────────────────────────────
        const storeQty = inv[v.id][store.id];
        const reorderPoint = λ * REORDER_WEEKS;

        if (storeQty < reorderPoint) {
          const warehouseQty = inv[v.id][warehouse.id];
          const targetQty = Math.ceil(λ * REPLENISH_TO_WEEKS);
          const replenishQty = Math.min(
            Math.max(targetQty - storeQty, 1),
            warehouseQty
          );

          if (replenishQty > 0) {
            inv[v.id][warehouse.id] -= replenishQty;
            inv[v.id][store.id] += replenishQty;
            totalTransferUnits += replenishQty;

            // Transfer departs Monday–Wednesday, arrives 1–4 days later
            const departDay = addDays(weekStart, rng.int(0, 2));
            const arriveDay = addDays(departDay, rng.int(1, 4));

            movements.push({
              type: MovementType.TRANSFER_OUT,
              productVariantId: v.id,
              fromLocationId: warehouse.id,
              toLocationId: store.id,
              quantity: replenishQty,
              unitCost,
              referenceType: null,
              referenceId: null,
              notes: `Replenishment wk${weekNum + 1}`,
              performedById: admin.id,
              occurredAt: departDay,
            });
            movements.push({
              type: MovementType.TRANSFER_IN,
              productVariantId: v.id,
              fromLocationId: warehouse.id,
              toLocationId: store.id,
              quantity: replenishQty,
              unitCost,
              referenceType: null,
              referenceId: null,
              notes: `Replenishment wk${weekNum + 1}`,
              performedById: admin.id,
              occurredAt: arriveDay,
            });
          }
        }

        // ── Sales ──────────────────────────────────────────────────────
        const actualSales = Math.min(rng.poisson(λ), inv[v.id][store.id]);

        if (actualSales > 0) {
          inv[v.id][store.id] -= actualSales;
          totalSaleUnits += actualSales;

          // Sales occur Mon–Sat
          const saleDay = addDays(weekStart, rng.int(0, 5));
          movements.push({
            type: MovementType.SALE,
            productVariantId: v.id,
            fromLocationId: store.id,
            toLocationId: null,
            quantity: actualSales,
            unitCost,
            referenceType: null,
            referenceId: null,
            notes: null,
            performedById: admin.id,
            occurredAt: saleDay,
          });
        }

        // ── Demand forecast for this week ──────────────────────────────
        const forecastedDemand = parseFloat(
          (λ * (0.88 + rng.next() * 0.24)).toFixed(2)
        );
        forecasts.push({
          productVariantId: v.id,
          locationId: store.id,
          periodStart: weekStart,
          periodEnd: clampedEnd,
          forecastedDemand,
          actualDemand: actualSales,
          forecastMethod: ForecastMethod.MOVING_AVG_12W,
          confidenceLow: parseFloat((forecastedDemand * 0.68).toFixed(2)),
          confidenceHigh: parseFloat((forecastedDemand * 1.32).toFixed(2)),
          generatedAt: addDays(weekStart, -1),
        });
      }
    }

    // ── End-of-week cost snapshot ──────────────────────────────────────
    const snapState: Record<string, Record<string, number>> = {};
    for (const v of allVariants) {
      snapState[v.id] = { ...inv[v.id] };
    }
    weekSnapshots.push({ date: clampedEnd, state: snapState });

    weekStart = addWeeks(weekStart, 1);
    weekNum++;
  }

  console.log(
    `   ${weekNum} weeks simulated — ${totalSaleUnits} units sold, ${totalTransferUnits} units transferred`
  );

  // ── Phase 3: Write movements (batched) ─────────────────────────────────
  console.log("\n💾 Writing stock movements…");
  const BATCH = 500;
  for (let i = 0; i < movements.length; i += BATCH) {
    await prisma.stockMovement.createMany({ data: movements.slice(i, i + BATCH) });
  }
  console.log(`   ✓ ${movements.length} movements written`);

  // ── Phase 4: Update inventory levels ───────────────────────────────────
  console.log("📊 Updating inventory levels…");
  let levelsUpdated = 0;
  for (const v of allVariants) {
    for (const loc of locations) {
      const qty = inv[v.id][loc.id] ?? 0;
      await prisma.inventoryLevel.update({
        where: {
          locationId_productVariantId: {
            locationId: loc.id,
            productVariantId: v.id,
          },
        },
        data: { quantityOnHand: qty, quantityReserved: 0, quantityInTransit: 0 },
      });
      levelsUpdated++;
    }
  }
  console.log(`   ✓ ${levelsUpdated} inventory levels updated`);

  // ── Phase 5: Write demand forecasts ────────────────────────────────────
  console.log("📈 Writing demand forecasts…");
  for (let i = 0; i < forecasts.length; i += BATCH) {
    await prisma.demandForecast.createMany({
      data: forecasts.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }
  console.log(`   ✓ ${forecasts.length} forecast records written`);

  // ── Phase 6: Write cost records (weekly snapshots) ──────────────────────
  console.log("💰 Writing cost records…");
  const costRows: CostRow[] = [];

  for (const snap of weekSnapshots) {
    for (const v of allVariants) {
      const annualRate =
        rateByCategory.get(v.product.category) ?? 0.25;
      const unitCost = Number(v.unitCost ?? v.product.unitCost);

      for (const loc of locations) {
        const qty = snap.state[v.id][loc.id] ?? 0;
        if (qty === 0) continue;
        const dailyCost = qty * unitCost * (annualRate / 365);
        costRows.push({
          date: snap.date,
          productVariantId: v.id,
          locationId: loc.id,
          quantityOnHand: qty,
          unitCost,
          annualCarryingRate: annualRate,
          dailyCarryingCost: parseFloat(dailyCost.toFixed(4)),
        });
      }
    }
  }

  for (let i = 0; i < costRows.length; i += BATCH) {
    await prisma.costRecord.createMany({
      data: costRows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }
  console.log(`   ✓ ${costRows.length} cost records written`);

  // ── Phase 7: Purchase orders ────────────────────────────────────────────
  console.log("\n📋 Creating purchase orders…");

  // PO-1: Q4 holiday restocking — completed Nov 2025
  await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-2025-000001",
      status: PurchaseOrderStatus.COMPLETED,
      supplierId: supplier.id,
      destinationId: warehouse.id,
      expectedArrival: new Date("2025-11-15"),
      actualArrival: new Date("2025-11-18"),
      totalCost: 527_000,
      currency: "EUR",
      createdById: admin.id,
      createdAt: new Date("2025-10-03"),
      notes: "Q4 holiday season replenishment — accelerated lead time approved",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-BLK")!.id,
            quantityOrdered: 100,
            quantityReceived: 100,
            unitCost: 850,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("HB-001-TAN")!.id,
            quantityOrdered: 80,
            quantityReceived: 80,
            unitCost: 850,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("HB-001-BRG")!.id,
            quantityOrdered: 50,
            quantityReceived: 50,
            unitCost: 850,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("WT-001-SLV")!.id,
            quantityOrdered: 40,
            quantityReceived: 40,
            unitCost: 4200,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("WT-001-GLD")!.id,
            quantityOrdered: 20,
            quantityReceived: 20,
            unitCost: 4200,
            currency: "EUR",
          },
        ],
      },
    },
  });

  // PO-2: Spring shoe restocking — completed Feb 5 2026
  await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-2026-000001",
      status: PurchaseOrderStatus.COMPLETED,
      supplierId: supplier.id,
      destinationId: warehouse.id,
      expectedArrival: new Date("2026-02-01"),
      actualArrival: new Date("2026-02-05"),
      totalCost: 318_400,
      currency: "EUR",
      createdById: admin.id,
      createdAt: new Date("2026-01-06"),
      notes: "Spring 2026 footwear and accessories restocking",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("SH-001-BLK-36")!.id,
            quantityOrdered: 80,
            quantityReceived: 80,
            unitCost: 380,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("SH-001-BLK-37")!.id,
            quantityOrdered: 100,
            quantityReceived: 100,
            unitCost: 380,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("SH-001-BLK-38")!.id,
            quantityOrdered: 90,
            quantityReceived: 90,
            unitCost: 380,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("SH-001-NUD-37")!.id,
            quantityOrdered: 80,
            quantityReceived: 80,
            unitCost: 380,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("SH-001-NUD-38")!.id,
            quantityOrdered: 60,
            quantityReceived: 60,
            unitCost: 380,
            currency: "EUR",
          },
        ],
      },
    },
  });

  // PO-3: Summer 2026 — sent, not yet received
  await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-2026-000002",
      status: PurchaseOrderStatus.SENT,
      supplierId: supplier.id,
      destinationId: warehouse.id,
      expectedArrival: new Date("2026-04-20"),
      totalCost: 462_000,
      currency: "EUR",
      createdById: admin.id,
      createdAt: new Date("2026-02-18"),
      notes: "Summer 2026 collection — Classic Tote new colours + Gold watch allocation",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-BLK")!.id,
            quantityOrdered: 120,
            quantityReceived: 0,
            unitCost: 850,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("HB-001-TAN")!.id,
            quantityOrdered: 80,
            quantityReceived: 0,
            unitCost: 850,
            currency: "EUR",
          },
          {
            productVariantId: variantBySku.get("WT-001-GLD")!.id,
            quantityOrdered: 25,
            quantityReceived: 0,
            unitCost: 4200,
            currency: "EUR",
          },
        ],
      },
    },
  });

  console.log("   ✓ 3 purchase orders created");

  // ── Phase 8: Transfer orders ────────────────────────────────────────────
  console.log("🚚 Creating transfer orders…");

  const par = locationByCode.get("STORE-PAR")!;
  const nyc = locationByCode.get("STORE-NYC")!;
  const tyo = locationByCode.get("STORE-TYO")!;
  const dxb = locationByCode.get("STORE-DXB")!;
  const mil = locationByCode.get("STORE-MIL")!;

  // TO-1: Completed — WH → Paris, holiday top-up
  await prisma.transferOrder.create({
    data: {
      orderNumber: "TO-2025-000001",
      status: TransferOrderStatus.COMPLETED,
      fromLocationId: warehouse.id,
      toLocationId: par.id,
      requestedById: admin.id,
      approvedById: admin.id,
      expectedArrival: new Date("2025-11-22"),
      actualArrival: new Date("2025-11-22"),
      createdAt: new Date("2025-11-16"),
      notes: "Holiday season emergency top-up — Paris flagship",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-BLK")!.id,
            quantityRequested: 10,
            quantityShipped: 10,
            quantityReceived: 10,
            unitCost: 850,
          },
          {
            productVariantId: variantBySku.get("WT-001-GLD")!.id,
            quantityRequested: 4,
            quantityShipped: 4,
            quantityReceived: 4,
            unitCost: 4200,
          },
          {
            productVariantId: variantBySku.get("SH-001-BLK-37")!.id,
            quantityRequested: 8,
            quantityShipped: 8,
            quantityReceived: 8,
            unitCost: 380,
          },
        ],
      },
    },
  });

  // TO-2: Completed — WH → NYC, post-holiday restocking
  await prisma.transferOrder.create({
    data: {
      orderNumber: "TO-2026-000001",
      status: TransferOrderStatus.COMPLETED,
      fromLocationId: warehouse.id,
      toLocationId: nyc.id,
      requestedById: admin.id,
      approvedById: admin.id,
      expectedArrival: new Date("2026-01-18"),
      actualArrival: new Date("2026-01-20"),
      createdAt: new Date("2026-01-10"),
      notes: "Post-holiday restocking — Fifth Avenue",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-BLK")!.id,
            quantityRequested: 6,
            quantityShipped: 6,
            quantityReceived: 6,
            unitCost: 850,
          },
          {
            productVariantId: variantBySku.get("HB-001-TAN")!.id,
            quantityRequested: 5,
            quantityShipped: 5,
            quantityReceived: 5,
            unitCost: 850,
          },
          {
            productVariantId: variantBySku.get("SH-001-BLK-38")!.id,
            quantityRequested: 7,
            quantityShipped: 7,
            quantityReceived: 7,
            unitCost: 380,
          },
        ],
      },
    },
  });

  // TO-3: Completed — WH → Milan
  await prisma.transferOrder.create({
    data: {
      orderNumber: "TO-2026-000002",
      status: TransferOrderStatus.COMPLETED,
      fromLocationId: warehouse.id,
      toLocationId: mil.id,
      requestedById: admin.id,
      approvedById: admin.id,
      expectedArrival: new Date("2026-02-08"),
      actualArrival: new Date("2026-02-09"),
      createdAt: new Date("2026-02-01"),
      notes: "Spring restocking for Milan Via Montenapoleone",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-BRG")!.id,
            quantityRequested: 4,
            quantityShipped: 4,
            quantityReceived: 4,
            unitCost: 850,
          },
          {
            productVariantId: variantBySku.get("SH-001-NUD-37")!.id,
            quantityRequested: 5,
            quantityShipped: 5,
            quantityReceived: 5,
            unitCost: 380,
          },
        ],
      },
    },
  });

  // TO-4: In transit — WH → Tokyo (expected Mar 5 2026)
  const toTyo = await prisma.transferOrder.create({
    data: {
      orderNumber: "TO-2026-000003",
      status: TransferOrderStatus.IN_TRANSIT,
      fromLocationId: warehouse.id,
      toLocationId: tyo.id,
      requestedById: admin.id,
      approvedById: admin.id,
      expectedArrival: new Date("2026-03-05"),
      createdAt: new Date("2026-02-21"),
      notes: "Spring replenishment — Tokyo Ginza",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-BLK")!.id,
            quantityRequested: 5,
            quantityShipped: 5,
            quantityReceived: 0,
            unitCost: 850,
          },
          {
            productVariantId: variantBySku.get("WT-001-SLV")!.id,
            quantityRequested: 3,
            quantityShipped: 3,
            quantityReceived: 0,
            unitCost: 4200,
          },
          {
            productVariantId: variantBySku.get("SH-001-BLK-37")!.id,
            quantityRequested: 6,
            quantityShipped: 6,
            quantityReceived: 0,
            unitCost: 380,
          },
        ],
      },
    },
  });

  // Reflect in-transit quantities on destination inventory levels
  await prisma.inventoryLevel.update({
    where: {
      locationId_productVariantId: {
        locationId: tyo.id,
        productVariantId: variantBySku.get("HB-001-BLK")!.id,
      },
    },
    data: { quantityInTransit: 5 },
  });
  await prisma.inventoryLevel.update({
    where: {
      locationId_productVariantId: {
        locationId: tyo.id,
        productVariantId: variantBySku.get("WT-001-SLV")!.id,
      },
    },
    data: { quantityInTransit: 3 },
  });
  await prisma.inventoryLevel.update({
    where: {
      locationId_productVariantId: {
        locationId: tyo.id,
        productVariantId: variantBySku.get("SH-001-BLK-37")!.id,
      },
    },
    data: { quantityInTransit: 6 },
  });

  // TO-5: Draft — WH → Dubai (proposed)
  await prisma.transferOrder.create({
    data: {
      orderNumber: "TO-2026-000004",
      status: TransferOrderStatus.DRAFT,
      fromLocationId: warehouse.id,
      toLocationId: dxb.id,
      requestedById: admin.id,
      createdAt: new Date("2026-02-26"),
      notes: "Proposed spring allocation for Dubai Mall — pending approval",
      lines: {
        create: [
          {
            productVariantId: variantBySku.get("HB-001-TAN")!.id,
            quantityRequested: 5,
            quantityShipped: 0,
            quantityReceived: 0,
            unitCost: 850,
          },
          {
            productVariantId: variantBySku.get("WT-001-SLV")!.id,
            quantityRequested: 4,
            quantityShipped: 0,
            quantityReceived: 0,
            unitCost: 4200,
          },
          {
            productVariantId: variantBySku.get("SH-001-BLK-36")!.id,
            quantityRequested: 4,
            quantityShipped: 0,
            quantityReceived: 0,
            unitCost: 380,
          },
        ],
      },
    },
  });

  console.log("   ✓ 5 transfer orders created (2 completed, 1 in-transit, 1 draft + 1 more completed)");

  // ── Phase 9: Alerts based on final inventory state ──────────────────────
  console.log("🔔 Generating alerts…");
  const alertRows: {
    type: AlertType;
    severity: AlertSeverity;
    productVariantId: string;
    locationId: string;
    message: string;
    isRead: boolean;
    isResolved: boolean;
  }[] = [];

  for (const v of allVariants) {
    // Warehouse low-stock alerts
    const whQty = inv[v.id][warehouse.id] ?? 0;
    const initQty = WH_INIT[v.sku] ?? 60;
    if (whQty < initQty * 0.12) {
      alertRows.push({
        type: AlertType.REORDER_TRIGGERED,
        severity: AlertSeverity.CRITICAL,
        productVariantId: v.id,
        locationId: warehouse.id,
        message: `Warehouse stock for ${v.sku} critically low: ${whQty} units remaining (${Math.round((whQty / initQty) * 100)}% of opening). Reorder recommended.`,
        isRead: false,
        isResolved: false,
      });
    } else if (whQty < initQty * 0.2) {
      alertRows.push({
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        productVariantId: v.id,
        locationId: warehouse.id,
        message: `Warehouse stock for ${v.sku} below 20%: ${whQty} units remaining.`,
        isRead: false,
        isResolved: false,
      });
    }

    // Store stockout / low-stock alerts
    for (const store of stores) {
      const qty = inv[v.id][store.id] ?? 0;
      if (qty === 0 && store.revenueTier !== "C") {
        alertRows.push({
          type: AlertType.STOCKOUT,
          severity: AlertSeverity.CRITICAL,
          productVariantId: v.id,
          locationId: store.id,
          message: `STOCKOUT: ${v.sku} has zero stock at ${store.name}. Immediate replenishment required.`,
          isRead: false,
          isResolved: false,
        });
      } else if (qty === 1 && store.revenueTier === "A") {
        alertRows.push({
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING,
          productVariantId: v.id,
          locationId: store.id,
          message: `Low stock: ${v.sku} has only 1 unit remaining at ${store.name} (Tier A).`,
          isRead: true,
          isResolved: false,
        });
      }
    }
  }

  // Cap at 60 alerts to keep UI manageable
  const cappedAlerts = alertRows.slice(0, 60);
  if (cappedAlerts.length > 0) {
    await prisma.alert.createMany({ data: cappedAlerts });
  }

  // Add a delayed shipment alert for the in-transit TO
  await prisma.alert.create({
    data: {
      type: AlertType.DELAYED_SHIPMENT,
      severity: AlertSeverity.INFO,
      referenceType: "TransferOrder",
      referenceId: toTyo.id,
      locationId: tyo.id,
      message: `TO-2026-000003 (WH → Tokyo) is in transit — expected arrival 2026-03-05. Monitor for delays.`,
      isRead: false,
      isResolved: false,
    },
  });

  console.log(`   ✓ ${cappedAlerts.length + 1} alerts created`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n✅ Historical data loaded successfully!\n");
  console.log(`   Stock movements : ${movements.length.toLocaleString()}`);
  console.log(`   Inventory rows  : ${levelsUpdated}`);
  console.log(`   Demand forecasts: ${forecasts.length.toLocaleString()}`);
  console.log(`   Cost records    : ${costRows.length.toLocaleString()}`);
  console.log(`   Purchase orders : 3`);
  console.log(`   Transfer orders : 5`);
  console.log(`   Alerts          : ${cappedAlerts.length + 1}`);
  console.log(`   Units sold      : ${totalSaleUnits.toLocaleString()}`);
  console.log(`   Units transferred: ${totalTransferUnits.toLocaleString()}`);

  console.log("\n📊 Final inventory snapshot:");
  console.log(
    `   ${"SKU".padEnd(20)} ${"Warehouse".padStart(10)} ${"Stores total".padStart(14)}`
  );
  console.log("   " + "─".repeat(46));
  for (const v of allVariants) {
    const wh = inv[v.id][warehouse.id] ?? 0;
    const storeTotal = stores.reduce(
      (s, loc) => s + (inv[v.id][loc.id] ?? 0),
      0
    );
    console.log(
      `   ${v.sku.padEnd(20)} ${String(wh).padStart(10)} ${String(storeTotal).padStart(14)}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
