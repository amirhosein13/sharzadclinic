-- CreateIndex
CREATE INDEX "audit_logs_action_detail_createdAt_idx" ON "audit_logs"("action", "detail", "createdAt");

