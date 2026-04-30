-- Phase 20: City/State tax, deal notes, in-app notifications, family suggestions

-- Add city and state to user_preferences
ALTER TABLE "user_preferences" ADD COLUMN "city" TEXT;
ALTER TABLE "user_preferences" ADD COLUMN "state" TEXT;

-- Add deal_note to shopping_lists
ALTER TABLE "shopping_lists" ADD COLUMN "deal_note" TEXT;

-- CreateTable: in_app_notifications
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_idx" ON "in_app_notifications"("user_id");
CREATE INDEX "in_app_notifications_is_read_idx" ON "in_app_notifications"("is_read");

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: family_member_suggestions
CREATE TABLE "family_member_suggestions" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_member_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "family_member_suggestions_household_id_idx" ON "family_member_suggestions"("household_id");
CREATE INDEX "family_member_suggestions_status_idx" ON "family_member_suggestions"("status");
CREATE INDEX "family_member_suggestions_requested_by_idx" ON "family_member_suggestions"("requested_by_user_id");

-- AddForeignKey
ALTER TABLE "family_member_suggestions" ADD CONSTRAINT "family_member_suggestions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_member_suggestions" ADD CONSTRAINT "family_member_suggestions_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
