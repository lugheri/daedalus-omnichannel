-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "conversations";

-- CreateTable
CREATE TABLE "conversations"."conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "assignee_id" UUID,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "last_message_preview" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations"."messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "external_id" TEXT,
    "status" TEXT NOT NULL,
    "sender_membership_id" UUID,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_tenant_id_status_last_message_at_id_idx" ON "conversations"."conversations"("tenant_id", "status", "last_message_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "conversations_tenant_id_assignee_id_last_message_at_idx" ON "conversations"."conversations"("tenant_id", "assignee_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenant_id_channel_id_contact_id_key" ON "conversations"."conversations"("tenant_id", "channel_id", "contact_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_conversation_id_id_idx" ON "conversations"."messages"("tenant_id", "conversation_id", "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_channel_id_external_id_key" ON "conversations"."messages"("channel_id", "external_id");

-- AddForeignKey
ALTER TABLE "conversations"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
