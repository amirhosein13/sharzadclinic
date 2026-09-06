-- AlterTable
ALTER TABLE "consent_signatures" ADD COLUMN     "allowPhotoPublish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "photoPublishAllowed" BOOLEAN;

-- AlterTable
ALTER TABLE "gallery_items" ADD COLUMN     "treatmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gallery_items_treatmentId_key" ON "gallery_items"("treatmentId");

