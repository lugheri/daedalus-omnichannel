-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "contacts";

-- CreateTable
CREATE TABLE "contacts"."contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_tenant_id_id_idx" ON "contacts"."contacts"("tenant_id", "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_phone_key" ON "contacts"."contacts"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_email_key" ON "contacts"."contacts"("tenant_id", "email");
