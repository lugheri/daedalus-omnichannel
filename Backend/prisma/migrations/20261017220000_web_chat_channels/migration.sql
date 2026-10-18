-- AlterTable
ALTER TABLE "channels"."channels" ADD COLUMN     "public_key" TEXT,
ADD COLUMN     "settings" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "channels_public_key_key" ON "channels"."channels"("public_key");

