-- AlterTable
ALTER TABLE "conversations"."messages" ADD COLUMN     "automated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "kanban"."automation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "idle_minutes" INTEGER,
    "disposition_id" UUID,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "active_since" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban"."automation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_tenant_id_board_id_idx" ON "kanban"."automation_rules"("tenant_id", "board_id");

-- CreateIndex
CREATE INDEX "automation_rules_tenant_id_column_id_trigger_type_idx" ON "kanban"."automation_rules"("tenant_id", "column_id", "trigger_type");

-- CreateIndex
CREATE INDEX "automation_rules_trigger_type_enabled_idx" ON "kanban"."automation_rules"("trigger_type", "enabled");

-- CreateIndex
CREATE INDEX "automation_runs_tenant_id_rule_id_created_at_idx" ON "kanban"."automation_runs"("tenant_id", "rule_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_rule_id_dedupe_key_key" ON "kanban"."automation_runs"("rule_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "kanban"."automation_rules" ADD CONSTRAINT "automation_rules_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "kanban"."boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban"."automation_rules" ADD CONSTRAINT "automation_rules_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "kanban"."board_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban"."automation_runs" ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "kanban"."automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
