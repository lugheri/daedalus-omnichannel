-- AlterTable
ALTER TABLE "sites"."sites" ADD COLUMN     "custom_domain" TEXT,
ADD COLUMN     "domain_checked_at" TIMESTAMPTZ(3),
ADD COLUMN     "domain_status" TEXT,
ADD COLUMN     "published_domain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sites_custom_domain_key" ON "sites"."sites"("custom_domain");

