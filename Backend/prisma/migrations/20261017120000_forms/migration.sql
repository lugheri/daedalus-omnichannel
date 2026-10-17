-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "forms";

-- CreateTable
CREATE TABLE "forms"."forms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "campaign" TEXT,
    "success_url" TEXT,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms"."form_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "service_id" UUID,
    "service_name" TEXT,
    "preferred_date" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forms_public_key_key" ON "forms"."forms"("public_key");

-- CreateIndex
CREATE INDEX "forms_tenant_id_created_at_idx" ON "forms"."forms"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "form_submissions_tenant_id_form_id_created_at_idx" ON "forms"."form_submissions"("tenant_id", "form_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "form_submissions_tenant_id_contact_id_created_at_idx" ON "forms"."form_submissions"("tenant_id", "contact_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "forms"."form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"."forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Permissão nova (forms:manage) para o cargo Admin já existente, como nos
-- cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'forms:manage')
WHERE "key" = 'admin' AND NOT ('forms:manage' = ANY("permissions"));
