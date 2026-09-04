-- CreateTable
CREATE TABLE "consent_template_services" (
    "templateId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "consent_template_services_pkey" PRIMARY KEY ("templateId","serviceId")
);

-- CreateIndex
CREATE INDEX "consent_template_services_serviceId_idx" ON "consent_template_services"("serviceId");

-- AddForeignKey
ALTER TABLE "consent_template_services" ADD CONSTRAINT "consent_template_services_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "consent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_template_services" ADD CONSTRAINT "consent_template_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

