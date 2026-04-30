-- CreateTable
CREATE TABLE "store_corrections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "current_address" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_overrides" (
    "id" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "corrected_by" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_corrections_user_id_idx" ON "store_corrections"("user_id");

-- CreateIndex
CREATE INDEX "store_corrections_status_idx" ON "store_corrections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "store_overrides_store_name_key" ON "store_overrides"("store_name");

-- AddForeignKey
ALTER TABLE "store_corrections" ADD CONSTRAINT "store_corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
