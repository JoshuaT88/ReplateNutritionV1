-- DropIndex
DROP INDEX "family_member_suggestions_requested_by_idx";

-- AlterTable
ALTER TABLE "custom_meals" ADD COLUMN     "photo_url" TEXT;

-- AlterTable
ALTER TABLE "family_member_suggestions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "family_member_suggestions" RENAME CONSTRAINT "family_member_suggestions_user_id_fkey" TO "family_member_suggestions_requested_by_user_id_fkey";
