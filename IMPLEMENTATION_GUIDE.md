# Hybrid Order System - Step-by-Step Implementation Guide

This document explains exactly what was implemented and how each component works.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Smart Contract Implementation](#smart-contract-implementation)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Integration & Flow](#integration--flow)
6. [Testing & Verification](#testing--verification)

---

## 1. Overview

### Goal
Implemented a **hybrid CLOB (Central Limit Order Book)** system similar to Polymarket where:
- Users place orders **off-chain** using EIP-712 signatures (gasless)
- Orders are matched **off-chain** for speed
- Final settlement happens **on-chain** for security

### Architecture Flow
```
User → EIP-712 Signature → Backend API → Order Book → Matching Engine → On-Chain Settlement
```

---

## 2. Smart Contract Implementation

### File: `contracts/contracts/Exchange.sol`

**What it does:**
- Handles on-chain settlement of matched orders
- Verifies EIP-712 signatures
- Transfers payment tokens (USDC) and outcome tokens (ERC-1155)
- Prevents replay attacks using salt tracking
- Collects platform fees

**Key Functions Implemented:**

1. **`fillOrder(Order memory makerOrder, uint256 takerSize)`**
   - Verifies EIP-712 signature
   - Checks order hasn't expired or been filled/canceled
   - Validates salt hasn't been reused
   - Transfers payment tokens and outcome tokens
   - Records trade event
   - Marks order as filled if fully executed

2. **`getOrderHash(Order memory order)`**
   - Computes EIP-712 hash of order
   - Matches frontend/backend hash calculation

3. **`verifyOrderSignature(Order memory order)`**
   - Recovers signer from EIP-712 signature
   - Validates signer matches order maker

4. **`cancelOrder(Order memory order)`**
   - Allows maker to cancel their order on-chain
   - Prevents cancellation of filled orders

**EIP-712 Structure:**
```solidity
Order {
  address maker;
  uint256 marketId;
  uint256 outcomeId;  // 0 = YES, 1 = NO
  uint256 price;      // in ticks (4000 = 40 cents)
  uint256 size;       // number of shares
  bool side;          // true = buy, false = sell
  uint256 expiry;     // timestamp
  uint256 salt;       // random nonce
}
```

**Deployment:**
- Created `contracts/scripts/deploy-exchange.js`
- Requires: payment token address, outcome token address, treasury address
- Exports domain separator for frontend/backend verification

---

## 3. Backend Implementation

### 3.1 Order Book Service

**File: `lib/orderBook.js`**

**What it does:**
- Maintains in-memory order book (can be upgraded to Redis)
- Sorts orders by price (bids descending, asks ascending)
- Matches compatible orders
- Tracks order status (open, partially_filled, filled, canceled)

**Key Methods:**

1. **`addOrder(order)`**
   - Adds order to appropriate side (buy/sell)
   - Inserts in sorted order by price
   - Returns unique order ID

2. **`findMatches(newOrder)`**
   - Finds compatible counter-orders
   - Buy orders match against sell orders (same outcome, overlapping price)
   - Returns array of matches with fill sizes

3. **`fillOrder(orderId, fillSize)`**
   - Updates order filled amount
   - Marks as filled or partially_filled

4. **`getOrderBook(marketId, outcomeId, depth)`**
   - Returns top N bids and asks
   - Filters out filled/canceled orders

5. **`getUserOrders(userAddress, marketId)`**
   - Returns all open orders for a user

### 3.2 EIP-712 Utilities

**File: `lib/eip712.js`**

**What it does:**
- Verifies EIP-712 signatures server-side
- Computes order hashes (matches contract)
- Matches contract's domain separator

**Key Functions:**

1. **`verifyOrderSignature(order, signature, chainId, verifyingContract)`**
   - Computes EIP-712 hash
   - Recovers signer address
   - Validates against order maker

2. **`computeOrderHash(order, chainId, verifyingContract)`**
   - Returns order hash (same as contract's `getOrderHash`)

3. **`createOrderTypedData(order, chainId, verifyingContract)`**
   - Creates EIP-712 typed data structure
   - Matches contract's domain

### 3.3 API Endpoints

**File: `api/orders.js`**

**Endpoints Implemented:**

1. **POST `/api/orders`**
   - Accepts: `{ order, signature, isMarketOrder }`
   - Verifies EIP-712 signature
   - For limit orders: adds to book, tries to match
   - For market orders: finds best matches immediately
   - Returns: `{ orderId, status: 'open' | 'matched', matches }`

2. **GET `/api/orders`**
   - Query params: `marketId`, `outcomeId`, `depth`, `user`
   - Returns order book depth or user's orders

3. **DELETE `/api/orders/:orderId`**
   - Body: `{ userAddress }`
   - Cancels order (off-chain)
   - Returns: `{ orderId, status: 'canceled' }`

**File: `api/settle.js`**

**POST `/api/settle`**
- Accepts: `{ makerOrder, takerOrder, fillSize, signatures }`
- Verifies both signatures
- Calls `Exchange.fillOrder()` on-chain
- Updates order book
- Returns: `{ success, txHash, blockNumber }`

**Requirements:**
- `SETTLEMENT_PRIVATE_KEY` env var (relayer account)
- Relayer must have ETH for gas
- Exchange contract address configured

### 3.4 Order Matching Service

**File: `lib/orderMatcher.js`**

**What it does:**
- Automatically matches orders every 5 seconds
- Calls settlement callback when matches found
- Processes partial fills

**Implementation:**
- Singleton pattern
- Starts/stops matching service
- Calls `handleAutoSettlement()` when matches found

### 3.5 API Server Updates

**File: `api-server.js`**

**Changes Made:**

1. Added WebSocket server using `ws` library
2. Added routes for `/api/orders` and `/api/settle`
3. Implemented `broadcastOrderBookUpdate()` function
4. Integrated order matching service
5. Auto-settlement callback

**WebSocket Implementation:**
- Clients subscribe to `{ type: 'subscribe', marketId, outcomeId }`
- Server broadcasts updates when order book changes
- Handles connection/disconnection gracefully

---

## 4. Frontend Implementation

### 4.1 EIP-712 Utilities

**File: `frontend/src/utils/eip712.js`**

**What it does:**
- Client-side EIP-712 signing
- Order creation helpers
- Price conversion (cents ↔ ticks)
- Order validation

**Key Functions:**

1. **`createOrderWithDefaults({...}, options)`**
   - Creates order object with defaults
   - Auto-generates salt if not provided
   - Sets expiry to 30 days if not specified

2. **`signOrder(order, chainId, verifyingContract, signer)`**
   - Signs order using `signer._signTypedData()` (ethers.js v5)
   - Returns EIP-712 signature

3. **`centsToTicks(cents)` / `ticksToCents(ticks)`**
   - Price conversion utilities
   - 1 cent = 100 ticks

4. **`validateOrder(order)`**
   - Validates order before signing
   - Checks address, price range, expiry, etc.

### 4.2 Order Book Hook

**File: `frontend/src/hooks/useOrderBook.jsx`**

**What it does:**
- Fetches order book from API
- Connects to WebSocket for real-time updates
- Falls back to polling if WebSocket unavailable

**Usage:**
```jsx
const { orderBook, loading, error } = useOrderBook(marketId, outcomeId);
// orderBook.bids = array of buy orders
// orderBook.asks = array of sell orders
```

**Features:**
- Auto-reconnects WebSocket
- Polls every 5s if WebSocket fails
- Cleans up on unmount

### 4.3 Trading Interface

**File: `frontend/src/components/trading/HybridOrderInterface.jsx`**

**What it does:**
- Complete UI for placing orders
- Shows order book
- Manages user's open orders

**Features Implemented:**

1. **Order Placement:**
   - Select outcome (YES/NO)
   - Choose order type (Limit/Market)
   - Enter price (limit orders)
   - Enter size (shares)
   - Sign with EIP-712 (gasless)
   - Submit to `/api/orders`

2. **Order Book Display:**
   - Shows top bids (buy orders)
   - Shows top asks (sell orders)
   - Displays spread
   - Real-time updates via WebSocket

3. **User Orders:**
   - Lists all open orders
   - Shows fill status (partial fills)
   - Cancel button for each order

4. **Price Helpers:**
   - Quick price buttons (-5%, Market, +5%)
   - Auto-fills current market price
   - Shows total cost calculation

**State Management:**
- `activeTab`: 'buy' | 'sell'
- `orderType`: 'limit' | 'market'
- `side`: 'yes' | 'no'
- `price`: limit price in cents
- `size`: number of shares
- `myOrders`: array of user's orders

### 4.4 Order Book Display Component

**File: `frontend/src/components/orderbook/OrderBookDisplay.jsx`**

**What it does:**
- Standalone order book visualization
- Shows bids/asks in separate columns
- Displays market price and spread

**Features:**
- Color-coded (green bids, red asks)
- Configurable depth
- Loading states
- Empty state handling

---

## 5. Integration & Flow

### Complete Order Flow

#### Step 1: User Places Order
```
User clicks "Place Order"
  ↓
Frontend creates order object:
  - maker: user address
  - marketId: "1"
  - outcomeId: 0 (YES)
  - price: 4500 (ticks = 45¢)
  - size: "1000000000000000000" (1 share)
  - side: true (buy)
  - expiry: timestamp + 30 days
  - salt: random nonce
  ↓
Frontend calls signOrder() → MetaMask prompts for EIP-712 signature
  ↓
Signature obtained (gasless!)
  ↓
POST /api/orders { order, signature, isMarketOrder: false }
```

#### Step 2: Backend Processing
```
Backend receives order
  ↓
Verify EIP-712 signature (lib/eip712.js)
  ↓
Check order expiry
  ↓
Add to order book (lib/orderBook.js)
  - Insert in sorted order (by price)
  - Return order ID
  ↓
Try to find matches (orderBook.findMatches())
  ↓
If matches found:
  → Return { status: 'matched', matches: [...] }
Else:
  → Return { status: 'open', orderId: "123" }
  ↓
Broadcast order book update via WebSocket
```

#### Step 3: Automatic Matching
```
Order matching service runs every 5 seconds
  ↓
Scans all open orders
  ↓
For each order, finds compatible counter-orders:
  - Buy vs Sell (same outcome)
  - Price compatibility (buy >= sell)
  ↓
When match found:
  → Update order book (fillOrder)
  → Call handleAutoSettlement()
```

#### Step 4: Settlement
```
handleAutoSettlement() called with:
  - makerOrder (existing order)
  - takerOrder (new order)
  - fillSize
  - fillPrice
  ↓
POST /api/settle
  ↓
Verify both signatures
  ↓
Call Exchange.fillOrder() on-chain
  - Transfers payment tokens
  - Transfers outcome tokens
  - Collects platform fee
  - Records trade event
  ↓
Return { success: true, txHash: "0x..." }
```

#### Step 5: UI Updates
```
Order matched event
  ↓
WebSocket broadcasts order book update
  ↓
useOrderBook hook receives update
  ↓
HybridOrderInterface re-renders
  ↓
User sees:
  - Order filled notification
  - Updated order book
  - Updated balance
```

---

## 6. Testing & Verification

### Manual Testing Steps

#### 1. Deploy Exchange Contract
```bash
cd contracts
npx hardhat node  # Terminal 1
npx hardhat run scripts/deploy-exchange.js --network localhost  # Terminal 2
```
**Expected:** Contract address printed, deployment file created

#### 2. Configure Environment
```bash
# Backend .env
EXCHANGE_CONTRACT_ADDRESS=0x...  # From deployment
CHAIN_ID=1337
SETTLEMENT_PRIVATE_KEY=0x...     # Relayer account
RPC_URL=http://localhost:8545

# Frontend .env
VITE_EXCHANGE_CONTRACT_ADDRESS=0x...  # Same as above
VITE_CHAIN_ID=1337
VITE_API_BASE_URL=http://localhost:8080
```

#### 3. Start Services
```bash
# Terminal 1: Backend
cd TimelessPredect
node api-server.js

# Terminal 2: Frontend
cd frontend
npm start
```

**Expected Output:**
```
🚀 API server running on http://localhost:8080
   - POST /api/orders
   - GET /api/orders
   - POST /api/settle
   - WS   ws://localhost:8080
🔄 Order matching service: Running (matches every 5s)
```

#### 4. Test Order Placement
```
1. Open frontend
2. Navigate to market page
3. Use HybridOrderInterface component
4. Fill in:
   - Outcome: YES
   - Order Type: Limit
   - Price: 45¢
   - Size: 100 shares
5. Click "Place Limit Order"
6. MetaMask prompts for signature
7. Confirm signature
```

**Expected:**
- Order appears in "My Open Orders"
- Order book shows new bid
- Toast notification: "✅ Limit order placed at 45¢!"

#### 5. Test Matching
```
1. Use different account (or same account with different side)
2. Place counter-order:
   - Outcome: YES
   - Order Type: Limit
   - Price: 45¢ (same or better)
   - Size: 100 shares
   - Side: Sell (opposite)
3. Wait up to 5 seconds
```

**Expected:**
- Orders match automatically
- Settlement transaction on-chain
- Both orders show as filled
- Trade recorded in Exchange contract events

#### 6. Test Order Book
```bash
# API call
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0&depth=10
```

**Expected:**
```json
{
  "marketId": "1",
  "outcomeId": "0",
  "bids": [
    { "price": "4500", "size": "100", "remaining": "100", "orderId": "1" },
    ...
  ],
  "asks": [
    { "price": "4600", "size": "50", "remaining": "50", "orderId": "2" },
    ...
  ]
}
```

#### 7. Test WebSocket
```javascript
// Browser console
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    marketId: '1',
    outcomeId: '0'
  }));
};
ws.onmessage = (e) => console.log('Update:', JSON.parse(e.data));
```

**Expected:**
- Receives `{ type: 'subscribed', ... }`
- Receives updates when order book changes

---

## 7. File Structure

### Created Files

**Smart Contracts:**
- `contracts/contracts/Exchange.sol`
- `contracts/scripts/deploy-exchange.js`

**Backend:**
- `lib/orderBook.js` - In-memory order book
- `lib/eip712.js` - EIP-712 utilities (backend)
- `lib/orderMatcher.js` - Automatic matching service
- `api/orders.js` - Order API endpoints
- `api/settle.js` - Settlement endpoint

**Frontend:**
- `frontend/src/utils/eip712.js` - EIP-712 signing utilities
- `frontend/src/hooks/useOrderBook.jsx` - Order book hook
- `frontend/src/components/trading/HybridOrderInterface.jsx` - Trading UI
- `frontend/src/components/orderbook/OrderBookDisplay.jsx` - Order book display

**Documentation:**
- `HYBRID_ORDER_SYSTEM.md` - Architecture documentation
- `HYBRID_ORDER_QUICKSTART.md` - Quick start guide
- `IMPLEMENTATION_GUIDE.md` - This file

### Modified Files

**Backend:**
- `api-server.js` - Added WebSocket, order routes, matching service
- `package.json` - Added `ws` dependency

---

## 8. Key Design Decisions

### Why EIP-712?
- **Gasless orders**: Users sign off-chain, no gas until matched
- **Security**: Signature verification on-chain prevents tampering
- **Standard**: EIP-712 is widely supported by wallets

### Why Hybrid (Off-chain + On-chain)?
- **Speed**: Order matching off-chain is instant
- **Cost**: Users don't pay gas until orders match
- **Security**: Final settlement on-chain ensures trustlessness

### Why In-Memory Order Book?
- **Simple**: Easy to implement and test
- **Fast**: No database latency
- **Upgradeable**: Can swap to Redis later

### Price in Ticks?
- **Precision**: Avoids floating-point issues
- **Standard**: Common in order books (4000 = 40 cents)
- **Conversion**: Easy helpers provided (cents ↔ ticks)

---

## 9. Known Limitations & Future Improvements

### Current Limitations
1. **In-memory order book**: Lost on server restart (fix: use Redis/DB)
2. **Single server**: No distributed matching (fix: Redis pub/sub)
3. **No order history**: Not persisted (fix: database storage)
4. **Manual fee payment**: Taker pays gas (fix: meta-transactions)

### Future Improvements
1. **Redis order book**: Persistent, distributed
2. **Order history API**: Track all orders/trades
3. **Partial fill optimization**: Better fill logic
4. **Order priority**: Price-time priority queue
5. **On-chain cancellation**: Call contract's cancelOrder()
6. **Trade history UI**: Show all settled trades
7. **Advanced order types**: Stop-loss, iceberg, etc.

---

## 10. Troubleshooting

### Orders Not Matching
- **Check prices**: Buy price must be >= Sell price
- **Check outcome**: Must be same outcome (YES/YES or NO/NO)
- **Check status**: Orders must be 'open' or 'partially_filled'

### Signature Verification Failing
- **Check CHAIN_ID**: Must match network
- **Check contract address**: Must be deployed Exchange contract
- **Check order structure**: All fields must match EIP-712 format

### Settlement Failing
- **Check relayer balance**: Must have ETH for gas
- **Check approvals**: Payment/outcome tokens must be approved
- **Check contract addresses**: Must be correct

### WebSocket Not Connecting
- **Check port**: Must match API server port
- **Check CORS**: Server must allow WebSocket connections
- **Fallback**: Automatically falls back to polling

---

## Summary

This implementation provides a complete hybrid CLOB order system:

✅ **Smart Contract**: Exchange.sol with EIP-712 verification
✅ **Backend**: Order book, matching, settlement APIs
✅ **Frontend**: EIP-712 signing, order placement UI, order book display
✅ **Real-time Updates**: WebSocket support
✅ **Automatic Matching**: Runs every 5 seconds
✅ **On-chain Settlement**: Secure, trustless execution

The system is production-ready for localhost testing and can be extended with Redis/database persistence for production deployment.

