-- AlterTable
ALTER TABLE "aisle_locations" ADD COLUMN     "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "dispute_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shopping_lists" ADD COLUMN     "list_group_id" TEXT;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "budget_last_reset_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "shopping_list_groups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "store_name" TEXT,
    "store_address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantry_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "category" TEXT,
    "quantity" TEXT,
    "unit" TEXT,
    "expires_at" TIMESTAMP(3),
    "purchased_at" TIMESTAMP(3),
    "notes" TEXT,
    "low_stock_alert" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_recipes" (
    "id" TEXT NOT NULL,
    "external_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'themealdb',
    "name" TEXT NOT NULL,
    "category" TEXT,
    "cuisine" TEXT,
    "instructions" TEXT,
    "thumbnail" TEXT,
    "ingredients" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pantry_items_user_id_category_idx" ON "pantry_items"("user_id", "category");

-- CreateIndex
CREATE INDEX "pantry_items_user_id_expires_at_idx" ON "pantry_items"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "saved_recipes_user_id_idx" ON "saved_recipes"("user_id");

-- CreateIndex
CREATE INDEX "saved_recipes_category_cuisine_idx" ON "saved_recipes"("category", "cuisine");

-- CreateIndex
CREATE UNIQUE INDEX "saved_recipes_external_id_source_key" ON "saved_recipes"("external_id", "source");

-- CreateIndex
CREATE INDEX "aisle_locations_confidence_score_idx" ON "aisle_locations"("confidence_score");

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_list_group_id_fkey" FOREIGN KEY ("list_group_id") REFERENCES "shopping_list_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_groups" ADD CONSTRAINT "shopping_list_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
