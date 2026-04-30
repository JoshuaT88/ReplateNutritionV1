-- Migration: Add price_cache table for AI price estimation caching

CREATE TABLE "price_cache" (
  "id"             TEXT         NOT NULL,
  "cache_key"      TEXT         NOT NULL,
  "item_name"      TEXT         NOT NULL,
  "store_name"     TEXT         NOT NULL,
  "zip_region"     TEXT         NOT NULL DEFAULT '',
  "estimated_price" DOUBLE PRECISION NOT NULL,
  "source"         TEXT         NOT NULL DEFAULT 'ai',
  "expires_at"     TIMESTAMP(3) NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "price_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_cache_cache_key_key" ON "price_cache"("cache_key");
CREATE INDEX "price_cache_expires_at_idx" ON "price_cache"("expires_at");
CREATE INDEX "price_cache_item_store_idx" ON "price_cache"("item_name", "store_name", "zip_region");
