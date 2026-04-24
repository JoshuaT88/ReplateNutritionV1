-- AlterTable
ALTER TABLE "shopping_lists" ADD COLUMN     "assigned_store" TEXT,
ADD COLUMN     "estimated_price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "per_trip_budget_allocation" DOUBLE PRECISION;
