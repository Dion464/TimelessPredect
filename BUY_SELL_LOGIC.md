# Buy & Sell Order Logic - Implementation Guide

## Order Types

### Market Orders
**Market Buy:**
- Fills instantly against best available sell orders in order book
- No AMM fallback - if no matches, order fails
- User should use limit order if no liquidity available

**Market Sell:**
- Fills instantly if there's a matching buy order in the book
- Requires user to have shares (checked before order placement)
- If no matches, order fails - user should use limit sell instead

### Limit Orders
**Limit Buy:**
- Added to order book at specified price
- Waits until someone agrees to sell at that price (or better)
- Can also execute via AMM when market price crosses limit

**Limit Sell:**
- Posts order at chosen price
- Waits until a buyer accepts it
- Requires user to have shares (checked before order placement)

---

## Order Flow

### 1. Order Placement (EIP-712 Signing)
- User signs order off-chain (gasless)
- Order includes: maker, marketId, outcomeId, price, size, side, expiry, salt
- Signature stored with order

### 2. Order Book Storage
- Orders stored in-memory (hybrid CLOB)
- Buy orders sorted: highest price first (descending)
- Sell orders sorted: lowest price first (ascending)
- Matching based on whole cents (e.g., 42.67 matches 42.0-42.9)

### 3. Order Matching
- Matcher runs every 5 seconds
- Pairs compatible orders:
  - Same market and outcome
  - Opposite sides (buy vs sell)
  - Overlapping prices (same whole cents)

### 4. On-Chain Settlement
- When matched, orders executed via Exchange contract
- Smart contract:
  - Verifies both signatures
  - Transfers payment token (ETH/USDC) between parties
  - Mints/burns YES/NO tokens (CTF logic)
  - Collects fees

---

## Token Minting/Burning (CTF Logic)

### No Hard Share Cap
- Markets have no fixed number of shares
- YES/NO tokens minted and burned dynamically

### When Trade Happens:
1. **Buy Order:** 
   - User sends payment token (ETH/USDC)
   - New YES/NO tokens minted from collateral
   - Tokens transferred to buyer

2. **Sell Order:**
   - User sends YES/NO tokens
   - Tokens burned back into payment token
   - Payment token transferred to seller

3. **Combined Shares (YES + NO):**
   - When opposite shares combine, they're burned
   - Returns payment token collateral

---

## Implementation Details

### Market Order Logic
```javascript
// Market order: Only fill from order book
if (isMarketOrder) {
  const matches = orderBook.findMatches(order);
  if (matches.length === 0) {
    // Fail - no matches available
    return error('No matching orders available');
  }
  // Fill immediately at best available prices
  fillOrders(matches);
}
```

### Limit Order Logic
```javascript
// Limit order: Add to book, try to match
const orderId = orderBook.addOrder(order);
const matches = orderBook.findMatches(order);

if (matches.length > 0) {
  // Immediate match - settle on-chain
  settleOrders(matches);
} else {
  // No match - order sits in book
  // Will check AMM execution when price crosses limit
}
```

### Sell Order Validation
```javascript
// Before placing sell order, check user has shares
const userShares = await getUserShares(marketId, outcomeId, userAddress);
if (userShares < order.size) {
  return error('Insufficient shares');
}
```

---

## Key Points

1. **Market orders = instant execution from order book only**
   - No AMM fallback
   - Fail if no matches

2. **Limit orders = wait in order book**
   - Match against other orders
   - Can execute via AMM when price crosses limit

3. **Sell orders require shares**
   - Checked before order placement
   - Can't sell what you don't own

4. **Order book matching**
   - Whole cents matching (42.x matches 42.x)
   - Same market + outcome
   - Opposite sides

5. **On-chain settlement**
   - Exchange contract verifies signatures
   - Transfers payment tokens
   - Mints/burns outcome tokens

---

## User Experience

**Buy Flow:**
1. User selects "Buy" + "Market" → Fills instantly if sell orders exist
2. User selects "Buy" + "Limit" → Order sits in book, executes when matched

**Sell Flow:**
1. User selects "Sell" + "Market" → Fills instantly if buy orders exist
2. User selects "Sell" + "Limit" → Order sits in book, executes when matched
3. System checks user has shares before allowing sell order

---

## Notes

- USDC mentioned as reference (can use ETH or any payment token)
- Shares are dynamic (no cap)
- Tokens minted/burned per trade
- Opposite shares combine to unlock collateral

