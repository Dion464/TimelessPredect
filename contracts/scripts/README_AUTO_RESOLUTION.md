# 🎲 Automated Random Winner Resolution System

## Overview
This system automatically resolves prediction markets every **1.5 minutes (90 seconds)** with a random outcome, allowing users to quickly see results and claim winnings.

## How It Works

### 1. **Smart Contract Function: `autoResolveMarket`**
```solidity
function autoResolveMarket(uint256 _marketId) external nonReentrant
```

- **Random Outcome Generation**: Uses blockchain data (timestamp, prevrandao, market data) to generate a pseudo-random outcome
- **50/50 Chance**: Each market has an equal chance of resolving to YES or NO
- **Only Owner**: Can only be called by the contract owner (automated service)
- **One-Time Resolution**: Markets can only be resolved once

### 2. **Automated Service** (`auto-resolve-service.js`)

The service runs continuously and:
- **Checks every 1.5 minutes** for markets ready to resolve
- **Waits 90 seconds** after market creation before resolving
- **Randomly picks** YES or NO winner
- **Logs all activity** for transparency

### 3. **Winner Distribution**

When a market is resolved:
- **YES Winners**: Users holding YES shares can claim their winnings if YES won
- **NO Winners**: Users holding NO shares can claim their winnings if NO won
- **Payout Calculation**: Winners get their share of the total pool proportional to their holdings
- **2% Platform Fee**: Applied on payouts

## Running the Service

### Start the Auto-Resolution Service:
```bash
cd /Users/zs/Desktop/prediction-market/socialpredict/contracts
npx hardhat run scripts/auto-resolve-service.js --network localhost
```

### Service Output Example:
```
🎲 Starting Automated Random Winner Resolution Service...
⏱️  Resolution interval: 90 seconds (1.5 minutes)
Service running with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

⏰ [1:30:00 PM] Checking for markets to resolve...
   Found 5 active market(s)
   
   🎲 Resolving Market 1: "Will Bitcoin reach $100k by 2025?"
      Market age: 1 minutes 32 seconds
      Total YES shares: 10.5
      Total NO shares: 8.3
      Total volume: 18.8 ETH
      Transaction sent: 0x1234...
      ✅ Transaction confirmed!
      🎉 Random Winner: YES!
      YES holders can now claim their winnings!
```

## Claiming Winnings

### Frontend Integration:
Users can claim their winnings through the frontend:
1. **Automatic Detection**: System detects if user has winning shares
2. **Claim Button**: Appears on resolved markets
3. **One-Click Claim**: Users click to claim their ETH winnings

### Smart Contract Function:
```solidity
function claimWinnings(uint256 _marketId) external nonReentrant
```

## Configuration

### Adjust Resolution Interval:
Edit `auto-resolve-service.js`:
```javascript
const RESOLUTION_INTERVAL = 90000; // Change this (in milliseconds)
// 60000 = 1 minute
// 90000 = 1.5 minutes (current)
// 120000 = 2 minutes
```

### Market Age Requirement:
Edit the service check:
```javascript
if (marketAge >= 90) { // Change this (in seconds)
  // Resolve market
}
```

## Security Features

1. **Owner-Only Resolution**: Only the contract owner can trigger auto-resolution
2. **One-Time Resolution**: Markets can't be resolved twice
3. **Pseudo-Random**: Uses multiple blockchain parameters for randomness
4. **Non-Reentrant**: Protected against reentrancy attacks
5. **Balance Checks**: Ensures contract has funds before payouts

## Testing

### Test Manual Resolution:
```bash
cd /Users/zs/Desktop/prediction-market/socialpredict/contracts
npx hardhat run scripts/test-resolution.js --network localhost
```

### Monitor Service:
The service logs all activities in real-time. Watch the console for:
- Market checks
- Resolution attempts
- Success/failure messages
- Winner announcements

## Stopping the Service

Press `Ctrl+C` in the terminal running the service.

## Production Deployment

⚠️ **Important**: For production:
1. Use **Chainlink VRF** for true randomness
2. Implement **time-lock mechanisms**
3. Add **multi-signature** for owner functions
4. Set up **monitoring and alerts**
5. Use **proper key management**

## Benefits

- ✅ **Fast Results**: Markets resolve every 1.5 minutes
- ✅ **Fair Outcomes**: 50/50 random selection
- ✅ **Automated**: No manual intervention needed
- ✅ **Transparent**: All resolutions logged on-chain
- ✅ **User-Friendly**: Simple claim process

## Example Flow

1. **User buys shares** in a market (YES or NO)
2. **System waits** 1.5 minutes
3. **Service auto-resolves** with random outcome
4. **Winner is announced** (YES or NO)
5. **Users claim winnings** through the frontend
6. **New markets created** automatically

---

🎉 **The system is now running! Markets will auto-resolve every 1.5 minutes with random winners!**

