-- CreateEnum
CREATE TYPE "SuggestionArea" AS ENUM ('INVENTORY', 'FORECASTS', 'ALLOCATION', 'ALERTS', 'REPORTS', 'PURCHASE_ORDERS', 'TRANSFER_ORDERS', 'OTHER');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'PLANNED', 'REJECTED');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "area" "SuggestionArea" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_area_idx" ON "Suggestion"("area");

-- CreateIndex
CREATE INDEX "Suggestion_submittedById_idx" ON "Suggestion"("submittedById");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
