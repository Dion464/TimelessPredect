# 🚀 Vercel Deployment Guide

## 📋 Pre-Deployment Checklist

Before deploying to Vercel, make sure you have:
- ✅ All changes committed to Git
- ✅ Pushed to your GitHub repository
- ✅ Environment variables ready (see below)

---

## 🌍 Vercel Environment Variables

### Required Environment Variables for Vercel

Copy and paste these into your Vercel project settings under **Settings → Environment Variables**:

```bash
# ========================================
# SMART CONTRACT ADDRESSES (Incentiv Testnet)
# ========================================
EXCHANGE_CONTRACT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
PAYMENT_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
OUTCOME_TOKEN_ADDRESS=0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
PREDICTION_MARKET_ADDRESS=0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40

# ========================================
# NETWORK CONFIGURATION (Incentiv Testnet)
# ========================================
CHAIN_ID=28802
RPC_URL=https://rpc-testnet.incentiv.io/

# ========================================
# PRIVATE KEYS (🔐 KEEP SECURE!)
# ========================================
SETTLEMENT_PRIVATE_KEY=0xe516ae4914310bca210e71786c48fafda9aed07457654f649f32576746b5120c

# ========================================
# API SERVER CONFIGURATION
# ========================================
PORT=8080
API_BASE_URL=https://your-vercel-app.vercel.app

# Note: After deployment, replace API_BASE_URL with your actual Vercel URL
# Example: https://tmlspredict.vercel.app

# ========================================
# DATABASE (PostgreSQL on Vercel)
# ========================================
DATABASE_URL=postgresql://user:password@host:5432/database

# Note: You'll need to set up a PostgreSQL database
# Recommended: Use Vercel Postgres or Supabase
# After creating, paste the connection string here

# ========================================
# TREASURY ADDRESS
# ========================================
TREASURY_ADDRESS=0xed27C34A8434ADc188A2D7503152024F64967B61
```

---

## 📝 Step-by-Step Deployment

### Step 1: Commit Your Changes

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect

# Commit the changes
git commit -m "feat: Add Incentiv Testnet support with TCENT currency"

# Push to GitHub
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Select **"TimelessPredect"**

### Step 3: Configure Project Settings

**Framework Preset:** Vite

**Root Directory:** `frontend`

**Build Command:**
```bash
npm run build
```

**Output Directory:**
```bash
dist
```

**Install Command:**
```bash
npm install
```

### Step 4: Add Environment Variables

Go to **Settings → Environment Variables** and add all the variables listed above.

**Important:** 
- Add them one by one
- Select **Production**, **Preview**, and **Development** for each variable
- Click **Save** after each one

### Step 5: Deploy Backend API (Separate Vercel Project)

The backend API (`api-server.js`) needs its own deployment:

1. Create a new Vercel project
2. Root Directory: `.` (root)
3. Add a `vercel.json` in the root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api-server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api-server.js"
    }
  ]
}
```

4. Add the same environment variables
5. Deploy

### Step 6: Update Frontend API URL

After backend is deployed, update the frontend environment variable:

```bash
API_BASE_URL=https://your-backend-api.vercel.app
```

Redeploy the frontend.

### Step 7: Set Up Database

**Option 1: Vercel Postgres (Recommended)**
```bash
# In your Vercel project dashboard:
1. Go to Storage tab
2. Click "Create Database"
3. Select "Postgres"
4. Copy the connection string
5. Update DATABASE_URL in environment variables
```

**Option 2: Supabase**
```bash
# Go to https://supabase.com
1. Create new project
2. Go to Settings → Database
3. Copy connection string
4. Update DATABASE_URL
```

### Step 8: Initialize Database Schema

After setting up the database, run migrations:

```bash
# Locally, with the new DATABASE_URL
npx prisma migrate deploy
npx prisma generate
```

---

## 🔐 Security Checklist

- ✅ Never commit `.env` files to Git (already in .gitignore)
- ✅ Use Vercel's environment variables (encrypted at rest)
- ✅ Rotate private keys if they're ever exposed
- ✅ Use different private keys for production vs testnet
- ⚠️ The private key in this guide is **testnet only** - don't use for mainnet!

---

## 📊 Post-Deployment Verification

After deployment, test these features:

1. **Frontend loads** → Visit your Vercel URL
2. **Connect wallet** → MetaMask connects to Incentiv Testnet
3. **View markets** → Markets display with TCENT prices
4. **Buy shares** → Can purchase YES/NO shares
5. **Sell shares** → Can sell shares back
6. **Admin panel** → Can create new markets (if admin)

---

## 🐛 Troubleshooting

### Issue: "Contract not found"
**Solution:** Make sure `PREDICTION_MARKET_ADDRESS` is correct in environment variables

### Issue: "Wrong network"
**Solution:** Ensure MetaMask is on Incentiv Testnet (Chain ID 28802)

### Issue: "API not responding"
**Solution:** Check backend deployment logs in Vercel dashboard

### Issue: "Database connection failed"
**Solution:** Verify `DATABASE_URL` is correct and database is accessible

### Issue: "Transactions failing"
**Solution:** Check you have TCENT in your wallet (get from faucet)

---

## 🔄 Continuous Deployment

After initial setup, any push to `main` branch will automatically:
1. Trigger Vercel build
2. Deploy new version
3. Use existing environment variables

---

## 📱 Custom Domain (Optional)

To add a custom domain:
1. Go to **Settings → Domains**
2. Add your domain
3. Update DNS records as instructed
4. Wait for SSL certificate (automatic)

---

## 🎯 Environment Variable Quick Copy

**For Vercel UI (copy each line as separate variable):**

```
EXCHANGE_CONTRACT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
PAYMENT_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
OUTCOME_TOKEN_ADDRESS=0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
PREDICTION_MARKET_ADDRESS=0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
CHAIN_ID=28802
RPC_URL=https://rpc-testnet.incentiv.io/
SETTLEMENT_PRIVATE_KEY=0xe516ae4914310bca210e71786c48fafda9aed07457654f649f32576746b5120c
PORT=8080
API_BASE_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://user:password@host:5432/database
TREASURY_ADDRESS=0xed27C34A8434ADc188A2D7503152024F64967B61
```

---

## ✅ Deployment Complete!

Once deployed, your prediction market will be live at:
- **Frontend:** `https://your-project.vercel.app`
- **Backend API:** `https://your-api.vercel.app`

---

## 📞 Need Help?

Common issues:
- Build failing? Check build logs in Vercel dashboard
- API errors? Check function logs in Vercel
- Database issues? Verify connection string
- Contract errors? Ensure you're on Incentiv Testnet

---

## 🎉 You're Live!

Your prediction market is now deployed and accessible worldwide! 🚀

**Next Steps:**
1. Share the URL with users
2. Monitor the Vercel dashboard for errors
3. Add more liquidity to markets
4. Create more interesting markets

Good luck! 🍀

