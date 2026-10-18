-- DropIndex
DROP INDEX "sites"."templates_available_idx";

-- AlterTable
ALTER TABLE "forms"."form_submissions" ADD COLUMN     "source_ref" TEXT;

-- AlterTable
ALTER TABLE "sites"."templates" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'site';

-- CreateTable
CREATE TABLE "sites"."landing_pages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "form_id" UUID,
    "pending_action" TEXT,
    "last_error" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "published_folders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_path" TEXT,
    "published_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites"."landing_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "landing_page_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "weight" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "landing_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites"."landing_views" (
    "variant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "tenant_id" UUID NOT NULL,
    "views" INTEGER NOT NULL,

    CONSTRAINT "landing_views_pkey" PRIMARY KEY ("variant_id","day")
);

-- CreateTable
CREATE TABLE "sites"."landing_conversions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "landing_page_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "landing_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_pages_tenant_id_created_at_idx" ON "sites"."landing_pages"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_tenant_id_path_key" ON "sites"."landing_pages"("tenant_id", "path");

-- CreateIndex
CREATE INDEX "landing_variants_template_id_idx" ON "sites"."landing_variants"("template_id");

-- CreateIndex
CREATE INDEX "landing_variants_tenant_id_idx" ON "sites"."landing_variants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "landing_variants_landing_page_id_code_key" ON "sites"."landing_variants"("landing_page_id", "code");

-- CreateIndex
CREATE INDEX "landing_views_tenant_id_idx" ON "sites"."landing_views"("tenant_id");

-- CreateIndex
CREATE INDEX "landing_conversions_tenant_id_variant_id_idx" ON "sites"."landing_conversions"("tenant_id", "variant_id");

-- CreateIndex
CREATE INDEX "landing_conversions_landing_page_id_idx" ON "sites"."landing_conversions"("landing_page_id");

-- CreateIndex
CREATE INDEX "templates_available_kind_idx" ON "sites"."templates"("available", "kind");

-- AddForeignKey
ALTER TABLE "sites"."landing_variants" ADD CONSTRAINT "landing_variants_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "sites"."landing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites"."landing_variants" ADD CONSTRAINT "landing_variants_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sites"."templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

