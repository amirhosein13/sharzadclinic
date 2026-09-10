-- DropIndex
DROP INDEX "customers_phone_key";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "legacyFileNo" TEXT;

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_legacyFileNo_idx" ON "customers"("legacyFileNo");

