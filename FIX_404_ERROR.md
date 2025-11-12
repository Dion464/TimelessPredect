# Fix 404 Error - API Not Found

## Problem

You're seeing this error:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
:3000/api/orders?user=...&marketId=2
```

**Cause:** Frontend is trying to call API on port 3000 (where frontend runs) instead of port 8080 (where backend API runs).

---

## Solution

### Step 1: Create Frontend .env File ✅

I've created it for you, but verify:

```bash
cat frontend/.env
```

Should show:
```
VITE_API_BASE_URL=http://localhost:8080
VITE_CHAIN_ID=1337
VITE_EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

### Step 2: RESTART Frontend Dev Server

**IMPORTANT:** After creating/updating `.env` file, you MUST restart the frontend!

1. **Stop the frontend** (Ctrl+C in the terminal running `npm start`)
2. **Start it again:**
   ```bash
   cd frontend
   npm start
   ```

Vite only reads `.env` files when it starts, so changes won't take effect until restart!

---

## Step 3: Verify Backend is Running

```bash
# Check if backend is running
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0

# Should return JSON, not an error
```

If you get "Connection refused", start the backend:
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js
```

---

## Step 4: Test Again

1. **Hard refresh browser:** Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. **Open browser console** (F12)
3. **Try placing a limit order**
4. **Check console** - should see API calls to `http://localhost:8080/api/orders` (not port 3000)

---

## Why This Happened

The frontend code uses:
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
```

- If `VITE_API_BASE_URL` is not set, it uses `window.location.origin`
- `window.location.origin` = `http://localhost:3000` (frontend's port)
- But API runs on port 8080
- So it tries `http://localhost:3000/api/orders` → 404 error

Setting `VITE_API_BASE_URL=http://localhost:8080` fixes this!

---

## Quick Fix Checklist

- [x] Create `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8080`
- [ ] **RESTART frontend dev server** (important!)
- [ ] Verify backend is running on port 8080
- [ ] Hard refresh browser
- [ ] Try placing order again

---

## Still Not Working?

1. **Check backend logs** - is it running?
2. **Check frontend console** - what URL is it calling?
3. **Verify .env file:**
   ```bash
   cat frontend/.env | grep API_BASE_URL
   # Should show: VITE_API_BASE_URL=http://localhost:8080
   ```
4. **Check CORS** - backend should allow requests from `http://localhost:3000`

---

## Common Mistake

❌ **Wrong:** Creating `.env` but not restarting frontend
✅ **Right:** Create `.env`, then restart frontend dev server

Vite doesn't hot-reload `.env` files - you must restart!

