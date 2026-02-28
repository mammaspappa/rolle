import { db } from "@/server/db";
import { getVariantsNeedingAllocation } from "@/server/services/allocation.service";
import { AllocationClient } from "./AllocationClient";

async function getVariants() {
  const needingAllocation = await getVariantsNeedingAllocation();

  // Also get all active variants for the picker (even those not needing allocation)
  const all = await db.productVariant.findMany({
    where: { isActive: true },
    include: { product: { select: { name: true, brand: true } } },
    orderBy: [{ product: { brand: "asc" } }, { sku: "asc" }],
  });

  return { needingAllocation, all };
}

async function getWarehouse() {
  return db.location.findFirst({
    where: { type: "WAREHOUSE", isActive: true },
    select: { id: true, code: true, name: true },
  });
}

export default async function AllocationPage() {
  const [{ needingAllocation, all }, warehouse] = await Promise.all([
    getVariants(),
    getWarehouse(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Allocation Engine</h1>
        <p className="text-sm text-slate-500 mt-1">
          When warehouse stock is insufficient for all stores, score and allocate fairly.
          Proposals require manual approval — nothing executes automatically.
        </p>
      </div>

      <AllocationClient
        variantsNeedingAllocation={needingAllocation}
        allVariants={all.map((v) => ({
          id: v.id,
          sku: v.sku,
          productName: v.product.name,
          brand: v.product.brand,
          color: v.color,
          size: v.size,
        }))}
        warehouseId={warehouse?.id ?? ""}
      />
    </div>
  );
}
