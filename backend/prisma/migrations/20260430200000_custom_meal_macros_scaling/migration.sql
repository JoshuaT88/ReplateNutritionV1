-- Migration: Add macro fields and ingredient scaling to custom_meals

ALTER TABLE "custom_meals"
  ADD COLUMN IF NOT EXISTS "protein" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "carbs" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fiber" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ingredient_scaling" JSONB;
