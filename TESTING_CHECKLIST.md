# Hybrid Order System - Testing Checklist

Use this checklist to verify everything is working correctly.

---

## ✅ Pre-Deployment Checklist

### 1. Smart Contract
- [ ] Exchange.sol compiles without errors
- [ ] All dependencies installed (@openzeppelin)
- [ ] Deployment script exists (`deploy-exchange.js`)
- [ ] Test network configured (localhost/Polygon Amoy)

### 2. Backend
- [ ] All npm packages installed (`npm install`)
- [ ] `ws` package installed for WebSocket
- [ ] Environment variables configured:
  - [ ] `EXCHANGE_CONTRACT_ADDRESS`
  - [ ] `CHAIN_ID`
  - [ ] `SETTLEMENT_PRIVATE_KEY`
  - [ ] `RPC_URL`
- [ ] API server starts without errors
- [ ] WebSocket server initializes

### 3. Frontend
- [ ] All npm packages installed
- [ ] Environment variables configured:
  - [ ] `VITE_EXCHANGE_CONTRACT_ADDRESS`
  - [ ] `VITE_CHAIN_ID`
  - [ ] `VITE_API_BASE_URL`
- [ ] Frontend builds without errors
- [ ] No console errors on page load

---

## 🧪 Functional Testing

### Test 1: Order Placement
**Steps:**
1. Open frontend in browser
2. Navigate to a market page
3. Fill in order form:
   - Outcome: YES
   - Order Type: Limit
   - Price: 45¢
   - Size: 100 shares
4. Click "Place Limit Order"
5. MetaMask prompts for signature

**Expected Results:**
- [ ] MetaMask shows EIP-712 signature request
- [ ] Signature prompt shows order details
- [ ] After signing, order appears in "My Open Orders"
- [ ] Toast notification: "✅ Limit order placed at 45¢!"
- [ ] Order book shows new bid

**If Fails:**
- Check browser console for errors
- Verify MetaMask is connected
- Check API server is running
- Verify contract address in env

---

### Test 2: Order Matching
**Steps:**
1. Place a buy order (from Test 1)
2. Using same or different account, place sell order:
   - Same outcome (YES)
   - Same or better price (≤ 45¢)
   - Same size (100 shares)
3. Wait up to 5 seconds

**Expected Results:**
- [ ] Orders match automatically
- [ ] Backend logs: "✅ Found X matches"
- [ ] Settlement transaction sent on-chain
- [ ] Both orders show status "filled"
- [ ] Trade appears in Exchange contract events

**If Fails:**
- Check order matching service is running
- Verify orders have compatible prices
- Check relayer account has ETH for gas
- Check Exchange contract approvals

---

### Test 3: Order Book Display
**Steps:**
1. Place multiple orders at different prices
2. View order book component

**Expected Results:**
- [ ] Bids (buy orders) show highest price first
- [ ] Asks (sell orders) show lowest price first
- [ ] Prices displayed in cents (not ticks)
- [ ] Remaining size shown correctly
- [ ] Spread calculated and displayed

**If Fails:**
- Check API endpoint: `GET /api/orders?marketId=X&outcomeId=0`
- Verify WebSocket connection
- Check browser console for errors

---

### Test 4: Real-Time Updates (WebSocket)
**Steps:**
1. Open browser console
2. Place an order from another browser/account
3. Watch order book component

**Expected Results:**
- [ ] Order book updates automatically
- [ ] No page refresh needed
- [ ] WebSocket connection shown in network tab
- [ ] Console shows "📡 WebSocket connected"

**If Fails:**
- Check WebSocket server is running
- Verify WebSocket path: `ws://localhost:8080`
- Check CORS settings
- Fallback to polling should work

---

### Test 5: Market Orders
**Steps:**
1. Place a limit sell order (e.g., 50 YES @ 45¢)
2. Place a market buy order:
   - Order Type: Market
   - Size: 50 shares
   - No price needed

**Expected Results:**
- [ ] Market order executes immediately
- [ ] Fills at best available price (45¢)
- [ ] Both orders filled
- [ ] Settlement transaction on-chain

**If Fails:**
- Verify there are matching orders in book
- Check market order matching logic
- Verify fill size calculations

