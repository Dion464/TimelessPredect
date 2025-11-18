# 🚀 Vercel Serverless Deployment Guide

## ✅ What's Already Set Up

Your price recording system is **already serverless**! The following functions are ready for Vercel:

### Serverless API Functions

1. **`/api/record-price`** - Records new price snapshots
   - Method: POST
   - Body: `{ marketId, yesPriceBps, noPriceBps, blockNumber? }`
   - Auto-deduplicates (won't record same price within 1 minute)

2. **`/api/price-history`** - Retrieves historical price data
   - Method: GET
   - Query: `?marketId=1&timeframe=1d`
   - Timeframes: 1h, 6h, 1d, 1w, 1m, all

## 📋 Pre-Deployment Checklist

### 1. Database Setup (Neon/PostgreSQL)

You need a PostgreSQL database for Vercel. **Neon** is recommended (free tier):

```bash
# Option A: Use your existing Neon database
# Just get the connection string from Neon dashboard

# Option B: Create new Neon database
# 1. Go to https://neon.tech
# 2. Create new project
# 3. Copy connection string
```

### 2. Environment Variables

Add these to Vercel dashboard (Settings → Environment Variables):

```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

### 3. Prisma Setup for Vercel

The `prisma/schema.prisma` is already configured with:
- PriceSnapshot model ✅
- Proper indexes ✅
- PostgreSQL provider ✅

## 🚀 Deployment Steps

### Step 1: Push to GitHub

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
git add -A
git commit -m "feat: Add serverless price recording for Vercel"
git push origin main
```

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

#### Option B: Vercel Dashboard
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variable: `DATABASE_URL`
4. Deploy!

### Step 3: Run Database Migration on Vercel

After first deployment, run migrations:

```bash
# Using Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy

# Or manually in Vercel dashboard
# Add this to Build Command:
# npm install && cd frontend && npm install && npx prisma generate && npx prisma migrate deploy
```

## 🔧 How It Works (Serverless Architecture)

### Price Recording Flow

```
User visits market page
      ↓
Frontend detects price change
      ↓
POST /api/record-price (Vercel Serverless Function)
      ↓
Store in PostgreSQL/Neon
      ↓
Success response
      ↓
Frontend refreshes chart
```

### Price Retrieval Flow

```
Chart component loads
      ↓
GET /api/price-history?marketId=1&timeframe=1d
      ↓
Query PostgreSQL/Neon (Vercel Serverless Function)
      ↓
Return JSON data
      ↓
Chart renders with historical data
```

## 📊 Automatic Price Recording

The frontend (`MarketDetailWormStyle.jsx`) automatically:

1. **Every 30 seconds**: Checks blockchain price → Records if changed
2. **After each trade**: Records new price
3. **Deduplication**: Won't record same price twice within 1 minute

## 🧪 Testing Serverless Functions Locally

### Run API Server Locally

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js
```

### Test Recording

```bash
curl -X POST http://localhost:3001/api/record-price \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "1",
    "yesPriceBps": 5200,
    "noPriceBps": 4800
  }'
```

### Test Retrieval

```bash
curl http://localhost:3001/api/price-history?marketId=1&timeframe=1d
```

## 🌐 Vercel Environment URLs

After deployment, your APIs will be available at:

```
https://your-project.vercel.app/api/record-price
https://your-project.vercel.app/api/price-history
```

## ⚙️ Vercel Configuration

The `vercel.json` is configured with:

```json
{
  "rewrites": [
    { "source": "/api/record-price", "destination": "/api/record-price/index.js" },
    { "source": "/api/price-history", "destination": "/api/price-history/index.js" }
  ],
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

## 📈 Price Data Will Build Up Automatically

Once deployed:
- Users visit markets → Prices are recorded automatically
- Chart shows real historical data
- No manual seeding needed!
- Data persists in PostgreSQL

## 🔍 Debugging on Vercel

### Check Function Logs

```bash
vercel logs --follow
```

### Common Issues

**Issue**: `Cannot find module '@prisma/client'`
**Fix**: Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**Issue**: Database connection errors
**Fix**: Ensure `DATABASE_URL` environment variable is set correctly

**Issue**: No price data showing
**Fix**: 
1. Check browser console for API errors
2. Verify prices are being recorded (check Vercel logs)
3. Make sure market has been visited/traded

## 🎯 Success Indicators

You'll know it's working when:
- ✅ No errors in browser console
- ✅ Console shows: `✅ Price snapshot recorded`
- ✅ Chart displays price lines (not flat)
- ✅ Tooltip appears when hovering
- ✅ Vercel logs show successful API calls

## 🚨 Important Notes

1. **Cold Starts**: First request to serverless function may be slow (1-2s)
2. **Connection Pooling**: Use `?pgbouncer=true` in DATABASE_URL for better performance
3. **Rate Limiting**: Vercel has execution limits (10s max, 1024MB memory)
4. **Database Limits**: Check Neon free tier limits (10GB storage, 100GB bandwidth)

## 📞 Troubleshooting

If chart shows flat lines:
1. Check if API calls are succeeding: Browser DevTools → Network
2. Verify database has data: Check Neon dashboard
3. Test API locally first: `node api-server.js`
4. Check Vercel function logs for errors

---

**Status**: ✅ Ready for Serverless Deployment
**Platform**: Vercel
**Database**: PostgreSQL (Neon recommended)
**Auto-Recording**: Enabled

