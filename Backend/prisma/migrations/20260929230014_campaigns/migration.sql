-- CreateTable
CREATE TABLE "messaging"."campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "audience_cursor" TEXT,
    "queued_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_no_address" INTEGER NOT NULL DEFAULT 0,
    "skipped_opted_out" INTEGER NOT NULL DEFAULT 0,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_created_at_idx" ON "messaging"."campaigns"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "campaigns_status_scheduled_at_idx" ON "messaging"."campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_campaign_id_contact_id_key" ON "messaging"."outbound_messages"("campaign_id", "contact_id");


-- Permissão nova (campaigns:manage) para os cargos Admin e Supervisor já
-- existentes, como nos cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'campaigns:manage')
WHERE "key" IN ('admin', 'supervisor') AND NOT ('campaigns:manage' = ANY("permissions"));
