-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "holdExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "depositAmount" INTEGER;

