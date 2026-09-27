-- DropIndex
DROP INDEX "conversations"."messages_tenant_id_conversation_id_id_idx";

-- CreateIndex
CREATE INDEX "messages_tenant_id_conversation_id_sent_at_id_idx" ON "conversations"."messages"("tenant_id", "conversation_id", "sent_at" DESC, "id" DESC);
