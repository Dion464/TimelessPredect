# How to Place a Limit Order at 42¢

## The Issue

You're seeing the price is **42¢** but the buy isn't happening. This is because:

- **"Market" order** = Executes immediately at current market price (no price control)
- **"Limit" order** = Set your own price, waits for match

## Solution: Switch to Limit Order

### Step 1: Select "Limit" Order Type

1. Look for **"Order Type"** section
2. Click the **"Limit"** button (not "Market")
3. This will show the price input field

### Step 2: Set Your Price

1. You'll see **"Limit Price (¢)"** input field
2. Enter **42** (or whatever price you want)
3. Or use the quick buttons:
   - **-5%** = 5% below market
   - **Market** = Current market price
   - **+5%** = 5% above market

### Step 3: Enter Amount

1. Enter amount in ETH (e.g., 0.1 ETH)
2. Click **"Place Limit Order"**

### Step 4: Sign EIP-712 Signature

1. MetaMask will prompt for signature
2. This is **gasless** - no gas until order matches!
3. Confirm the signature

### Step 5: Wait for Match

- Your order is now in the order book
- It will execute automatically when:
  - A sell order matches your buy price (≤ 42¢)
  - Or price drops to 42¢ or below

---

## Visual Guide

```
┌─────────────────────────────────┐
│ Order Type                      │
├─────────────────────────────────┤
│ [Market] [Limit]  ← Click Limit │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Limit Price (¢)                 │
├─────────────────────────────────┤
│ [ 42 ]  ← Enter your price here │
│ [-5%] [Market] [+5%]            │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Amount                           │
├─────────────────────────────────┤
│ [ 0.1 ] ETH                      │
└─────────────────────────────────┘

     [Place Limit Order]  ← Click
```

---

## Why Market Order Doesn't Let You Set Price

**Market Order:**
- Executes immediately
- Uses current AMM price
- No price control
- Best for: Quick trades at market price

**Limit Order:**
- Sets your price
- Waits for match
- More control
- Best for: Specific price targets

---

## Example

**Current Market Price:** 42¢

**If you want to buy at 42¢:**
1. Select **"Limit"**
2. Enter price: **42**
3. Enter amount: **0.1 ETH**
4. Click **"Place Limit Order"**
5. Order placed! Will execute when price is 42¢ or below

**If Market Order:**
- Executes immediately at current price (~42¢)
- No guarantee of exact price
- Uses AMM pricing

---

## Troubleshooting

### "Limit Price Input Not Showing"

**Fix:** Make sure you clicked the **"Limit"** button (should be blue/highlighted)

### "Order Not Executing"

**For Limit Orders:**
- Order waits for match
- If you set 42¢ and market is 42¢, it should match if there's a sell order
- If no sell orders, your buy order stays in the book until someone sells

### "Want Immediate Execution?"

**Use Market Order:**
- Select "Market" instead of "Limit"
- Executes immediately via AMM
- But no price control

---

## Quick Tips

1. **Always select "Limit"** if you want to set a specific price
2. **Price auto-fills** to current market when switching to Limit
3. **You can adjust** the price using the input field
4. **Orders are gasless** until they match
5. **Check "My Open Orders"** to see your placed orders

---

## Summary

✅ **To set price at 42¢:**
1. Click **"Limit"** button
2. Enter **42** in price field
3. Enter amount
4. Click **"Place Limit Order"**
5. Sign with MetaMask

❌ **Market order won't work** for setting specific prices - it executes immediately at market price.

