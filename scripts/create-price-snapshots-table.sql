-- Create price_snapshots table
CREATE TABLE IF NOT EXISTS "price_snapshots" (
    "id" BIGSERIAL PRIMARY KEY,
    "market_id" BIGINT NOT NULL,
    "yes_price_bps" INTEGER NOT NULL,
    "no_price_bps" INTEGER NOT NULL,
    "block_number" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "price_snapshots_market_timestamp_idx" ON "price_snapshots"("market_id", "timestamp");

-- Verify table was created
SELECT COUNT(*) as table_check FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'price_snapshots';

