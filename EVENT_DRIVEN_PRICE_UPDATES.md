# Event-Driven Price Updates Implementation Plan

## Overview

This document outlines how to replace polling-based price updates with event-driven real-time updates using smart contract events. Instead of polling `getCurrentPrice()` every 30 seconds, we'll listen to blockchain events that emit when trades happen.

---

## Current State Analysis

### Where Prices Are Currently Fetched

1. **`Web3TradingInterface.jsx` (Lines 170-201)**
   - Polls `getCurrentPrice()` every 30 seconds
   - Updates `marketData` state with YES/NO prices
   - Used in trading interface components

2. **`useWeb3.jsx` (Lines 602-611)**
   - `getMarketData()` function calls `getCurrentPrice()` 
   - Returns prices as part of market data object
   - Used when fetching full market information

3. **`MarketDetailWormStyle.jsx` (Lines 125-126, 251-255)**
   - Fetches prices in `fetchData()` and `recordPriceAfterTrade()`
   - Updates local state for market display

4. **`PolymarketStyleTrading.jsx` (Lines 249-250, 638-641, 706-707)**
   - Multiple price fetch locations
   - Used for chart updates and price recording

### Current Polling Intervals

| File | Interval | What It Polls |
|------|----------|---------------|
| `Web3TradingInterface.jsx` | 30 seconds | YES/NO prices |
| `useWeb3.jsx` | N/A (on-demand) | Market data including prices |
| `MarketDetailWormStyle.jsx` | 60 seconds | Full market data |
| `PolymarketStyleTrading.jsx` | 30-60 seconds | Prices and trade data |

---

## Available Smart Contract Events

From `eth-config.js` (Lines 24-27):

```javascript
"event SharesPurchased(uint256 indexed marketId, address indexed buyer, bool isYes, uint256 shares, uint256 cost, uint256 newPrice)"
"event SharesSold(uint256 indexed marketId, address indexed seller, bool isYes, uint256 shares, uint256 payout, uint256 newPrice)"
"event MarketResolved(uint256 indexed marketId, uint8 outcome, uint256 totalPayout)"
"event MarketCreated(uint256 indexed marketId, address indexed creator, string question, string category, uint256 endTime)"
```

### Key Event Data for Price Updates

- **`SharesPurchased` event parameters:**
  - `marketId` (indexed) - Which market
  - `buyer` (indexed) - Who bought
  - `isYes` - YES or NO shares
  - `shares` - Amount purchased
  - `cost` - ETH spent
  - **`newPrice`** - **New price after purchase (in basis points, e.g., 5000 = 50%)**

- **`SharesSold` event parameters:**
  - `marketId` (indexed) - Which market
  - `seller` (indexed) - Who sold
  - `isYes` - YES or NO shares
  - `shares` - Amount sold
  - `payout` - ETH received
  - **`newPrice`** - **New price after sale (in basis points, e.g., 5000 = 50%)**

**Important:** The `newPrice` in events represents the price for the side that was traded (YES or NO). To get both prices, you may need to:
- If `isYes = true`: `newPrice` is YES price, NO price = `10000 - newPrice`
- If `isYes = false`: `newPrice` is NO price, YES price = `10000 - newPrice`

---

## Implementation Plan

### Phase 1: Setup Event Listeners in `useWeb3.jsx` (Global Level)

**Goal:** Create a centralized event listener system that components can subscribe to.

**Location:** `TimelessPredect/frontend/src/hooks/useWeb3.jsx`

**Steps:**

1. **Add state for price updates**
   ```javascript
   const [priceSubscribers, setPriceSubscribers] = useState(new Map()); // marketId -> callback[]
   ```

