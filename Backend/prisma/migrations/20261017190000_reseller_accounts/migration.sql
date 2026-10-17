-- AlterTable
ALTER TABLE "accounts"."tenants" ADD COLUMN     "allows_children" BOOLEAN NOT NULL DEFAULT false;


-- A raiz (quando já definida) sempre pode ter contas abaixo.
UPDATE "accounts"."tenants" SET "allows_children" = true WHERE "is_root";
