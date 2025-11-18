# 🗄️ Create Database Table Manually (Neon Dashboard)

## Why Manual Setup?

Your local environment has SSL certificate issues with Neon. The easiest solution is to create the table directly in Neon's dashboard.

**Don't worry!** Once you deploy to Vercel, the migration will run automatically. This is just for local testing.

---

## 📋 Steps to Create Table in Neon Dashboard

### 1. Go to Neon Dashboard
Visit: https://console.neon.tech/

### 2. Select Your Database
- Click on your project: `ep-nameless-sea-ae076y4p`
- Go to **SQL Editor** (left sidebar)

### 3. Run This SQL

Copy and paste this entire SQL code:

```sql
-- Create price_snapshots table
CREATE TABLE IF NOT EXISTS "price_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "market_id" BIGINT NOT NULL,
    "yes_price_bps" INTEGER NOT NULL,
    "no_price_bps" INTEGER NOT NULL,
    "block_number" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS "price_snapshots_market_timestamp_idx" 
ON "price_snapshots"("market_id", "timestamp");

-- Verify table was created
SELECT COUNT(*) as table_exists FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'price_snapshots';
```

### 4. Click "Run" Button

You should see:
```
table_exists
1
```

✅ **Table created successfully!**

---

## 🧪 Test Locally

After creating the table, test your API:

### 1. Start API Server
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js
```

### 2. Test Recording Price
```bash
curl -X POST http://localhost:3001/api/record-price \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "1",
    "yesPriceBps": 5000,
    "noPriceBps": 5000
  }'
```

Expected response:
```json
{"success": true, "snapshotId": 1}
```

### 3. Test Getting History
```bash
curl "http://localhost:3001/api/price-history?marketId=1&timeframe=1d"
```

Expected response:
```json
{
  "success": true,
  "yesPriceHistory": [...],
  "noPriceHistory": [...]
}
```

---

## 🚀 For Vercel Deployment

### Good News! 🎉

Once you push to Vercel, the migration will run **automatically**!

```bash
git push origin main
```

Vercel will:
1. Run `npx prisma migrate deploy` (creates tables automatically)
2. Generate Prisma client
3. Build your frontend
4. Deploy serverless functions

No manual table creation needed on Vercel!

---

## 🔍 Verify Table Exists

Run this query in Neon SQL Editor:

```sql
-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'price_snapshots';

-- Check if any data exists
SELECT COUNT(*) FROM price_snapshots;
```

---

## ⚡ Quick Fix for SSL Issues (Optional)

If you want to fix the local SSL issue for future migrations:

### Option 1: Use pgBouncer (Recommended for Vercel)
```bash
DATABASE_URL="postgresql://neondb_owner:npg_b1I2pMgFuEwi@ep-nameless-sea-ae076y4p-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
```

### Option 2: Disable SSL Verification (Local Only - NOT for Production)
```bash
DATABASE_URL="postgresql://neondb_owner:npg_b1I2pMgFuEwi@ep-nameless-sea-ae076y4p.c-2.us-east-2.aws.neon.tech/neondb?sslmode=disable"
```

---

## 📊 What Happens Next

After creating the table:

1. **Visit a market page** on your app
2. **Wait 30 seconds** - Price will be recorded automatically
3. **Make a trade** - Triggers immediate recording
4. **Check the chart** - Should show lines (after ~2-3 price points)
5. **Hover over chart** - Tooltip should appear!

---

## 🆘 Still Having Issues?

Check browser console for these logs:
```
💰 Price changed! Recording to DB: {...}
✅ Price snapshot recorded
📊 Fetched price history: X points
```

If you see errors, they'll point to the exact issue!

