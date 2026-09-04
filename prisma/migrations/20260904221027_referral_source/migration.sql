-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "referralNote" TEXT,
ADD COLUMN     "referralSource" TEXT;

-- CreateIndex
CREATE INDEX "customers_referralSource_idx" ON "customers"("referralSource");