---

### Test 6: Order Cancellation
**Steps:**
1. Place a limit order
2. Click "Cancel" button on order

**Expected Results:**
- [ ] Order removed from "My Open Orders"
- [ ] Order removed from order book
- [ ] Toast notification: "Order canceled"
- [ ] Order status: "canceled"

**If Fails:**
- Check DELETE endpoint: `/api/orders/:id`
- Verify user address matches order maker
- Check order book cancellation logic

---

### Test 7: Partial Fills
**Steps:**
1. Place buy order for 100 shares @ 45¢
2. Place sell order for 50 shares @ 45¢
3. Wait for matching

**Expected Results:**
- [ ] Orders partially filled (50 shares)
- [ ] Buy order status: "partially_filled"
- [ ] Remaining: 50 shares
- [ ] Both orders still in order book
- [ ] Can fill remaining later

**If Fails:**
- Check partial fill logic in orderBook.js
- Verify fill size calculations
- Check order status updates

---

## 🔍 API Testing

### Test API Endpoints

#### POST /api/orders
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "maker": "0x...",
      "marketId": "1",
      "outcomeId": "0",
      "price": "4500",
      "size": "1000000000000000000",
      "side": true,
      "expiry": "1735689600",
      "salt": "123456789"
    },
    "signature": "0x...",
    "isMarketOrder": false
  }'
```

**Expected:** `{ orderId: "1", status: "open" }`

---

#### GET /api/orders
```bash
curl "http://localhost:8080/api/orders?marketId=1&outcomeId=0&depth=10"
```

**Expected:** `{ marketId: "1", outcomeId: "0", bids: [...], asks: [...] }`

---

#### DELETE /api/orders/:id
```bash
curl -X DELETE http://localhost:8080/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x..."}'
```

**Expected:** `{ orderId: "1", status: "canceled" }`

---

## 🐛 Common Issues & Fixes

### Issue: "Invalid signature"
**Cause:** Chain ID mismatch or wrong contract address
**Fix:** 
- Verify `CHAIN_ID` matches network
- Check `EXCHANGE_CONTRACT_ADDRESS` is correct
- Ensure order structure matches EIP-712 format

---

### Issue: Orders not matching
**Cause:** Price incompatibility or order status
**Fix:**
- Check buy price >= sell price
- Verify orders same outcome
- Ensure orders status is 'open' or 'partially_filled'

---

### Issue: Settlement failing
**Cause:** Relayer account issues
**Fix:**
- Verify `SETTLEMENT_PRIVATE_KEY` is set
- Check relayer account has ETH for gas
- Verify payment/outcome tokens are approved
- Check Exchange contract address

---

### Issue: WebSocket not connecting
**Cause:** Server not running or path incorrect
**Fix:**
- Verify API server is running
- Check WebSocket path: `/ws`
- Verify port matches frontend config
- Fallback to polling should work automatically

---

## 📊 Performance Testing

### Load Test
```bash
# Place 10 orders simultaneously
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/orders \
    -H "Content-Type: application/json" \
    -d "{ ... }" &
done
wait
```

**Check:**
- [ ] All orders processed
- [ ] No errors in server logs
- [ ] Order book updates correctly
- [ ] Matching service handles load

---

## ✅ Final Verification

Before considering complete:

- [ ] All functional tests pass
- [ ] API endpoints work correctly
- [ ] WebSocket updates in real-time
- [ ] Orders match and settle on-chain
- [ ] No console errors
- [ ] No server errors
- [ ] Order book displays correctly
- [ ] User can cancel orders
- [ ] Partial fills work
- [ ] Market orders execute immediately

---

## 📝 Test Results Template

```
Date: _______________
Tester: _______________

Test 1: Order Placement
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Test 2: Order Matching
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Test 3: Order Book Display
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Test 4: Real-Time Updates
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Test 5: Market Orders
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Test 6: Order Cancellation
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Test 7: Partial Fills
  Status: [ ] Pass [ ] Fail
  Notes: _________________

Overall Status: [ ] Ready for Production [ ] Needs Fixes

Issues Found:
1. _________________
2. _________________
3. _________________
```

