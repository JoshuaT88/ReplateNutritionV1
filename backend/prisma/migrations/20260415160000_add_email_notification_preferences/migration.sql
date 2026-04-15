-- AlterTable
ALTER TABLE "user_preferences"
ADD COLUMN "meal_reminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "shopping_alerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "price_drop_alerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "email_notifications_disclosure_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "email_notifications_disclosure_accepted_at" TIMESTAMP(3);