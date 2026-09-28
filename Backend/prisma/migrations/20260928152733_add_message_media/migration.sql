-- AlterTable
ALTER TABLE "conversations"."messages" ADD COLUMN     "media_file_name" TEXT,
ADD COLUMN     "media_key" TEXT,
ADD COLUMN     "media_mime_type" TEXT,
ADD COLUMN     "media_size" INTEGER;
