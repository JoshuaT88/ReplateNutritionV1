-- CreateTable
CREATE TABLE "store_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "query_type" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_cache_cache_key_key" ON "store_cache"("cache_key");

-- CreateIndex
CREATE INDEX "store_cache_expires_at_idx" ON "store_cache"("expires_at");
