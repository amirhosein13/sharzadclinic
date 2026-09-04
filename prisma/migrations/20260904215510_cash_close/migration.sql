-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "paidFromCash" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cash_closes" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "expectedCash" INTEGER NOT NULL,
    "expectedCard" INTEGER NOT NULL,
    "expectedOnline" INTEGER NOT NULL,
    "expectedOther" INTEGER NOT NULL,
    "cashExpenses" INTEGER NOT NULL DEFAULT 0,
    "countedCash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "note" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_closes_day_key" ON "cash_closes"("day");

-- CreateIndex
CREATE INDEX "cash_closes_day_idx" ON "cash_closes"("day");

-- AddForeignKey
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

