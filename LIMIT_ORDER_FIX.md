# Limit Order Fix - Implementation

## Problem
The `Web3TradingInterface` component was trying to call `placeLimitOrder()` on the `ETHPredictionMarket` contract, but this function doesn't exist on that contract. The error was:
```
TypeError: contracts.predictionMarket.placeLimitOrder is not a function
```

## Solution
Updated `Web3TradingInterface` to use the **hybrid order system** (EIP-712 signing) instead of trying to call a non-existent contract function.

## Changes Made

### File: `frontend/src/components/trading/Web3TradingInterface.jsx`

1. **Added imports for EIP-712 utilities:**
   ```javascript
   import { 
     createOrderWithDefaults, 
     signOrder, 
     validateOrder, 
     centsToTicks 
   } from '../../utils/eip712';
   ```

2. **Added configuration constants:**
   ```javascript
   const EXCHANGE_CONTRACT = import.meta.env.VITE_EXCHANGE_CONTRACT_ADDRESS;
   const API_BASE = import.meta.env.VITE_API_BASE_URL;
   const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '1337', 10);
   ```

3. **Replaced contract call with EIP-712 signing:**
   - Old: `await placeLimitOrder(marketId, tradeSide === 'yes', parseFloat(limitPrice), tradeAmount);`
   - New: Creates EIP-712 order, signs it, and posts to `/api/orders`

4. **Updated to use `signer` from useWeb3 hook** (removed `placeLimitOrder` dependency)

## How It Works Now

When user places a limit order:

1. **Create order object** with user details, market, price, size
2. **Sign with EIP-712** using MetaMask (gasless!)
3. **Post to backend** at `/api/orders`
4. **Backend processes:**
   - Verifies signature
   - Adds to order book
   - Tries to match
   - Auto-settles if matched

## Required Environment Variables

Make sure these are set in your `.env` file:

```bash
VITE_EXCHANGE_CONTRACT_ADDRESS=0x...  # Exchange contract address
VITE_API_BASE_URL=http://localhost:8080
VITE_CHAIN_ID=1337
```

## Testing

1. Refresh the page
2. Connect wallet
3. Try placing a limit order
4. Should see MetaMask prompt for EIP-712 signature
5. Order should be placed successfully

## Notes

- **Gasless**: Limit orders are signed off-chain, no gas until matched
- **Automatic matching**: Backend matches orders every 5 seconds
- **On-chain settlement**: Only executes on-chain when orders match
- **Market orders**: Still use the AMM system (immediate execution)

