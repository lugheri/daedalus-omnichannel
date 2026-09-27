-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "teams";

-- AlterTable
ALTER TABLE "channels"."channels" ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "conversations"."conversations" ADD COLUMN     "team_id" UUID;

-- CreateTable
CREATE TABLE "teams"."teams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams"."team_members" (
    "team_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","membership_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_tenant_id_name_key" ON "teams"."teams"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "team_members_tenant_id_membership_id_idx" ON "teams"."team_members"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_team_id_last_message_at_idx" ON "conversations"."conversations"("tenant_id", "team_id", "last_message_at" DESC);

-- AddForeignKey
ALTER TABLE "teams"."team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
