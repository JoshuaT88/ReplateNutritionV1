-- AlterTable
ALTER TABLE "users" ADD COLUMN     "data_export_expires_at" TIMESTAMP(3),
ADD COLUMN     "data_export_requested_at" TIMESTAMP(3),
ADD COLUMN     "data_export_url" TEXT;
