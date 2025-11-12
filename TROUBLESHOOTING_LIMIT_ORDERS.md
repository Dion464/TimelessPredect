# Troubleshooting Limit Orders

## Common Issues and Fixes

### Issue 1: "API server is not responding"

**Error:** `Cannot connect to API server. Please start the backend`

**Fix:**
```bash
# Start the backend API server
cd TimelessPredect
node api-server.js
```

**Expected output:**
```
🚀 API server running on http://localhost:8080
   - POST /api/orders (place order)
   - GET  /api/orders (get order book)
   - POST /api/settle (settle trade)
   - WS   ws://localhost:8080 (WebSocket for order book)

🔄 Order matching service: Running (matches every 5s)
```

---

### Issue 2: "Invalid signature"

**Error:** Signature verification failing when placing order

**Fix:**
1. Check `VITE_EXCHANGE_CONTRACT_ADDRESS` in `frontend/.env`
2. Check `VITE_CHAIN_ID` matches your network (1337 for localhost)
3. Make sure Exchange contract is deployed
4. Verify contract address is correct

**Verify:**
```bash
# Check frontend env
cat frontend/.env | grep EXCHANGE_CONTRACT_ADDRESS

# Check backend env  
cat .env | grep EXCHANGE_CONTRACT_ADDRESS

# They should match!
```

---

### Issue 3: "contracts.predictionMarket.marketLimitOrders is not a function"

**Error:** This was fixed - `getUserLimitOrders` now uses API instead of contract

**Status:** ✅ Fixed in latest update

**If you still see this:**
1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Restart the frontend dev server

---

### Issue 4: Orders not appearing

**Symptoms:** Order placed but not showing in "My Open Orders"

**Possible causes:**

1. **API server not running**
   - Start: `node api-server.js`
   - Check it's running on correct port (8080)

2. **Wrong API URL**
   - Check `VITE_API_BASE_URL` in `frontend/.env`
   - Should be: `http://localhost:8080`

3. **CORS issues**
   - Check backend `api-server.js` has CORS enabled
   - Should see: `app.use(cors());`

4. **Network mismatch**
   - Make sure frontend and backend are on same network
   - Check for firewall blocking connections

---

### Issue 5: Orders not matching

**Symptoms:** Orders placed but not matching automatically

**Check:**
1. **Order matching service running**
   - Should see: `🔄 Order matching service: Running (matches every 5s)`
   - In backend server logs

2. **Price compatibility**
   - Buy orders must have price >= Sell order price
   - Same outcome (YES/YES or NO/NO)

3. **Order status**
   - Only 'open' and 'partially_filled' orders match
   - Filled/canceled orders don't match

**Debug:**
```bash
# Check order book via API
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0

# Should show bids and asks
```

---

### Issue 6: "SETTLEMENT_PRIVATE_KEY not configured"

**Error:** Settlement failing when orders match

**Fix:**
1. Set `SETTLEMENT_PRIVATE_KEY` in backend `.env`
2. For localhost, use Hardhat account 0:
   ```
   SETTLEMENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
3. Make sure account has ETH for gas

---

## Complete Setup Checklist

Run through this to ensure everything is configured:

- [ ] Exchange contract deployed
- [ ] Backend `.env` file exists with `EXCHANGE_CONTRACT_ADDRESS`
- [ ] Frontend `.env` file exists with `VITE_EXCHANGE_CONTRACT_ADDRESS`
- [ ] Both contract addresses match
- [ ] `SETTLEMENT_PRIVATE_KEY` set in backend `.env`
- [ ] Backend API server running (`node api-server.js`)
- [ ] Frontend running (`cd frontend && npm start`)
- [ ] Wallet connected to correct network
- [ ] Can access API: `curl http://localhost:8080/api/orders?marketId=1&outcomeId=0`

---

## Testing Steps

1. **Start backend:**
   ```bash
   node api-server.js
   ```

2. **Start frontend:**
   ```bash
   cd frontend
   npm start
   ```

3. **Open browser:** http://localhost:3000

4. **Connect wallet** (MetaMask)

5. **Navigate to market**

6. **Place limit order:**
   - Select "Limit" order type
   - Enter price (e.g., 45¢)
   - Enter amount (e.g., 0.1 ETH)
   - Click "Place Limit Order"
   - Sign with MetaMask

7. **Verify:**
   - ✅ Toast notification shows success
   - ✅ Order appears in "My Open Orders"
   - ✅ Order appears in order book (if you check API)

---

## Still Having Issues?

1. **Check browser console** for errors
2. **Check backend logs** for API errors
3. **Verify all environment variables** are set correctly
4. **Test API directly:**
   ```bash
   # Test order book endpoint
   curl http://localhost:8080/api/orders?marketId=1&outcomeId=0&depth=5
   
   # Should return JSON with bids/asks arrays
   ```

5. **Verify Exchange contract:**
   - Contract should be deployed
   - Address should be in both `.env` files
   - Chain ID should match network

---

## Quick Debug Commands

```bash
# Check if API server is running
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0

# Check backend env variables
cat .env | grep -E "EXCHANGE|CHAIN|SETTLEMENT"

# Check frontend env variables  
cat frontend/.env | grep -E "EXCHANGE|CHAIN|API"

# Check if ports are in use
lsof -i :8080  # Backend
lsof -i :3000  # Frontend
```

