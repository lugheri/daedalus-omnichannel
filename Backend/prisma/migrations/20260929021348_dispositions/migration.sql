-- AlterTable
ALTER TABLE "conversations"."conversations" ADD COLUMN     "disposition_id" UUID;

-- CreateTable
CREATE TABLE "conversations"."dispositions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations"."conversation_dispositions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "disposition_id" UUID NOT NULL,
    "note" TEXT,
    "membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversation_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispositions_tenant_id_name_key" ON "conversations"."dispositions"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "conversation_dispositions_tenant_id_conversation_id_created_idx" ON "conversations"."conversation_dispositions"("tenant_id", "conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "conversation_dispositions_tenant_id_disposition_id_idx" ON "conversations"."conversation_dispositions"("tenant_id", "disposition_id");

-- AddForeignKey
ALTER TABLE "conversations"."conversation_dispositions" ADD CONSTRAINT "conversation_dispositions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations"."conversation_dispositions" ADD CONSTRAINT "conversation_dispositions_disposition_id_fkey" FOREIGN KEY ("disposition_id") REFERENCES "conversations"."dispositions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permissão nova (dispositions:manage) para os cargos Admin e Supervisor já
-- existentes, como nos cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'dispositions:manage')
WHERE "key" IN ('admin', 'supervisor') AND NOT ('dispositions:manage' = ANY("permissions"));
