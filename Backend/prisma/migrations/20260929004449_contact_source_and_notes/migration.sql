-- AlterTable
ALTER TABLE "contacts"."contacts" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "source_detail" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "contacts"."contact_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "author_membership_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_notes_tenant_id_contact_id_id_idx" ON "contacts"."contact_notes"("tenant_id", "contact_id", "id" DESC);

-- CreateIndex
CREATE INDEX "contacts_tenant_id_source_idx" ON "contacts"."contacts"("tenant_id", "source");

-- AddForeignKey
ALTER TABLE "contacts"."contact_notes" ADD CONSTRAINT "contact_notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dados: contatos que já têm conversa vieram do WhatsApp (criados pela
-- primeira mensagem); os demais ficam como "manual" (o padrão da coluna).
UPDATE "contacts"."contacts" c
SET "source" = 'whatsapp'
WHERE EXISTS (
  SELECT 1 FROM "conversations"."conversations" v WHERE v."contact_id" = c."id"
);
