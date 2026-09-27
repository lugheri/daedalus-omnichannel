-- CreateTable
CREATE TABLE "accounts"."invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "accounts"."invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_status_idx" ON "accounts"."invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "accounts"."invitations"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "accounts"."invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "accounts"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "accounts"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
