-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "channels";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "whatsapp_connector";

-- CreateTable
CREATE TABLE "channels"."channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "phone_number" TEXT,
    "status_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "status_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_connector"."sessions" (
    "channel_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "desired_state" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("channel_id")
);

-- CreateTable
CREATE TABLE "whatsapp_connector"."auth_entries" (
    "channel_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_entries_pkey" PRIMARY KEY ("channel_id","key")
);

-- CreateIndex
CREATE INDEX "channels_tenant_id_id_idx" ON "channels"."channels"("tenant_id", "id" DESC);

-- CreateIndex
CREATE INDEX "sessions_desired_state_idx" ON "whatsapp_connector"."sessions"("desired_state");
