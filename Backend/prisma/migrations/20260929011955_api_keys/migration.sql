-- CreateTable
CREATE TABLE "accounts"."api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_created_at_idx" ON "accounts"."api_keys"("tenant_id", "created_at" DESC);

-- Permissão nova (integrations:manage) para os cargos Admin já existentes
-- (o Admin tem tudo, menos account:manage). O Owner não precisa: no código,
-- ele sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'integrations:manage')
WHERE "key" = 'admin' AND NOT ('integrations:manage' = ANY("permissions"));