2. **Create event listener setup function**
   ```javascript
   const setupPriceEventListeners = useCallback(() => {
     if (!contracts.predictionMarket || !provider) return;
     
     const contract = contracts.predictionMarket;
     
     // Global listener for all markets
     const handleSharesPurchased = (marketId, buyer, isYes, shares, cost, newPrice) => {
       const priceCents = parseFloat(newPrice.toString()) / 100; // Convert basis points to cents
       const yesPrice = isYes ? priceCents : (100 - priceCents);
       const noPrice = isYes ? (100 - priceCents) : priceCents;
       
       // Notify subscribers for this market
       const callbacks = priceSubscribers.get(marketId.toString());
       if (callbacks) {
         callbacks.forEach(cb => cb({ yesPrice, noPrice, marketId: marketId.toString() }));
       }
     };
     
     const handleSharesSold = (marketId, seller, isYes, shares, payout, newPrice) => {
       const priceCents = parseFloat(newPrice.toString()) / 100;
       const yesPrice = isYes ? priceCents : (100 - priceCents);
       const noPrice = isYes ? (100 - priceCents) : priceCents;
       
       const callbacks = priceSubscribers.get(marketId.toString());
       if (callbacks) {
         callbacks.forEach(cb => cb({ yesPrice, noPrice, marketId: marketId.toString() }));
       }
     };
     
     // Subscribe to events (no filter = listen to all markets)
     contract.on('SharesPurchased', handleSharesPurchased);
     contract.on('SharesSold', handleSharesSold);
     
     return () => {
       contract.off('SharesPurchased', handleSharesPurchased);
       contract.off('SharesSold', handleSharesSold);
     };
   }, [contracts.predictionMarket, provider, priceSubscribers]);
   ```

3. **Add subscription management functions**
   ```javascript
   const subscribeToPriceUpdates = useCallback((marketId, callback) => {
     setPriceSubscribers(prev => {
       const newMap = new Map(prev);
       if (!newMap.has(marketId.toString())) {
         newMap.set(marketId.toString(), []);
       }
       newMap.get(marketId.toString()).push(callback);
       return newMap;
     });
     
     return () => {
       // Unsubscribe function
       setPriceSubscribers(prev => {
         const newMap = new Map(prev);
         const callbacks = newMap.get(marketId.toString()) || [];
         newMap.set(marketId.toString(), callbacks.filter(cb => cb !== callback));
         return newMap;
       });
     };
   }, []);
   ```

4. **Initialize event listeners in useEffect**
   ```javascript
   useEffect(() => {
     if (!contracts.predictionMarket || !provider) return;
     
     const cleanup = setupPriceEventListeners();
     
     return cleanup;
   }, [contracts.predictionMarket, provider, setupPriceEventListeners]);
   ```

5. **Export subscription function in context**
   ```javascript
   // Add to context value
   {
     // ... existing exports
     subscribeToPriceUpdates,
   }
   ```

---

### Phase 2: Replace Polling in `Web3TradingInterface.jsx`

**Location:** `TimelessPredect/frontend/src/components/trading/Web3TradingInterface.jsx`

**Current Code (Lines 170-201):**
- Polls every 30 seconds
- Calls `getCurrentPrice()` for both YES and NO

**Replace With:**

```javascript
// Import subscribeToPriceUpdates from useWeb3 hook
const { subscribeToPriceUpdates } = useWeb3();

// Replace the entire useEffect (lines 170-201)
useEffect(() => {
  if (!isConnected || !contracts.predictionMarket || !marketId) return;

  // Initial price fetch (only once)
  const fetchInitialPrices = async () => {
    try {
      const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
      const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
      
      const yesPriceCents = parseFloat(yesPrice.toString()) / 100;
      const noPriceCents = parseFloat(noPrice.toString()) / 100;
      
      setMarketData(prev => ({
        ...prev,
        yesPrice: yesPriceCents,
        noPrice: noPriceCents
      }));
    } catch (err) {
      console.error('Failed to fetch initial prices:', err.message);
    }
  };

  // Subscribe to real-time price updates via events
  const unsubscribe = subscribeToPriceUpdates(marketId, ({ yesPrice, noPrice }) => {
    console.log('🔄 Price updated via event:', { yesPrice, noPrice });
    setMarketData(prev => ({
      ...prev,
      yesPrice,
      noPrice
    }));
  });

  // Fetch initial prices
  fetchInitialPrices();

  // Fallback: Poll every 5 minutes as safety net (in case events miss)
  const fallbackInterval = setInterval(fetchInitialPrices, 300000);

  // Cleanup
  return () => {
    unsubscribe();
    clearInterval(fallbackInterval);
  };
}, [isConnected, contracts.predictionMarket, marketId, subscribeToPriceUpdates]);
```

