-- CreateTable
CREATE TABLE IF NOT EXISTS "price_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "market_id" BIGINT NOT NULL,
    "yes_price_bps" INTEGER NOT NULL,
    "no_price_bps" INTEGER NOT NULL,
    "block_number" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "price_snapshots_market_timestamp_idx" ON "price_snapshots"("market_id", "timestamp");
