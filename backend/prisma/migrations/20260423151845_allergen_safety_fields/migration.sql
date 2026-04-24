-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN     "safety_flag" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "critical_allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "safety_flag" TEXT;
