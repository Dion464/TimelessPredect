# Hybrid Order System Documentation

## Overview

This implements a **hybrid CLOB (Central Limit Order Book)** system similar to Polymarket, where:
- **Orders are placed off-chain** (gasless) using EIP-712 signatures
- **Order matching happens off-chain** for speed
- **Settlement happens on-chain** for security via the Exchange smart contract

---

## Architecture

### 1. Smart Contract: `Exchange.sol`

**Location**: `contracts/contracts/Exchange.sol`

**Features**:
- EIP-712 signature verification for orders
- On-chain settlement via `fillOrder()`
- Prevents replay attacks using salt tracking
- Platform fee collection (0.2% default)
- ERC-1155 outcome token support (CTF-style)

**Key Functions**:
```solidity
function fillOrder(Order memory makerOrder, uint256 takerSize) external
function cancelOrder(Order memory order) external
function getOrderHash(Order memory order) public view returns (bytes32)
```

**Deployment**:
```bash
cd contracts
npx hardhat run scripts/deploy-exchange.js --network localhost
```

Set environment variables:
- `PAYMENT_TOKEN_ADDRESS` - USDC or payment token
- `OUTCOME_TOKEN_ADDRESS` - ERC-1155 outcome token contract
- `TREASURY_ADDRESS` - Fee recipient

---

### 2. Backend API (`/api/orders`)

**Order Placement** (POST `/api/orders`):
```json
{
  "order": {
    "maker": "0x...",
    "marketId": "1",
    "outcomeId": 0,
    "price": "4000",
    "size": "1000000000000000000",
    "side": true,
    "expiry": "1735689600",
    "salt": "123456789"
  },
  "signature": "0x...",
  "isMarketOrder": false
}
```

**Get Order Book** (GET `/api/orders?marketId=1&outcomeId=0&depth=10`):
Returns top bids and asks for a market/outcome.

**Get User Orders** (GET `/api/orders?user=0x...&marketId=1`):
Returns all open orders for a user.

**Cancel Order** (DELETE `/api/orders/:orderId`):
```json
{
  "userAddress": "0x...",
  "signature": "0x..." // Optional
}
```

---

### 3. Settlement (`/api/settle`)

**Automatic Settlement**:
When orders match off-chain, the backend automatically calls `/api/settle` to execute on-chain.

**Manual Settlement** (POST `/api/settle`):
```json
{
  "makerOrder": { ... },
  "takerOrder": { ... },
  "fillSize": "500000000000000000",
  "signatures": {
    "maker": "0x...",
    "taker": "0x..."
  }
}
```

**Requirements**:
- `SETTLEMENT_PRIVATE_KEY` in env (relayer account)
- `EXCHANGE_CONTRACT_ADDRESS` in env
- Relayer account must have ETH for gas

---

### 4. Frontend Integration

#### EIP-712 Signing (`utils/eip712.js`)

```javascript
import { createOrderWithDefaults, signOrder } from '../../utils/eip712';

// Create order
const order = createOrderWithDefaults({
  maker: account,
  marketId: "1",
  outcomeId: 0, // 0 = YES, 1 = NO
  price: centsToTicks(50), // 50¢ = 5000 ticks
  size: ethers.utils.parseUnits("100", 18).toString(),
  side: true // true = buy, false = sell
});

// Sign with wallet
const signature = await signOrder(order, chainId, exchangeAddress, signer);

// Submit to backend
await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({ order, signature, isMarketOrder: false })
});
```

#### Order Book Hook (`hooks/useOrderBook.jsx`)

```javascript
import { useOrderBook } from '../../hooks/useOrderBook';

const { orderBook, loading } = useOrderBook(marketId, outcomeId);
// Returns { bids: [], asks: [] }
```

#### Trading Interface (`components/trading/HybridOrderInterface.jsx`)

Full UI component for:
- Placing limit/market orders
- Viewing order book
- Managing open orders
- EIP-712 signing

---

## Workflow Example

### 1. Alice Places Limit Buy Order

```javascript
// Frontend
const order = createOrderWithDefaults({
  maker: aliceAddress,
  marketId: "1",
  outcomeId: 0, // YES
  price: centsToTicks(45), // 45¢
  size: "1000000000000000000", // 1 share
  side: true // buy
});

const signature = await signOrder(order, chainId, exchangeAddress, signer);

// POST to /api/orders
// → Order added to order book
// → Status: "open"
```

### 2. Bob Places Limit Sell Order (Matches!)

```javascript
// Bob places sell order at 45¢
// → Backend matches against Alice's order
// → Status: "matched"
// → Auto-settlement triggered
```

### 3. Automatic Settlement

```javascript
// Backend calls /api/settle
// → Exchange.fillOrder() on-chain
// → USDC transferred from Bob to Alice
// → YES tokens transferred from Bob to Alice
// → Trade recorded in events
```

### 4. Order Book Update

- WebSocket broadcasts update
- Frontend receives real-time order book
- Chart and UI update automatically

---

## Environment Variables

**Backend** (`.env`):
```bash
EXCHANGE_CONTRACT_ADDRESS=0x...
CHAIN_ID=1337
RPC_URL=http://localhost:8545
SETTLEMENT_PRIVATE_KEY=0x... # Relayer private key
PAYMENT_TOKEN_ADDRESS=0x... # USDC
OUTCOME_TOKEN_ADDRESS=0x... # ERC-1155
```

**Frontend** (`.env`):
```bash
VITE_EXCHANGE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=1337
VITE_API_BASE_URL=http://localhost:8080
```

---

## Testing

### 1. Deploy Contracts

```bash
cd contracts
npx hardhat node # Start local node
npx hardhat run scripts/deploy-exchange.js --network localhost
```

### 2. Start Backend

```bash
npm install
node api-server.js
```

### 3. Test Order Flow

```bash
# Place order via API
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order": { ... },
    "signature": "0x...",
    "isMarketOrder": false
  }'

# Get order book
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0
```

---

## Integration with Existing System

The hybrid order system can work alongside the existing AMM system:

1. **Users choose**:
   - AMM (instant execution via `buyShares()`)
   - CLOB (limit orders, better prices)

2. **Both systems** use the same outcome tokens and payment tokens

3. **Market prices** are displayed from both systems

---

## Next Steps

1. ✅ Exchange contract deployed
2. ✅ Backend APIs implemented
3. ✅ Frontend EIP-712 signing
4. ✅ Order matching service
5. 🔄 Deploy to testnet
6. 🔄 Add order history/trade tracking
7. 🔄 Add cancel order on-chain support
8. 🔄 Optimize gas costs for settlement

---

## Notes

- **Gasless orders**: Users sign orders off-chain, no gas until matched
- **Automatic matching**: Backend matches orders every 5 seconds
- **Partial fills**: Supported - orders can fill incrementally
- **Price in ticks**: 4000 ticks = 40 cents = 0.40 (divide by 100 to get cents)
- **WebSocket fallback**: Automatically falls back to polling if WS unavailable

