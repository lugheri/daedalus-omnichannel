-- CreateTable
CREATE TABLE "messaging"."outbound_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "contact_id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "provider_message_id" TEXT,
    "sent_by_membership_id" UUID,
    "campaign_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."opt_outs" (
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opt_outs_pkey" PRIMARY KEY ("tenant_id","channel","address")
);

-- CreateIndex
CREATE INDEX "outbound_messages_tenant_id_contact_id_created_at_idx" ON "messaging"."outbound_messages"("tenant_id", "contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outbound_messages_tenant_id_campaign_id_idx" ON "messaging"."outbound_messages"("tenant_id", "campaign_id");

-- Permissão nova (messaging:send) para os cargos padrão já existentes
-- (Admin, Supervisor e Agent), como nos cargos de contas novas.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'messaging:send')
WHERE "key" IN ('admin', 'supervisor', 'agent') AND NOT ('messaging:send' = ANY("permissions"));
