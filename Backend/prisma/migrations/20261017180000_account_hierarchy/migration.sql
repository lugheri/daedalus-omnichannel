-- AlterTable
ALTER TABLE "accounts"."memberships" ADD COLUMN     "delegated_from_membership_id" UUID;

-- AlterTable
ALTER TABLE "accounts"."tenants" ADD COLUMN     "ancestors" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "is_root" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" UUID;

-- CreateTable
CREATE TABLE "accounts"."parent_accesses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "from_tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parent_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parent_accesses_tenant_id_created_at_idx" ON "accounts"."parent_accesses"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenants_parent_id_idx" ON "accounts"."tenants"("parent_id");

-- CreateIndex
CREATE INDEX "tenants_ancestors_idx" ON "accounts"."tenants" USING GIN ("ancestors");


-- Permissão nova (accounts:children) para o cargo Admin já existente, como nos
-- cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'accounts:children')
WHERE "key" = 'admin' AND NOT ('accounts:children' = ANY("permissions"));

-- A conta da plataforma (raiz) é definida depois, pelo comando
-- `node dist/designate-root.js <slug>`: ele pendura nela as contas sem mãe.
