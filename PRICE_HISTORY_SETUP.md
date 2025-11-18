# Price History Setup Guide

This guide explains how to set up and verify the price history feature for your prediction markets.

## Database Schema

The price history feature uses the `PriceSnapshot` table defined in `prisma/schema.prisma`:

```prisma
model PriceSnapshot {
  id          BigInt   @id @default(autoincrement())
  marketId    BigInt
  yesPriceBps Int      // Price in basis points (5000 = 50%)
  noPriceBps  Int      // Price in basis points (5000 = 50%)
  blockNumber BigInt?
  timestamp   DateTime @default(now())

  @@index([marketId, timestamp])
  @@map("price_snapshots")
}
```

## Setup Steps

### 1. Run Database Migration

If you haven't already created the `price_snapshots` table, run:

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
npx prisma migrate dev --name add_price_snapshots
```

Or if the migration already exists:

```bash
npx prisma migrate deploy
```

### 2. Verify API Endpoints

The following API endpoints should be working:

#### Record Price (POST)
```
POST /api/record-price
Content-Type: application/json

{
  "marketId": "1",
  "yesPriceBps": 5200,
  "noPriceBps": 4800,
  "blockNumber": null
}
```

#### Get Price History (GET)
```
GET /api/price-history?marketId=1&timeframe=24h
```

Supported timeframes: `1h`, `6h`, `24h` (or `1d`), `7d` (or `1w`), `30d` (or `1m`), `all`

### 3. Seed Test Data (Optional)

To seed some test price data for a market:

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node scripts/seed-price-history.js <marketId> <hoursBack>

# Example: Seed 24 hours of data for market 1
node scripts/seed-price-history.js 1 24

# Example: Seed 7 days of data for market 2
node scripts/seed-price-history.js 2 168
```

## How It Works

### Automatic Price Recording

The `MarketDetailWormStyle.jsx` page automatically records prices:

1. **Every 30 seconds** - Checks current price from the blockchain and records if changed
2. **After every trade** - Records the new price after buy/sell transactions complete
3. **On price changes** - Only records when price actually changes to avoid duplicate data

### Chart Display

The `PolymarketChart` component displays:
- **Yellow lines** for both Yes and No prices
- **Dark theme** matching Polymarket style
- **Collapsible** with expand/collapse icon
- **Multiple timeframes** (1H, 6H, 1D, 1W, 1M, ALL)
- **Hover tooltips** showing exact prices at any point

## Troubleshooting

### No Chart Data

If the chart shows "No price data available":

1. Check that the market exists and has trades
2. Verify the API endpoints are accessible
3. Seed some test data using the script
4. Check browser console for API errors

### Chart Not Updating

If the chart isn't updating after trades:

1. Check browser console for price recording errors
2. Verify `/api/record-price` endpoint is working
3. Check database connection
4. Ensure the market ID is correct

### Database Connection Issues

If you see certificate or connection errors:

1. Check your `.env` file has correct `DATABASE_URL`
2. Verify Neon/PostgreSQL database is accessible
3. Check SSL/TLS settings in your connection string
4. Try adding `?sslmode=require` to the connection string

## Testing the Feature

1. Navigate to a market detail page
2. Open browser console to see price recording logs
3. Make a trade or wait 30 seconds
4. Check console for "✅ Price snapshot recorded"
5. Click timeframe buttons (1H, 6H, etc.) to load different ranges
6. Hover over the chart to see price tooltips
7. Click the collapse icon to hide/show the chart

## API Response Format

The price history API returns:

```json
{
  "success": true,
  "data": {
    "priceHistory": [
      { "price": 0.52, "timestamp": "2024-01-01T12:00:00Z" }
    ],
    "yesPriceHistory": [
      { "price": 0.52, "timestamp": "2024-01-01T12:00:00Z" }
    ],
    "noPriceHistory": [
      { "price": 0.48, "timestamp": "2024-01-01T12:00:00Z" }
    ],
    "count": 288
  }
}
```

Note: Prices are in decimal format (0.52 = 52%) in the API response, but stored as basis points (5200 = 52%) in the database.

