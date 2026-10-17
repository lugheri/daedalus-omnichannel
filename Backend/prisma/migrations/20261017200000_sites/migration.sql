
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sites";

-- CreateTable
CREATE TABLE "sites"."templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "description" TEXT,
    "html" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites"."sites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "published_slug" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "pending_action" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites"."assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "file_name" TEXT,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_tenant_id_name_idx" ON "sites"."templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "templates_available_idx" ON "sites"."templates"("available");

-- CreateIndex
CREATE UNIQUE INDEX "sites_tenant_id_key" ON "sites"."sites"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sites_slug_key" ON "sites"."sites"("slug");

-- CreateIndex
CREATE INDEX "sites_template_id_idx" ON "sites"."sites"("template_id");

-- CreateIndex
CREATE INDEX "assets_tenant_id_created_at_idx" ON "sites"."assets"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sites"."sites" ADD CONSTRAINT "sites_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sites"."templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Permissão nova (sites:manage) para o cargo Admin já existente, como nos
-- cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'sites:manage')
WHERE "key" = 'admin' AND NOT ('sites:manage' = ANY("permissions"));
