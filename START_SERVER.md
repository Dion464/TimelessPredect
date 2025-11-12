# How to Start the Backend Server

## Step-by-Step Instructions

### 1. Navigate to Project Root

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
```

### 2. Verify You're in the Right Place

```bash
# Should show api-server.js
ls api-server.js

# Should show package.json
ls package.json
```

### 3. Install Dependencies (if needed)

```bash
npm install
```

### 4. Create .env File (if doesn't exist)

```bash
# Check if it exists
cat .env

# If it doesn't exist, create it:
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

### 5. Start the Server

```bash
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

### 6. Keep This Terminal Open!

The server must keep running. Don't close this terminal.

---

## Test the Server

**In a new terminal**, test if it's working:

```bash
# Test GET endpoint
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0

# Should return JSON (even if empty):
# {"marketId":"1","outcomeId":"0","bids":[],"asks":[]}
```

---

## Troubleshooting

### Error: "Cannot find module 'express'"

**Fix:**
```bash
npm install
```

### Error: "Port 8080 already in use"

**Fix:**
```bash
# Find what's using port 8080
lsof -i :8080

# Kill it
kill -9 <PID>

# Or change port in .env
PORT=8081
```

### Error: "Cannot find module './api/orders.js'"

**Fix:** Make sure you're in the project root (`TimelessPredect/`), not in `lib/` or `frontend/`

### Server starts but routes return 404

**Fix:** I've updated the routes - restart the server:
1. Stop server (Ctrl+C)
2. Start again: `node api-server.js`

---

## Quick Start Script

You can also use the startup script:

```bash
./start-backend.sh
```

This script:
- Checks you're in the right directory
- Installs dependencies if needed
- Creates .env if missing
- Starts the server

---

## Verify Server is Running

```bash
# Check if something is listening on port 8080
lsof -i :8080

# Should show node process
```

---

## After Server Starts

1. **Keep this terminal open** - server must keep running
2. **Open a new terminal** for frontend or other commands
3. **Test in browser** - try placing a limit order
4. **Check server logs** - you'll see incoming requests

