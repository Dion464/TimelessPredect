# Hybrid Order System - Quick Start Guide

## 🚀 Setup (5 minutes)

### 1. Install Dependencies

```bash
# Backend
cd TimelessPredect
npm install

# Frontend (if not already installed)
cd frontend
npm install
```

### 2. Deploy Exchange Contract

```bash
cd contracts

# Start local node (in one terminal)
npx hardhat node

# Deploy Exchange (in another terminal)
# Set these env vars or update deploy script:
# - PAYMENT_TOKEN_ADDRESS (USDC contract)
# - OUTCOME_TOKEN_ADDRESS (ERC-1155 outcome tokens)
# - TREASURY_ADDRESS (fee recipient)
npx hardhat run scripts/deploy-exchange.js --network localhost
```

**Copy the deployed address** to your `.env` files.

### 3. Configure Environment Variables

**Backend `.env`**:
```bash
EXCHANGE_CONTRACT_ADDRESS=0x... # From deployment
CHAIN_ID=1337
RPC_URL=http://localhost:8545
SETTLEMENT_PRIVATE_KEY=0x... # Relayer private key (for auto-settlement)
PAYMENT_TOKEN_ADDRESS=0x... # USDC or similar
OUTCOME_TOKEN_ADDRESS=0x... # ERC-1155 outcome token
PORT=8080
```

**Frontend `.env`** (or `config.js`):
```bash
VITE_EXCHANGE_CONTRACT_ADDRESS=0x... # Same as backend
VITE_CHAIN_ID=1337
VITE_API_BASE_URL=http://localhost:8080
```

### 4. Start Services

```bash
# Terminal 1: Backend API + WebSocket
cd TimelessPredect
node api-server.js

# Terminal 2: Frontend
cd frontend
npm start
```

---

## 📝 Usage

### Place a Limit Order (Frontend)

The `HybridOrderInterface` component handles everything:

```jsx
import HybridOrderInterface from './components/trading/HybridOrderInterface';

<HybridOrderInterface 
  marketId="1" 
  market={marketData}
  onTradeComplete={() => console.log('Trade completed!')}
/>
```

**User Flow**:
1. Select outcome (YES/NO)
2. Choose order type (Limit/Market)
3. Enter price (if limit) and size
4. Click "Place Order"
5. MetaMask prompts for EIP-712 signature (gasless!)
6. Order appears in order book

### Place Order via API

```bash
# Sign order with EIP-712 (see utils/eip712.js)
# Then POST to backend:

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

### View Order Book

```bash
# API
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0&depth=10

# Frontend Hook
const { orderBook } = useOrderBook(marketId, outcomeId);
console.log(orderBook.bids, orderBook.asks);
```

### Cancel Order

```bash
# API
curl -X DELETE http://localhost:8080/api/orders/123 \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x..."}'
```

---

## 🔄 How It Works

### Order Flow

1. **User signs order** (EIP-712, gasless) → Frontend
2. **Order submitted** → Backend `/api/orders`
3. **Order added to book** → In-memory order book
4. **Auto-matching** → Every 5 seconds, backend finds matches
5. **Settlement** → Matched orders trigger `/api/settle` → On-chain execution

### Matching Logic

- **Buy orders** match against **Sell orders** (same outcome)
- **Price compatibility**: Buy price >= Sell price
- **Partial fills** supported
- **Best price first** (price-time priority)

### WebSocket Updates

Order book updates broadcast in real-time:

```javascript
// Automatically handled by useOrderBook hook
const { orderBook } = useOrderBook(marketId, outcomeId);
// Updates automatically when orders change
```

---

## 🧪 Testing

### Test with Two Accounts

1. **Account A** places: Buy 100 YES @ 45¢
2. **Account B** places: Sell 100 YES @ 45¢
3. **Backend matches** (within 5 seconds)
4. **Auto-settles** on-chain
5. **Both accounts** see trade in order history

### Manual Testing

```bash
# 1. Place order as Alice
POST /api/orders (with Alice's signature)

# 2. Place order as Bob (should match)
POST /api/orders (with Bob's signature)

# 3. Check order book
GET /api/orders?marketId=1&outcomeId=0

# 4. Verify on-chain settlement
# Check Exchange contract events
```

---

## 🔧 Troubleshooting

### Orders Not Matching

- Check order prices are compatible
- Verify both orders same `marketId` and `outcomeId`
- Check order book status: `GET /api/orders?marketId=...`

### Settlement Failing

- Verify `SETTLEMENT_PRIVATE_KEY` has ETH for gas
- Check `EXCHANGE_CONTRACT_ADDRESS` is correct
- Ensure payment/outcome tokens are approved

### WebSocket Not Connecting

- Falls back to polling automatically
- Check `api-server.js` is running
- Verify port matches frontend config

### Signature Verification Failing

- Check `CHAIN_ID` matches network
- Verify `EXCHANGE_CONTRACT_ADDRESS` matches deployed contract
- Ensure order structure matches EIP-712 format

---

## 📚 Next Steps

1. ✅ Deploy to testnet (Polygon Amoy)
2. ✅ Add order history UI
3. ✅ Implement on-chain cancellation
4. ✅ Add trade history tracking
5. ✅ Optimize gas costs

---

## 📖 Full Documentation

See `HYBRID_ORDER_SYSTEM.md` for complete architecture and API documentation.

