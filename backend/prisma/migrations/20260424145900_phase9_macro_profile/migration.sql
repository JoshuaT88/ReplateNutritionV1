-- AlterTable
ALTER TABLE "macro_logs" ADD COLUMN     "profile_id" TEXT;

-- AddForeignKey
ALTER TABLE "macro_logs" ADD CONSTRAINT "macro_logs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
