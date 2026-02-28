-- CreateIndex
CREATE INDEX "CostRecord_locationId_date_idx" ON "CostRecord"("locationId", "date");

-- CreateIndex
CREATE INDEX "DemandForecast_locationId_periodStart_idx" ON "DemandForecast"("locationId", "periodStart");

-- CreateIndex
CREATE INDEX "StockMovement_type_productVariantId_occurredAt_idx" ON "StockMovement"("type", "productVariantId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_fromLocationId_occurredAt_idx" ON "StockMovement"("type", "fromLocationId", "occurredAt");
