-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ForecastMethod" ADD VALUE 'HOLT_WINTERS';
ALTER TYPE "ForecastMethod" ADD VALUE 'CROSTON_SBC';
ALTER TYPE "ForecastMethod" ADD VALUE 'ENSEMBLE';

-- AlterTable
ALTER TABLE "DemandForecast" ADD COLUMN     "mapeScore" DECIMAL(6,4);