**Changes:**
- ✅ Removed 30-second polling
- ✅ Added event subscription
- ✅ Kept initial fetch for current prices
- ✅ Added 5-minute fallback polling (safety net)
- ✅ Proper cleanup on unmount

---

### Phase 3: Alternative Approach - Direct Event Listeners per Component

**If you prefer not to use a global subscription system, you can add event listeners directly in each component:**

**For `Web3TradingInterface.jsx`:**

```javascript
useEffect(() => {
  if (!isConnected || !contracts.predictionMarket || !marketId) return;

  const contract = contracts.predictionMarket;
  const normalizedMarketId = ethers.BigNumber.from(marketId);

  // Initial price fetch
  const fetchInitialPrices = async () => {
    try {
      const yesPrice = await contract.getCurrentPrice(marketId, true);
      const noPrice = await contract.getCurrentPrice(marketId, false);
      
      const yesPriceCents = parseFloat(yesPrice.toString()) / 100;
      const noPriceCents = parseFloat(noPrice.toString()) / 100;
      
      setMarketData(prev => ({
        ...prev,
        yesPrice: yesPriceCents,
        noPrice: noPriceCents
      }));
    } catch (err) {
      console.error('Failed to fetch initial prices:', err.message);
    }
  };

  // Event handler for SharesPurchased
  const handleSharesPurchased = (eventMarketId, buyer, isYes, shares, cost, newPrice) => {
    // Only process events for this market
    if (!eventMarketId.eq(normalizedMarketId)) return;
    
    const priceCents = parseFloat(newPrice.toString()) / 100;
    const yesPrice = isYes ? priceCents : (100 - priceCents);
    const noPrice = isYes ? (100 - priceCents) : priceCents;
    
    console.log('📈 SharesPurchased - Price updated:', { yesPrice, noPrice });
    
    setMarketData(prev => ({
      ...prev,
      yesPrice,
      noPrice
    }));
  };

  // Event handler for SharesSold
  const handleSharesSold = (eventMarketId, seller, isYes, shares, payout, newPrice) => {
    // Only process events for this market
    if (!eventMarketId.eq(normalizedMarketId)) return;
    
    const priceCents = parseFloat(newPrice.toString()) / 100;
    const yesPrice = isYes ? priceCents : (100 - priceCents);
    const noPrice = isYes ? (100 - priceCents) : priceCents;
    
    console.log('📉 SharesSold - Price updated:', { yesPrice, noPrice });
    
    setMarketData(prev => ({
      ...prev,
      yesPrice,
      noPrice
    }));
  };

  // Filter events for this specific market only (more efficient)
  const purchaseFilter = contract.filters.SharesPurchased(marketId);
  const sellFilter = contract.filters.SharesSold(marketId);

  // Subscribe to filtered events
  contract.on(purchaseFilter, handleSharesPurchased);
  contract.on(sellFilter, handleSharesSold);

  // Fetch initial prices
  fetchInitialPrices();

  // Fallback polling every 5 minutes
  const fallbackInterval = setInterval(fetchInitialPrices, 300000);

  // Cleanup
  return () => {
    contract.off(purchaseFilter, handleSharesPurchased);
    contract.off(sellFilter, handleSharesSold);
    clearInterval(fallbackInterval);
  };
}, [isConnected, contracts.predictionMarket, marketId]);
```

**Benefits of Direct Approach:**
- ✅ Simpler - no global subscription system needed
- ✅ More efficient - filters events by marketId at provider level
- ✅ Self-contained - each component manages its own listeners
- ✅ Easier to debug - event handlers are visible in component

**Choose this approach if:** You want faster implementation without modifying `useWeb3.jsx`

---

### Phase 4: Update Other Components (Optional)

**For `MarketDetailWormStyle.jsx` and `PolymarketStyleTrading.jsx`:**

