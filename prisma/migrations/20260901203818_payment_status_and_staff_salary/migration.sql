-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "authority" TEXT,
ADD COLUMN     "gateway" TEXT,
ADD COLUMN     "refId" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "paidAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "baseSalary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commissionPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "payments_authority_key" ON "payments"("authority");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

