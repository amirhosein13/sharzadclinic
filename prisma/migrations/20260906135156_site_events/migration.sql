-- CreateTable
CREATE TABLE "site_events" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "serviceSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_events_kind_createdAt_idx" ON "site_events"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "site_events_serviceSlug_createdAt_idx" ON "site_events"("serviceSlug", "createdAt");

