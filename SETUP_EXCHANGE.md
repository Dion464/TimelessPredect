# Exchange Contract Setup Guide

This guide walks you through setting up the Exchange contract for the hybrid order system.

---

## Step 1: Deploy Exchange Contract

### Option A: Deploy to Localhost (Hardhat)

```bash
# Terminal 1: Start local blockchain
cd contracts
npx hardhat node

# Terminal 2: Deploy Exchange contract
cd contracts
npx hardhat run scripts/deploy-exchange.js --network localhost
```

**Output will show:**
```
✅ Exchange deployed to: 0x...
📝 Domain Separator: 0x...
💾 Deployment info saved to: deployments/exchange-localhost.json
```

**Copy the contract address** - you'll need it for environment variables.

---

### Option B: Deploy to Testnet (Polygon Amoy)

```bash
cd contracts

# Set testnet environment
export PRIVATE_KEY=your_private_key
export POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology/

# Deploy
npx hardhat run scripts/deploy-exchange.js --network amoy
```

**Note:** You'll need testnet ETH for deployment gas fees.

---

## Step 2: Configure Environment Variables

### Backend Configuration

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and set:**
   ```bash
   EXCHANGE_CONTRACT_ADDRESS=0x...  # From deployment output
   CHAIN_ID=1337                    # Or 80002 for Polygon Amoy
   RPC_URL=http://localhost:8545    # Or testnet RPC
   SETTLEMENT_PRIVATE_KEY=0x...     # Relayer account private key
   PORT=8080
   ```

3. **For Token Integration (if using ERC-20/ERC-1155):**
   ```bash
   PAYMENT_TOKEN_ADDRESS=0x...      # USDC contract address
   OUTCOME_TOKEN_ADDRESS=0x...      # ERC-1155 outcome token contract
   ```

### Frontend Configuration

1. **Copy the example file:**
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **Edit `frontend/.env` and set:**
   ```bash
   VITE_EXCHANGE_CONTRACT_ADDRESS=0x...  # Same as backend
   VITE_CHAIN_ID=1337                     # Same as backend
   VITE_API_BASE_URL=http://localhost:8080
   ```

---

## Step 3: Setup Relayer Account (For Auto-Settlement)

The relayer account pays gas for settling matched orders on-chain.

### For Localhost:

1. **Use a Hardhat account:**
   ```bash
   # Hardhat node provides 20 accounts with 10,000 ETH each
   # Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   # Use this account's private key
   ```

2. **Get private key from Hardhat:**
   - Hardhat accounts use deterministic private keys
   - Account 0: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

3. **Add to `.env`:**
   ```bash
   SETTLEMENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```

### For Testnet:

1. **Create or use an existing account**
2. **Fund it with testnet ETH** (for gas)
3. **Export private key** (keep it secure!)
4. **Add to `.env`:**
   ```bash
   SETTLEMENT_PRIVATE_KEY=0x...
   ```

⚠️ **Security Warning:** Never commit private keys to git! Add `.env` to `.gitignore`.

---

## Step 4: Start Services

### Terminal 1: Backend API Server
```bash
cd TimelessPredect
npm install  # If not already installed
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

### Terminal 2: Frontend
```bash
cd frontend
npm install  # If not already installed
npm start
```

**Expected output:**
```
  VITE v7.x.x ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

---

## Step 5: Test Limit Orders

1. **Open browser:** http://localhost:3000
2. **Connect wallet** (MetaMask)
3. **Navigate to a market**
4. **Select "Limit" order type**
5. **Enter price and amount**
6. **Click "Place Limit Order"**
7. **MetaMask prompts for EIP-712 signature**
8. **Confirm signature**

**Expected:**
- ✅ Toast: "Limit order placed at X¢!"
- Order appears in "My Open Orders"
- Order appears in order book

---

## Troubleshooting

### Issue: "Exchange contract not deployed"

**Fix:** Deploy the contract first (Step 1)

### Issue: "Invalid signature"

**Fix:** 
- Check `VITE_EXCHANGE_CONTRACT_ADDRESS` matches deployed contract
- Check `VITE_CHAIN_ID` matches network
- Verify contract is deployed on correct network

### Issue: "Settlement failed"

**Fix:**
- Check relayer account has ETH for gas
- Verify `SETTLEMENT_PRIVATE_KEY` is correct
- Check token approvals (if using ERC-20/ERC-1155)

### Issue: "Orders not matching"

**Fix:**
- Check backend API server is running
- Verify order matching service started (check logs)
- Check orders have compatible prices

### Issue: "WebSocket connection failed"

**Fix:**
- Check API server is running on correct port
- Verify WebSocket path is `/ws`
- Falls back to polling automatically

---

## Verification Checklist

- [ ] Exchange contract deployed
- [ ] Contract address in backend `.env`
- [ ] Contract address in frontend `.env`
- [ ] `CHAIN_ID` matches network
- [ ] `SETTLEMENT_PRIVATE_KEY` set
- [ ] Relayer account has ETH
- [ ] Backend API server running
- [ ] Frontend running
- [ ] Can place limit order
- [ ] Order appears in order book
- [ ] Orders match automatically

---

## Next Steps

Once setup is complete:

1. **Test with two accounts** - place buy and sell orders
2. **Verify automatic matching** - orders should match within 5 seconds
3. **Check on-chain settlement** - verify trades execute on-chain
4. **Monitor order book** - should update in real-time

For production deployment, see `HYBRID_ORDER_SYSTEM.md` for additional considerations.

