-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "kanban";

-- CreateTable
CREATE TABLE "kanban"."boards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "auto_add_mode" TEXT NOT NULL DEFAULT 'none',
    "auto_add_team_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban"."board_columns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban"."board_cards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "entered_column_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "board_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boards_tenant_id_auto_add_mode_idx" ON "kanban"."boards"("tenant_id", "auto_add_mode");

-- CreateIndex
CREATE UNIQUE INDEX "boards_tenant_id_name_key" ON "kanban"."boards"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "board_columns_tenant_id_board_id_position_idx" ON "kanban"."board_columns"("tenant_id", "board_id", "position");

-- CreateIndex
CREATE INDEX "board_cards_tenant_id_column_id_position_idx" ON "kanban"."board_cards"("tenant_id", "column_id", "position");

-- CreateIndex
CREATE INDEX "board_cards_tenant_id_conversation_id_idx" ON "kanban"."board_cards"("tenant_id", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_cards_board_id_conversation_id_key" ON "kanban"."board_cards"("board_id", "conversation_id");

-- AddForeignKey
ALTER TABLE "kanban"."board_columns" ADD CONSTRAINT "board_columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "kanban"."boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban"."board_cards" ADD CONSTRAINT "board_cards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "kanban"."boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban"."board_cards" ADD CONSTRAINT "board_cards_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "kanban"."board_columns"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Permissão nova (boards:manage) para os cargos Admin e Supervisor já
-- existentes, como nos cargos padrão. O Owner sempre tem o catálogo inteiro.
UPDATE "accounts"."roles"
SET "permissions" = array_append("permissions", 'boards:manage')
WHERE "key" IN ('admin', 'supervisor') AND NOT ('boards:manage' = ANY("permissions"));
