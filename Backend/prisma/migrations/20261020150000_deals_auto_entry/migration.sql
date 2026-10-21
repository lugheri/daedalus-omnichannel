-- Entrada automática nos funis sem negócio duplicado (revisão pré-homologação, P0 12a).
--
-- O DealEntry procura "negócio em aberto do contato no funil" e, se não acha,
-- cria. Com a fila de eventos em concorrência 10, dois eventos do mesmo
-- contato (ex.: conversation.started + contact.lead-captured, ou o formulário
-- e a agenda do site) leem "não tem" juntos e os dois criam. Este índice faz o
-- banco recusar o segundo; o handler trata a recusa como "já existe".
--
-- Por que PARCIAL e só com auto_entry (e não todo negócio em aberto): o produto
-- permite vários negócios do mesmo contato no mesmo funil quando abertos À MÃO
-- (e reabrir um fechado); um único em (tenant, funil, contato) WHERE open
-- quebraria essas duas regras. A corrida a fechar é entre entradas automáticas.
--
-- Compatível com a versão anterior do código: a coluna nova tem default e a
-- versão anterior não a conhece (insere false, não a atualiza). O índice nasce
-- VAZIO — todas as linhas existentes ficam com auto_entry = false —, então não
-- falha mesmo que já existam negócios automáticos duplicados; eles continuam
-- como estão (não há produção ainda) e só os novos passam a ser protegidos.
-- ADD COLUMN com default constante não reescreve a tabela (Postgres 11+).
--
-- O Prisma não modela índice parcial: ele fica só aqui (ver kanban.prisma).

-- AlterTable
ALTER TABLE "kanban"."deals" ADD COLUMN "auto_entry" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "deals_auto_entry_open_key" ON "kanban"."deals"("tenant_id", "board_id", "contact_id") WHERE "status" = 'open' AND "auto_entry";