Follow the same pattern as Phase 3 (Direct Event Listeners) but adapt for each component's state management:

1. Find where prices are polled (search for `setInterval` and `getCurrentPrice`)
2. Replace with event listeners
3. Keep initial fetch
4. Add 5-minute fallback polling

---

## Event Data Conversion

### Understanding Price Format

**Contract returns prices in basis points:**
- `5000` = 50%
- `7500` = 75%
- `2500` = 25%

**Your UI uses cents/percentage:**
- `50` = 50%
- `75` = 75%
- `25` = 25%

**Conversion:**
```javascript
const priceCents = parseFloat(newPrice.toString()) / 100;
// newPrice = 5000 → priceCents = 50
// newPrice = 7500 → priceCents = 75
```

**Getting Both YES and NO Prices:**

If event has `isYes = true` and `newPrice = 6000`:
- YES price = `6000 / 100 = 60`
- NO price = `(10000 - 6000) / 100 = 40`

If event has `isYes = false` and `newPrice = 4000`:
- NO price = `4000 / 100 = 40`
- YES price = `(10000 - 4000) / 100 = 60`

**Code:**
```javascript
const priceCents = parseFloat(newPrice.toString()) / 100;
const yesPrice = isYes ? priceCents : (100 - priceCents);
const noPrice = isYes ? (100 - priceCents) : priceCents;
```

---

## Testing Checklist

### Before Implementation
- [ ] Document current polling intervals in each file
- [ ] Test current price updates work correctly
- [ ] Note any UI lag/delay when prices change

### After Implementation

#### Functional Testing
- [ ] Prices update instantly when you buy shares
- [ ] Prices update instantly when you sell shares
- [ ] Prices update when other users trade (test with multiple browser windows)
- [ ] Initial price fetch works on component mount
- [ ] Fallback polling still works (wait 5+ minutes, verify prices update)
- [ ] Event listeners clean up properly (check console for errors when navigating)

#### Edge Cases
- [ ] Works when switching between markets
- [ ] Works when wallet disconnects/reconnects
- [ ] Works when network switches
- [ ] Handles missing/null event data gracefully
- [ ] No memory leaks (event listeners removed on unmount)

#### Performance Testing
- [ ] Check browser console for duplicate event listeners
- [ ] Verify no excessive re-renders
- [ ] Check network tab - should see fewer RPC calls
- [ ] Monitor CPU usage during active trading

---

## Rollback Plan

If issues occur, revert by:

1. **Remove event listeners** (comment out or delete)
2. **Restore polling intervals** to original values:
   - `Web3TradingInterface.jsx`: 30 seconds
   - Other files: 60 seconds

**Quick Rollback Code:**
```javascript
// Revert to polling only
useEffect(() => {
  if (!isConnected || !contracts.predictionMarket || !marketId) return;

  const updatePrices = async () => {
    try {
      const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
      const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
      
      const yesPriceCents = parseFloat(yesPrice.toString()) / 100;
      const noPriceCents = parseFloat(noPrice.toString()) / 100;
      
      setMarketData(prev => ({
        ...prev,
        yesPrice: yesPriceCents,
        noPrice: noPriceCents
      }));
    } catch (err) {
      console.log('Failed to update prices:', err.message);
    }
  };

  const interval = setInterval(updatePrices, 30000); // Original 30s
  updatePrices();

  return () => clearInterval(interval);
}, [isConnected, contracts.predictionMarket, marketId]);
```

---

## Implementation Order (Recommended)

### Option A: Minimal Change (Fastest)
1. ✅ Implement Phase 3 (Direct Event Listeners) in `Web3TradingInterface.jsx` only
2. ✅ Test thoroughly
3. ✅ If successful, apply same pattern to other components

### Option B: Complete Implementation
1. ✅ Implement Phase 1 (Global subscription system in `useWeb3.jsx`)
2. ✅ Implement Phase 2 (Update `Web3TradingInterface.jsx` to use subscription)
3. ✅ Test thoroughly
4. ✅ Apply to other components (Phase 4)

**Recommendation:** Start with **Option A** (Phase 3) for one component, test it, then expand.

