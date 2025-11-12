# Quick Start Guide - Limit Orders

## Step 1: Navigate to Project Root

**IMPORTANT:** You must be in the `TimelessPredect` directory (project root), NOT in `lib` or `frontend`.

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
```

Verify you're in the right place:
```bash
# Should show api-server.js
ls api-server.js

# Should show package.json
ls package.json
```

---

## Step 2: Install Dependencies (if needed)

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

---

## Step 3: Create Environment Files

### Backend `.env` file:

```bash
# Create backend .env
cat > .env << 'EOF'
EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
CHAIN_ID=1337
RPC_URL=http://localhost:8545
SETTLEMENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PAYMENT_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
OUTCOME_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
PORT=8080
API_BASE_URL=http://localhost:8080
EOF
```

### Frontend `.env` file:

```bash
# Create frontend .env
cd frontend
cat > .env << 'EOF'
VITE_EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_CHAIN_ID=1337
VITE_API_BASE_URL=http://localhost:8080
EOF
cd ..
```

**Note:** After deploying Exchange contract, update both files with the contract address.

---

## Step 4: Deploy Exchange Contract (Optional for now)

If you haven't deployed yet, you can skip this for testing, but orders won't settle on-chain:

```bash
# Terminal 1: Start local blockchain
cd contracts
npx hardhat node

# Terminal 2: Deploy Exchange
cd contracts
npx hardhat run scripts/deploy-exchange.js --network localhost

# Copy the deployed address and update .env files
```

---

## Step 5: Start Backend API Server

**Make sure you're in project root (`TimelessPredect`):**

```bash
# Verify location
pwd
# Should show: /Users/zs/Desktop/tmlspredict/TimelessPredect

# Check file exists
ls api-server.js
# Should show: api-server.js

# Start server
node api-server.js
```

**Expected output:**
```
🚀 API server running on http://localhost:8080
   - GET  /api/price-history
   - POST /api/record-price
   - POST /api/orders (place order)
   - GET  /api/orders (get order book)
   - DELETE /api/orders/:id (cancel order)
   - POST /api/settle (settle trade)
   - WS   ws://localhost:8080 (WebSocket for order book)

🔄 Order matching service: Running (matches every 5s)
```

**Keep this terminal open!**

---

## Step 6: Start Frontend

**Open a new terminal:**

```bash
# Navigate to project root first
cd /Users/zs/Desktop/tmlspredict/TimelessPredect

# Then go to frontend
cd frontend

# Start dev server
npm start
```

**Expected output:**
```
  VITE v7.x.x ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

---

## Step 7: Test Limit Orders

1. **Open browser:** http://localhost:3000
2. **Connect wallet** (MetaMask)
3. **Navigate to a market**
4. **Select "Limit" order type**
5. **Enter:**
   - Price: 45¢
   - Amount: 0.1 ETH
6. **Click "Place Limit Order"**
7. **Sign EIP-712 signature in MetaMask**

**Expected:**
- ✅ Toast: "Limit order placed at 45¢!"
- Order appears in "My Open Orders"
- No errors in console

---

## Troubleshooting

### Error: "Cannot find module 'api-server.js'"

**Cause:** Running from wrong directory

**Fix:**
```bash
# Make sure you're in project root
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
pwd  # Verify location
ls api-server.js  # Verify file exists
node api-server.js  # Now run it
```

### Error: "Cannot connect to API server"

**Fix:**
1. Check backend is running: `curl http://localhost:8080/api/orders?marketId=1&outcomeId=0`
2. Should return JSON (even if empty)
3. If error, backend isn't running - start it!

### Error: "Module not found" when starting backend

**Fix:**
```bash
# Install dependencies
npm install

# Try again
node api-server.js
```

### Error: "Port 8080 already in use"

**Fix:**
```bash
# Find what's using port 8080
lsof -i :8080

# Kill it or change PORT in .env
```

---

## Quick Test Commands

```bash
# Test if API is running
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0

# Test if frontend is running
curl http://localhost:3000

# Check backend dependencies
npm list express cors ws ethers

# Check if you're in right directory
ls api-server.js package.json
```

---

## File Locations

**Correct structure:**
```
TimelessPredect/              ← Project root (run commands here)
├── api-server.js            ← Backend server
├── package.json              ← Backend package.json
├── .env                      ← Backend environment
├── lib/
│   ├── orderBook.js
│   └── eip712.js
├── api/
│   ├── orders.js
│   └── settle.js
└── frontend/
    ├── .env                  ← Frontend environment
    ├── package.json
    └── src/
```

**Common mistake:** Running from `lib/` or `frontend/` directory. Always run from `TimelessPredect/` (root).

