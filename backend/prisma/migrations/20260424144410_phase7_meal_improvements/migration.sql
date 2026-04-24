-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "diet_type" TEXT;

-- CreateTable
CREATE TABLE "custom_meals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preparation_notes" TEXT,
    "calories" INTEGER,
    "servings" INTEGER DEFAULT 1,
    "prep_time" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_meals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_meals_user_id_idx" ON "custom_meals"("user_id");

-- AddForeignKey
ALTER TABLE "custom_meals" ADD CONSTRAINT "custom_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
