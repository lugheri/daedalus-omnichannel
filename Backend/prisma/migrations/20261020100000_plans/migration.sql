-- AlterTable
ALTER TABLE "accounts"."tenants" ADD COLUMN     "plan_id" UUID;

-- CreateTable
CREATE TABLE "accounts"."plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "resellable" BOOLEAN NOT NULL,
    "is_default" BOOLEAN NOT NULL,
    "archived" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenants_plan_id_idx" ON "accounts"."tenants"("plan_id");

-- AddForeignKey
ALTER TABLE "accounts"."tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "accounts"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Um só plano padrão (o Prisma não modela índice parcial: fica só aqui).
CREATE UNIQUE INDEX "plans_single_default" ON "accounts"."plans"("is_default") WHERE "is_default";

-- Plano padrão inicial: tudo liberado (as landing pages no limite que já valia).
-- As contas existentes ficam sem plano escolhido = o padrão: nada muda para elas.
INSERT INTO "accounts"."plans" ("id", "name", "description", "limits", "features", "resellable", "is_default", "archived", "created_at", "updated_at")
VALUES (
  '0199f000-0000-7000-8000-000000000001',
  'Padrão',
  'Plano inicial: tudo liberado. Ajuste os limites ou crie outros planos.',
  '{"members": null, "whatsappChannels": null, "webChatChannels": null, "forms": null, "landingPages": 30, "childAccounts": null}',
  '{"campaigns": true, "automations": true, "onlineBooking": true, "abTesting": true}',
  true, true, false, now(), now()
);
