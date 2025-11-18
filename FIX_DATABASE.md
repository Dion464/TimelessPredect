# 🔧 Fix Database Connection Issue

## Problem
Your Neon database connection has SSL certificate validation issues causing:
```
Error: P1011: Error opening a TLS connection: bad certificate format
```

## Solution: Update DATABASE_URL

Replace your current `DATABASE_URL` in `.env` file with:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_b1I2pMgFuEwi@ep-nameless-sea-ae076y4p-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

**Changes:**
- Remove `&sslaccept=strict`
- Keep `sslmode=require`

## Steps to Fix:

### 1. Update .env file

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect

# Edit .env file
nano .env

# Or use sed to replace
sed -i.backup 's/sslaccept=strict//' .env
```

### 2. Create the price_snapshots table

After fixing DATABASE_URL, run:

```bash
node scripts/setup-database.js
```

### 3. Restart your API server

```bash
# Stop current server (Ctrl+C)
# Start again
node api-server.js
```

### 4. Test the API

```bash
# Test price recording
curl -X POST http://localhost:3001/api/record-price \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "1",
    "yesPriceBps": 5000,
    "noPriceBps": 5000
  }'

# Test price history
curl http://localhost:3001/api/price-history?marketId=1&timeframe=1d
```

## Alternative: Use Direct (Non-Pooled) Connection

If the above doesn't work, try the direct connection string from Neon dashboard:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_b1I2pMgFuEwi@ep-nameless-sea-ae076y4p.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Note: This removes `-pooler` from the host.

## For Vercel Deployment

In Vercel dashboard, set environment variable:

```
DATABASE_URL=postgresql://neondb_owner:npg_b1I2pMgFuEwi@ep-nameless-sea-ae076y4p-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
```

(No `sslaccept=strict`)

## Quick Fix Command

Run this one-liner:

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect && \
sed -i.backup 's/?sslmode=require&sslaccept=strict/?sslmode=require/' .env && \
echo "✅ Fixed DATABASE_URL" && \
node scripts/setup-database.js
```

This will:
1. Fix the DATABASE_URL
2. Create a backup of your .env
3. Run the database setup

