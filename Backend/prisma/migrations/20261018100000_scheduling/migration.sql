-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "scheduling";

-- CreateTable
CREATE TABLE "scheduling"."professional_schedules" (
    "professional_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "weekly" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professional_schedules_pkey" PRIMARY KEY ("professional_id")
);

-- CreateTable
CREATE TABLE "scheduling"."time_offs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "time_offs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "price_cents" INTEGER,
    "contact_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "cancel_reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."booking_settings" (
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "public_key" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "slot_step_minutes" INTEGER NOT NULL,
    "min_notice_minutes" INTEGER NOT NULL,
    "max_days_ahead" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "professional_schedules_tenant_id_idx" ON "scheduling"."professional_schedules"("tenant_id");

-- CreateIndex
CREATE INDEX "time_offs_tenant_id_professional_id_starts_at_idx" ON "scheduling"."time_offs"("tenant_id", "professional_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_starts_at_idx" ON "scheduling"."appointments"("tenant_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_professional_id_starts_at_idx" ON "scheduling"."appointments"("tenant_id", "professional_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_contact_id_starts_at_idx" ON "scheduling"."appointments"("tenant_id", "contact_id", "starts_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "booking_settings_public_key_key" ON "scheduling"."booking_settings"("public_key");


-- Dois agendamentos ativos do mesmo profissional não se cruzam: garantido no
-- banco (o site e a equipe podem marcar o mesmo horário ao mesmo tempo).
-- Intervalo meio-aberto [início, fim): terminar às 10h e começar às 10h pode.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "scheduling"."appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" = 'scheduled');

-- Permissão nova (agenda:manage) para os cargos padrão já existentes, como nos
-- cargos padrão novos. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'agenda:manage')
WHERE "key" IN ('admin', 'supervisor', 'agent') AND NOT ('agenda:manage' = ANY("permissions"));
