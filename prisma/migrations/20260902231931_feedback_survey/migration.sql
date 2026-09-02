-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'SUBMITTED', 'SEEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "serviceId" TEXT,
    "staffId" TEXT,
    "token" TEXT NOT NULL,
    "rating" INTEGER,
    "goodTags" TEXT[],
    "badTags" TEXT[],
    "comment" TEXT,
    "wouldRecommend" BOOLEAN,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "managerNote" TEXT,
    "handledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_appointmentId_key" ON "feedbacks"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_token_key" ON "feedbacks"("token");

-- CreateIndex
CREATE INDEX "feedbacks_status_submittedAt_idx" ON "feedbacks"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "feedbacks_rating_idx" ON "feedbacks"("rating");

-- CreateIndex
CREATE INDEX "feedbacks_customerId_idx" ON "feedbacks"("customerId");

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

