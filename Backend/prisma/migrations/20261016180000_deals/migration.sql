-- Quadros viram funis de vendas: o card (uma conversa) vira um NEGÓCIO de um
-- contato, com a conversa opcional.
--
-- Escrita à mão: o `migrate diff` trataria a troca de nome como "apaga e cria"
-- e perderia os cards. Renomeia a tabela, as restrições e os índices (para os
-- nomes que o Prisma espera) e preenche os campos novos a partir das conversas.
--
-- Compatibilidade com a versão anterior do código: esta migration NÃO é
-- (renomeia a tabela). Vale porque nenhuma versão foi publicada ainda (não há
-- tag v*): no primeiro deploy ela roda junto com as demais, sem código antigo
-- no ar. Depois do primeiro deploy, mudanças assim precisam de duas etapas.

-- ── negócios ─────────────────────────────────────────────────────────────

ALTER TABLE "kanban"."board_cards" RENAME TO "deals";
ALTER TABLE "kanban"."deals" RENAME CONSTRAINT "board_cards_pkey" TO "deals_pkey";
ALTER TABLE "kanban"."deals" RENAME CONSTRAINT "board_cards_board_id_fkey" TO "deals_board_id_fkey";
ALTER TABLE "kanban"."deals" RENAME CONSTRAINT "board_cards_column_id_fkey" TO "deals_column_id_fkey";
ALTER INDEX "kanban"."board_cards_tenant_id_column_id_position_idx" RENAME TO "deals_tenant_id_column_id_position_idx";
ALTER INDEX "kanban"."board_cards_tenant_id_conversation_id_idx" RENAME TO "deals_tenant_id_conversation_id_idx";

-- Um contato pode ter vários negócios no mesmo funil (duas vendas diferentes).
DROP INDEX "kanban"."board_cards_board_id_conversation_id_key";

ALTER TABLE "kanban"."deals"
  ADD COLUMN "contact_id" UUID,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "value_cents" INTEGER,
  ADD COLUMN "owner_id" UUID,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN "lost_reason" TEXT,
  ADD COLUMN "closed_at" TIMESTAMPTZ(3),
  ALTER COLUMN "conversation_id" DROP NOT NULL;

-- Contato e responsável vêm da conversa; o título é o nome do contato.
UPDATE "kanban"."deals" AS d
SET "contact_id" = c."contact_id",
    "owner_id" = c."assignee_id",
    "title" = left(coalesce(nullif(trim(ct."name"), ''), ct."phone", ct."email", 'Negócio'), 120)
FROM "conversations"."conversations" AS c
LEFT JOIN "contacts"."contacts" AS ct ON ct."id" = c."contact_id"
WHERE c."id" = d."conversation_id";

-- Card de conversa que não existe mais (não deveria haver): sai.
DELETE FROM "kanban"."deals" WHERE "contact_id" IS NULL;

ALTER TABLE "kanban"."deals"
  ALTER COLUMN "contact_id" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL;

CREATE INDEX "deals_tenant_id_contact_id_board_id_idx" ON "kanban"."deals"("tenant_id", "contact_id", "board_id");

-- ── execuções das automações ─────────────────────────────────────────────

ALTER TABLE "kanban"."automation_runs" RENAME COLUMN "card_id" TO "deal_id";
ALTER TABLE "kanban"."automation_runs" ALTER COLUMN "conversation_id" DROP NOT NULL;

-- ── funis ────────────────────────────────────────────────────────────────

ALTER TABLE "kanban"."boards" ADD COLUMN "auto_add_leads" BOOLEAN NOT NULL DEFAULT false;

-- Toda conta sem funil ganha o funil padrão (contas novas o recebem no cadastro).
WITH new_boards AS (
  INSERT INTO "kanban"."boards" ("id", "tenant_id", "name", "auto_add_mode", "auto_add_leads", "created_at")
  SELECT gen_random_uuid(), t."id", 'Funil de vendas', 'all', true, now()
  FROM "accounts"."tenants" AS t
  WHERE NOT EXISTS (SELECT 1 FROM "kanban"."boards" b WHERE b."tenant_id" = t."id")
  RETURNING "id", "tenant_id"
)
INSERT INTO "kanban"."board_columns" ("id", "tenant_id", "board_id", "name", "position")
SELECT gen_random_uuid(), nb."tenant_id", nb."id", col."name", col."position"
FROM new_boards AS nb
CROSS JOIN (VALUES ('Novo', 0), ('Em contato', 1), ('Proposta', 2), ('Fechamento', 3)) AS col("name", "position");
