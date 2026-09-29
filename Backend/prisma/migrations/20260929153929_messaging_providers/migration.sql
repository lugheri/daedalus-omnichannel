-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "messaging";

-- CreateTable
CREATE TABLE "messaging"."providers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "secret" TEXT NOT NULL,
    "secret_hint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_checked_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_tenant_id_channel_key" ON "messaging"."providers"("tenant_id", "channel");

-- Permissão nova (messaging:manage) para os cargos Admin já existentes
-- (o Admin tem tudo, menos account:manage). O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'messaging:manage')
WHERE "key" = 'admin' AND NOT ('messaging:manage' = ANY("permissions"));
