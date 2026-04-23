/*
  Warnings:

  - A unique constraint covering the columns `[item_name,store_name,zip_region]` on the table `aisle_locations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "aisle_locations_item_name_store_name_key";

-- AlterTable
ALTER TABLE "aisle_locations" ADD COLUMN     "zip_region" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN     "servings" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "breed" TEXT;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/New_York';

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "aisle_locations_store_name_zip_region_idx" ON "aisle_locations"("store_name", "zip_region");

-- CreateIndex
CREATE UNIQUE INDEX "aisle_locations_item_name_store_name_zip_region_key" ON "aisle_locations"("item_name", "store_name", "zip_region");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
