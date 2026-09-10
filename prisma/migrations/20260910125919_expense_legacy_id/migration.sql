-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "legacyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "expenses_legacyId_key" ON "expenses"("legacyId");

