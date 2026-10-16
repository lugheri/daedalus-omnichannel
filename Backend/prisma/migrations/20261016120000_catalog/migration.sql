-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateTable
CREATE TABLE "catalog"."services" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price_cents" INTEGER,
    "show_on_site" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."professionals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "membership_id" UUID,
    "show_on_site" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."professional_services" (
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "professional_services_pkey" PRIMARY KEY ("professional_id","service_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_tenant_id_name_key" ON "catalog"."services"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "professionals_tenant_id_name_idx" ON "catalog"."professionals"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_tenant_id_membership_id_key" ON "catalog"."professionals"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "professional_services_tenant_id_service_id_idx" ON "catalog"."professional_services"("tenant_id", "service_id");

-- AddForeignKey
ALTER TABLE "catalog"."professional_services" ADD CONSTRAINT "professional_services_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "catalog"."professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."professional_services" ADD CONSTRAINT "professional_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalog"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Permissão nova (catalog:manage) para o cargo Admin já existente, como nos
-- cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'catalog:manage')
WHERE "key" = 'admin' AND NOT ('catalog:manage' = ANY("permissions"));
