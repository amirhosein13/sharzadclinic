-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "smsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "serviceId" TEXT,
    "inactiveMonths" INTEGER,
    "onlyWithVisits" BOOLEAN NOT NULL DEFAULT false,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_status_idx" ON "campaign_recipients"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaignId_customerId_key" ON "campaign_recipients"("campaignId", "customerId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