---

## Common Issues & Solutions

### Issue 1: Events Not Firing
**Symptoms:** Prices don't update in real-time

**Check:**
- Event listeners are properly subscribed (check console logs)
- Provider supports event subscriptions (test with `contract.once()`)
- Network/WebSocket connection is active
- Events are actually being emitted (check block explorer)

**Solution:**
- Verify contract address is correct
- Check provider type (WebSocketProvider vs JsonRpcProvider)
- Add more console logs to debug

### Issue 2: Price Calculation Wrong
**Symptoms:** YES/NO prices don't add up to 100

**Check:**
- Price conversion (basis points → cents)
- Logic for determining YES vs NO price from event

**Solution:**
```javascript
// Verify calculation
console.log('Event data:', { isYes, newPrice: newPrice.toString() });
console.log('Calculated prices:', { yesPrice, noPrice });
console.log('Sum:', yesPrice + noPrice); // Should be 100
```

### Issue 3: Memory Leaks
**Symptoms:** Browser slows down, multiple event handlers firing

**Check:**
- Event listeners removed in cleanup function
- Component doesn't remount repeatedly
- No duplicate subscriptions

**Solution:**
- Always return cleanup function from useEffect
- Use `contract.off()` to remove listeners
- Check React DevTools for component lifecycle

### Issue 4: Events Fire for Wrong Market
**Symptoms:** Price updates when viewing different market

**Check:**
- MarketId filtering in event handlers
- Normalized marketId comparison

**Solution:**
```javascript
// Always compare marketIds correctly
if (!eventMarketId.eq(normalizedMarketId)) return; // For BigNumber
// OR
if (eventMarketId.toString() !== marketId.toString()) return; // For strings
```

---

## Performance Considerations

### Event Listener Efficiency

**With Filters (Recommended):**
```javascript
const filter = contract.filters.SharesPurchased(marketId);
contract.on(filter, handler);
```
- ✅ Only receives events for specific market
- ✅ More efficient network usage
- ✅ Faster processing

**Without Filters:**
```javascript
contract.on('SharesPurchased', handler);
```
- ⚠️ Receives events for ALL markets
- ⚠️ Need to filter in handler
- ⚠️ More network traffic

### Provider Type Impact

| Provider Type | Event Speed | Setup Complexity |
|---------------|-------------|------------------|
| **MetaMask (window.ethereum)** | Fast (~1s) | Easy - works automatically |
| **JsonRpcProvider (HTTP)** | Slower (~4s polling) | Easy - but not true real-time |
| **WebSocketProvider** | Fastest (<1s) | Requires WSS_URL setup |

**Current Setup:** You're using direct RPC (`JsonRpcProvider`), so events will poll ~4 seconds internally, which is still better than 30-second manual polling.

---

## Next Steps After Implementation

1. **Monitor Performance**
   - Track RPC call reduction
   - Measure price update latency
   - Check for any errors in console

2. **Optimize Further**
   - Consider WebSocketProvider if available
   - Batch price updates if multiple markets visible
   - Cache event data to reduce re-fetches

3. **Extend to Other Data**
   - User positions (listen to SharesPurchased/SharesSold for current user)
   - Market volume (accumulate from events)
   - Trade history (build from events instead of polling)

---

## Summary

**Key Changes:**
- Replace 30-second polling with event listeners
- Use `SharesPurchased` and `SharesSold` events that include `newPrice`
- Keep initial price fetch on mount
- Add 5-minute fallback polling as safety net
- Filter events by marketId for efficiency

**Expected Results:**
- ✅ Instant price updates (no 30s delay)
- ✅ Reduced RPC calls (from ~120/hour to ~12/hour per component)
- ✅ Better user experience (real-time feedback)
- ✅ More scalable (works for many markets simultaneously)

---

## Questions or Issues?

If you encounter problems during implementation:

1. Check browser console for errors
2. Verify event listeners are subscribed (add console logs)
3. Test with a known trade transaction (watch block explorer)
4. Verify contract ABI includes event signatures
5. Check network/provider connectivity

Good luck with the implementation! 🚀

