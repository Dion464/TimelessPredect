# 🔗 PolyDegen Blockchain Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Smart Contract Architecture](#smart-contract-architecture)
3. [Frontend-Blockchain Communication](#frontend-blockchain-communication)
4. [Trading System](#trading-system)
5. [Market Lifecycle](#market-lifecycle)
6. [Price Calculation (AMM)](#price-calculation-amm)
7. [Network Configuration](#network-configuration)
8. [Key Functions Reference](#key-functions-reference)

---

## Overview

PolyDegen is a decentralized prediction market platform built on EVM-compatible blockchains. Users can create markets, trade YES/NO shares, and earn rewards based on correct predictions.

### Technology Stack
- **Blockchain**: EVM-compatible (currently deployed on Incentiv Testnet - Chain ID: 28802)
- **Smart Contracts**: Solidity 0.8.19
- **Frontend**: React + Ethers.js v5
- **Wallet**: MetaMask integration
- **Pricing**: Automated Market Maker (AMM) with constant product formula

### Current Deployment
- **Network**: Incentiv Testnet
- **Chain ID**: 28802
- **RPC URL**: https://rpc-testnet.incentiv.io/
- **Contract Address**: `0xDe33759b16D40e49ab825B1faecac7bEBD62267D`
- **Native Currency**: ETH

---

## Smart Contract Architecture

### Main Contract: `PredictionMarket.sol`

The core smart contract that handles all prediction market operations.

#### Contract Inheritance
```solidity
contract PredictionMarket is ReentrancyGuard, Ownable, Pausable
```

- **ReentrancyGuard**: Prevents reentrancy attacks on financial functions
- **Ownable**: Admin controls for platform management
- **Pausable**: Emergency stop mechanism

#### Key Data Structures

##### 1. Market Struct
```solidity
struct Market {
    uint256 id;                      // Unique market identifier
    string questionTitle;            // Market question
    string description;              // Detailed description
    address creator;                 // Market creator address
    uint256 creationTime;            // When market was created
    uint256 resolutionTime;          // When market should be resolved
    uint256 finalResolutionTime;     // Final deadline for resolution
    bool isResolved;                 // Resolution status
    uint8 outcome;                   // 0=unresolved, 1=YES, 2=NO, 3=INVALID
    uint256 totalYesShares;          // Total YES shares in pool
    uint256 totalNoShares;           // Total NO shares in pool
    uint256 totalVolume;             // Total trading volume
    uint256 creatorFee;              // Creator fee in basis points
    bool isActive;                   // Market active status
    string category;                 // Market category
    address oracle;                  // Authorized resolver
}
```

##### 2. Position Struct
```solidity
struct Position {
    uint256 yesShares;      // User's YES shares
    uint256 noShares;       // User's NO shares
    uint256 totalInvested;  // Total amount invested
}
```

#### State Variables
```solidity
uint256 public nextMarketId = 1;           // Auto-incrementing market ID
uint256 public platformFee = 200;          // 2% platform fee (in basis points)
uint256 public constant MAX_FEE = 1000;    // 10% maximum fee cap

mapping(uint256 => Market) public markets;                           // All markets
mapping(uint256 => mapping(address => Position)) public positions;   // User positions
mapping(address => bool) public authorizedOracles;                   // Oracle whitelist
```

---

## Frontend-Blockchain Communication

### 1. Web3 Provider Setup (`useWeb3.jsx`)

The `useWeb3` hook is the central connection point between the frontend and blockchain.

#### Initialization Flow

```javascript
// 1. User clicks "Connect Wallet"
connectWallet()
  ↓
// 2. Check if MetaMask is installed
window.ethereum !== undefined
  ↓
// 3. Ensure correct network (Chain ID 28802)
addNetwork(CHAIN_ID)
  ↓
// 4. Request account access
window.ethereum.request({ method: 'eth_requestAccounts' })
  ↓
// 5. Create ethers provider and signer
new ethers.providers.Web3Provider(window.ethereum)
  ↓
// 6. Initialize contract instances
new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
  ↓
// 7. Update balances and state
updateEthBalance()
```

#### Contract Instance Creation

```javascript
// Create read-only provider (no wallet needed)
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Create read-only contract
const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  provider
);

// Create write-enabled contract (requires signer)
const contractWithSigner = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  signer  // From MetaMask
);
```

### 2. Reading Blockchain Data (No Gas Required)

#### Get Market Information
```javascript
// Frontend call
const market = await contracts.predictionMarket.getMarket(marketId);

// Returns:
{
  id: BigNumber,
  question: string,
  category: string,
  endTime: BigNumber (Unix timestamp),
  resolutionTime: BigNumber (Unix timestamp),
  resolved: boolean,
  outcome: number (0-3),
  totalYesShares: BigNumber,
  totalNoShares: BigNumber,
  totalVolume: BigNumber,
  creator: address,
  createdAt: BigNumber,
  active: boolean
}
```

#### Get Current Prices
```javascript
// Get YES price (returns basis points: 5000 = 50%)
const yesPriceBps = await contracts.predictionMarket.getCurrentPrice(marketId, true);
const yesPriceCents = yesPriceBps / 100;  // Convert to cents

// Get NO price
const noPriceBps = await contracts.predictionMarket.getCurrentPrice(marketId, false);
const noPriceCents = noPriceBps / 100;
```

#### Get User Position
```javascript
const position = await contracts.predictionMarket.getUserPosition(marketId, userAddress);

// Returns:
{
  yesShares: BigNumber,  // In wei (18 decimals)
  noShares: BigNumber,
  totalInvested: BigNumber
}

// Convert to readable format
const yesSharesFormatted = ethers.utils.formatEther(position.yesShares);
```

#### Get Active Markets
```javascript
const marketIds = await contracts.predictionMarket.getActiveMarkets();
// Returns: array of BigNumbers [1, 2, 3, ...]

// Convert to regular numbers
const ids = marketIds.map(id => Number(id.toString()));
```

### 3. Writing to Blockchain (Requires Gas)

All write operations require:
1. Connected wallet (MetaMask)
2. Sufficient ETH for gas fees
3. User approval of transaction

---

## Trading System

### Buy Shares Flow

```javascript
// Frontend Implementation
async function buyShares(marketId, isYes, ethAmount) {
  // 1. Convert ETH amount to wei
  const valueInWei = ethers.utils.parseEther(ethAmount.toString());
  
  // 2. Estimate gas (optional but recommended)
  const gasEstimate = await contract.estimateGas.buyShares(
    marketId,
    isYes,
    { value: valueInWei }
  );
  
  // 3. Send transaction
  const tx = await contract.buyShares(
    marketId,
    isYes,
    {
      value: valueInWei,
      gasLimit: gasEstimate.mul(120).div(100)  // Add 20% buffer
    }
  );
  
  // 4. Wait for confirmation
  const receipt = await tx.wait();
  
  // 5. Transaction confirmed!
  console.log('Transaction hash:', receipt.transactionHash);
}
```

#### Smart Contract Logic (buyShares)

```solidity
function buyShares(
    uint256 marketId,
    bool isYes,
    uint256 amount,
    uint256 minShares
) external payable {
    // 1. Validate inputs
    require(amount > 0, "Amount must be positive");
    require(block.timestamp < market.resolutionTime, "Market closed");
    
    // 2. Calculate shares using AMM formula
    uint256 shares = calculateSharesFromAmount(marketId, isYes, amount);
    require(shares >= minShares, "Slippage too high");
    
    // 3. Update market state
    if (isYes) {
        market.totalYesShares += shares;
    } else {
        market.totalNoShares += shares;
    }
    market.totalVolume += amount;
    
    // 4. Update user position
    Position storage position = positions[marketId][msg.sender];
    if (isYes) {
        position.yesShares += shares;
    } else {
        position.noShares += shares;
    }
    position.totalInvested += amount;
    
    // 5. Emit event
    emit SharesPurchased(marketId, msg.sender, isYes, shares, amount);
}
```

### Sell Shares Flow

```javascript
// Frontend Implementation
async function sellShares(marketId, isYes, sharesAmount) {
  // 1. Convert shares to wei
  const sharesInWei = ethers.utils.parseEther(sharesAmount.toString());
  
  // 2. Send transaction
  const tx = await contract.sellShares(
    marketId,
    isYes,
    sharesInWei,
    {
      gasLimit: 300000  // Fixed gas limit
    }
  );
  
  // 3. Wait for confirmation
  const receipt = await tx.wait();
  
  // 4. User receives ETH payout (minus fees)
}
```

#### Smart Contract Logic (sellShares)

```solidity
function sellShares(
    uint256 marketId,
    bool isYes,
    uint256 shares,
    uint256 minPayout
) external {
    // 1. Validate user has enough shares
    Position storage position = positions[marketId][msg.sender];
    if (isYes) {
        require(position.yesShares >= shares, "Insufficient YES shares");
    } else {
        require(position.noShares >= shares, "Insufficient NO shares");
    }
    
    // 2. Calculate payout using AMM formula
    uint256 payout = calculatePayoutFromShares(marketId, isYes, shares);
    require(payout >= minPayout, "Slippage too high");
    
    // 3. Update market state
    if (isYes) {
        market.totalYesShares -= shares;
        position.yesShares -= shares;
    } else {
        market.totalNoShares -= shares;
        position.noShares -= shares;
    }
    
    // 4. Calculate fees
    uint256 platformFeeAmount = (payout * platformFee) / 10000;  // 2%
    uint256 creatorFeeAmount = (payout * market.creatorFee) / 10000;
    uint256 userPayout = payout - platformFeeAmount - creatorFeeAmount;
    
    // 5. Transfer ETH to user
    payable(msg.sender).transfer(userPayout);
    
    // 6. Transfer creator fee
    if (creatorFeeAmount > 0) {
        payable(market.creator).transfer(creatorFeeAmount);
    }
    
    // 7. Emit event
    emit SharesSold(marketId, msg.sender, isYes, shares, userPayout);
}
```

---

## Price Calculation (AMM)

### Constant Product Formula

PolyDegen uses an Automated Market Maker (AMM) with a **constant product formula**, similar to Uniswap.

#### Formula: `x * y = k`

Where:
- `x` = YES pool size
- `y` = NO pool size
- `k` = constant product

#### Calculate Shares from ETH Amount

```solidity
function calculateSharesFromAmount(
    uint256 marketId,
    bool isYes,
    uint256 amount
) public view returns (uint256 shares) {
    Market storage market = markets[marketId];
    
    // Add liquidity buffer to prevent division by zero
    uint256 yesPool = market.totalYesShares + 1000 ether;
    uint256 noPool = market.totalNoShares + 1000 ether;
    uint256 k = yesPool * noPool;
    
    if (isYes) {
        // Buying YES: add amount to YES pool
        uint256 newYesPool = yesPool + amount;
        uint256 newNoPool = k / newYesPool;
        shares = noPool - newNoPool;  // Shares received
    } else {
        // Buying NO: add amount to NO pool
        uint256 newNoPool = noPool + amount;
        uint256 newYesPool = k / newNoPool;
        shares = yesPool - newYesPool;  // Shares received
    }
}
```

#### Example Calculation

Initial state:
- YES pool: 1000 ETH
- NO pool: 1000 ETH
- k = 1,000,000

User buys 100 ETH of YES:
```
newYesPool = 1000 + 100 = 1100
newNoPool = 1,000,000 / 1100 = 909.09
shares = 1000 - 909.09 = 90.91 shares
```

New YES price:
```
price = noPool / (yesPool + noPool)
price = 909.09 / (1100 + 909.09) = 45.2%
```

#### Get Current Price

```solidity
function getCurrentPrice(uint256 marketId) external view returns (uint256 price) {
    Market storage market = markets[marketId];
    uint256 yesPool = market.totalYesShares + 1000 ether;
    uint256 noPool = market.totalNoShares + 1000 ether;
    
    // Price = noPool / (yesPool + noPool)
    // Returned in basis points (5000 = 50%)
    price = (noPool * 1000000) / (yesPool + noPool);
}
```

### Price Impact

Larger trades have more price impact due to the AMM formula:

| Trade Size | Price Impact |
|------------|--------------|
| 1 ETH      | ~0.1%        |
| 10 ETH     | ~1%          |
| 100 ETH    | ~9%          |
| 1000 ETH   | ~45%         |

---

## Market Lifecycle

### 1. Market Creation

```javascript
// Frontend call
async function createMarket(question, description, category, endTime, resolutionTime) {
  // Get creation fee
  const fee = await contract.marketCreationFee();  // e.g., 0.01 ETH
  
  // Send transaction with fee
  const tx = await contract.createMarket(
    question,
    description,
    category,
    endTime,      // Unix timestamp
    resolutionTime, // Unix timestamp
    {
      value: fee,
      gasLimit: 2000000
    }
  );
  
  const receipt = await tx.wait();
  
  // Extract market ID from event
  const event = receipt.events.find(e => e.event === 'MarketCreated');
  const marketId = event.args.marketId.toNumber();
  
  return marketId;
}
```

#### Smart Contract Logic

```solidity
function createMarket(
    string memory questionTitle,
    string memory description,
    uint256 resolutionTime,
    uint256 finalResolutionTime,
    uint256 creatorFee,
    string memory category,
    address oracle
) external payable returns (uint256) {
    // Validate inputs
    require(resolutionTime > block.timestamp, "Resolution time must be in future");
    require(finalResolutionTime > resolutionTime, "Final resolution must be after resolution");
    require(creatorFee <= MAX_FEE, "Creator fee too high");
    require(msg.value >= marketCreationFee, "Insufficient creation fee");
    
    // Create market
    uint256 marketId = nextMarketId++;
    markets[marketId] = Market({
        id: marketId,
        questionTitle: questionTitle,
        description: description,
        creator: msg.sender,
        creationTime: block.timestamp,
        resolutionTime: resolutionTime,
        finalResolutionTime: finalResolutionTime,
        isResolved: false,
        outcome: 0,
        totalYesShares: 0,
        totalNoShares: 0,
        totalVolume: 0,
        creatorFee: creatorFee,
        isActive: true,
        category: category,
        oracle: oracle
    });
    
    emit MarketCreated(marketId, msg.sender, questionTitle, resolutionTime);
    return marketId;
}
```

### 2. Trading Period

- Users can buy/sell shares
- Prices adjust based on AMM formula
- Market is active until `endTime`

### 3. Market Resolution

```javascript
// Admin/Oracle resolves market
async function resolveMarket(marketId, outcome) {
  // outcome: 1 = YES, 2 = NO, 3 = INVALID
  const tx = await contract.resolveMarket(marketId, outcome);
  await tx.wait();
}
```

#### Smart Contract Logic

```solidity
function resolveMarket(
    uint256 marketId,
    uint8 outcome
) external onlyOracle(marketId) {
    require(outcome >= 1 && outcome <= 3, "Invalid outcome");
    require(block.timestamp >= markets[marketId].resolutionTime, "Too early to resolve");
    
    Market storage market = markets[marketId];
    market.isResolved = true;
    market.outcome = outcome;
    
    emit MarketResolved(marketId, outcome, msg.sender);
}
```

### 4. Claim Winnings

```javascript
// User claims winnings after resolution
async function claimWinnings(marketId) {
  const tx = await contract.claimWinnings(marketId);
  await tx.wait();
  // User receives ETH payout
}
```
f
#### Smart Contract Logic

```solidity
function claimWinnings(uint256 marketId) external nonReentrant {
    Market storage market = markets[marketId];
    require(market.isResolved, "Market not resolved");
    
    Position storage position = positions[marketId][msg.sender];
    require(position.yesShares > 0 || position.noShares > 0, "No position to claim");
    
    uint256 payout = 0;
    
    if (market.outcome == 1) {
        // YES won - payout YES shares 1:1
        payout = position.yesShares;
    } else if (market.outcome == 2) {
        // NO won - payout NO shares 1:1
        payout = position.noShares;
    } else if (market.outcome == 3) {
        // INVALID - refund proportionally
        uint256 totalShares = market.totalYesShares + market.totalNoShares;
        if (totalShares > 0) {
            uint256 userShares = position.yesShares + position.noShares;
            payout = (market.totalVolume * userShares) / totalShares;
        }
    }
    
    // Clear position
    position.yesShares = 0;
    position.noShares = 0;
    
    // Transfer payout
    if (payout > 0) {
        payable(msg.sender).transfer(payout);
    }
}
```

---

## Network Configuration

### Environment Variables (`.env`)

```bash
# Blockchain Configuration
VITE_RPC_URL=https://rpc-testnet.incentiv.io/
VITE_CHAIN_ID=28802
VITE_NETWORK_NAME=Incentiv Testnet
VITE_CONTRACT_ADDRESS=0xDe33759b16D40e49ab825B1faecac7bEBD62267D

# Market Settings
VITE_MARKET_CREATION_FEE=0.01
VITE_PLATFORM_FEE_BPS=200

# API Configuration
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080

# Admin (for deployment)
PRIVATE_KEY=your_private_key_here
```

### Network Switching

The app automatically prompts users to switch to the correct network:

```javascript
async function addNetwork(targetChainId) {
  try {
    // Try to switch to network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${targetChainId.toString(16)}` }],
    });
  } catch (switchError) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${targetChainId.toString(16)}`,
          chainName: 'Incentiv Testnet',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://rpc-testnet.incentiv.io/'],
        }],
      });
    }
  }
}
```

---

## Key Functions Reference

### Read Functions (No Gas)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `getMarket` | `uint256 marketId` | `Market` | Get market details |
| `getCurrentPrice` | `uint256 marketId, bool isYes` | `uint256` | Get current price in basis points |
| `getUserPosition` | `uint256 marketId, address user` | `(uint256, uint256, uint256)` | Get user's position |
| `getActiveMarkets` | - | `uint256[]` | Get all active market IDs |
| `calculateSharesFromAmount` | `uint256 marketId, bool isYes, uint256 amount` | `uint256` | Preview shares for ETH amount |

### Write Functions (Requires Gas)

| Function | Parameters | Gas Estimate | Description |
|----------|-----------|--------------|-------------|
| `createMarket` | `string question, string description, string category, uint256 endTime, uint256 resolutionTime` | ~2,000,000 | Create new market |
| `buyShares` | `uint256 marketId, bool isYes` | ~500,000 | Buy shares with ETH |
| `sellShares` | `uint256 marketId, bool isYes, uint256 shares` | ~300,000 | Sell shares for ETH |
| `resolveMarket` | `uint256 marketId, uint8 outcome` | ~100,000 | Resolve market (admin only) |
| `claimWinnings` | `uint256 marketId` | ~200,000 | Claim winnings after resolution |

### Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `MarketCreated` | `uint256 marketId, address creator, string question, uint256 resolutionTime` | Emitted when market is created |
| `SharesPurchased` | `uint256 marketId, address buyer, bool isYes, uint256 shares, uint256 cost` | Emitted when shares are bought |
| `SharesSold` | `uint256 marketId, address seller, bool isYes, uint256 shares, uint256 payout` | Emitted when shares are sold |
| `MarketResolved` | `uint256 marketId, uint8 outcome, address oracle` | Emitted when market is resolved |

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Market does not exist" | Invalid market ID | Check market ID is correct |
| "Market closed for trading" | Past end time | Cannot trade after market ends |
| "Insufficient YES/NO shares" | Trying to sell more than owned | Check user position first |
| "Slippage too high" | Price moved during transaction | Increase slippage tolerance |
| "Not authorized oracle" | Non-admin trying to resolve | Only authorized addresses can resolve |
| "Market already resolved" | Trying to trade in resolved market | Check market status first |

### Gas Optimization

1. **Use gas estimation**: Always estimate gas before transactions
2. **Add buffer**: Add 20% to gas estimates for safety
3. **Fallback to fixed gas**: If estimation fails, use fixed limits
4. **Batch operations**: Combine multiple reads into single calls when possible

---

## Security Features

### Smart Contract Security

1. **ReentrancyGuard**: Prevents reentrancy attacks on financial functions
2. **Pausable**: Emergency stop mechanism for critical bugs
3. **Access Control**: Only authorized oracles can resolve markets
4. **Slippage Protection**: Users set minimum shares/payout to prevent front-running
5. **Fee Caps**: Maximum 10% fee limit to protect users

### Frontend Security

1. **Input Validation**: All user inputs are validated before blockchain calls
2. **Transaction Confirmation**: Users must approve all transactions in MetaMask
3. **Error Handling**: Comprehensive error handling with user-friendly messages
4. **Retry Logic**: Automatic retries for failed RPC calls
5. **Balance Checks**: Verify sufficient balance before transactions

---

## Deployment Process

### 1. Compile Contracts

```bash
cd contracts
npx hardhat compile
```

### 2. Deploy to Network

```bash
# Deploy to Incentiv Testnet
npx hardhat run scripts/deploy-eth.js --network incentiv

# Output:
# ✅ PredictionMarket deployed to: 0xDe33759b16D40e49ab825B1faecac7bEBD62267D
```

### 3. Update Frontend Configuration

Update `frontend/.env`:
```bash
VITE_CONTRACT_ADDRESS=0xDe33759b16D40e49ab825B1faecac7bEBD62267D
```

### 4. Verify Contract (Optional)

```bash
npx hardhat verify --network incentiv 0xDe33759b16D40e49ab825B1faecac7bEBD62267D
```

---

## Testing

### Local Testing with Hardhat

```bash
# Start local blockchain
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy-eth.js --network localhost

# Run tests
npx hardhat test
```

### Frontend Testing

```bash
cd frontend
npm start

# Connect to local Hardhat network:
# - Network: Localhost
# - RPC URL: http://localhost:8545
# - Chain ID: 1337
```

---

## Performance Optimization

### 1. Caching

- Cache market data in frontend state
- Use React Query for automatic caching
- Store price history in PostgreSQL database

### 2. Batch Requests

```javascript
// Instead of multiple calls:
const market1 = await contract.getMarket(1);
const market2 = await contract.getMarket(2);

// Use Promise.all:
const [market1, market2] = await Promise.all([
  contract.getMarket(1),
  contract.getMarket(2)
]);
```

### 3. WebSocket Events

Listen for blockchain events in real-time:

```javascript
contract.on('SharesPurchased', (marketId, buyer, isYes, shares, cost) => {
  console.log('New trade:', { marketId, buyer, shares });
  // Update UI automatically
});
```

---

## Troubleshooting

### MetaMask Issues

**Problem**: "MetaMask circuit breaker is open"
**Solution**: Reset MetaMask or wait 30 seconds

**Problem**: "Wrong network"
**Solution**: App will prompt to switch networks automatically

### Transaction Failures

**Problem**: "Transaction failed"
**Solution**: Check gas limit, ensure sufficient ETH balance

**Problem**: "Nonce too low"
**Solution**: Reset MetaMask account or wait for pending transactions

### RPC Issues

**Problem**: "Failed to fetch"
**Solution**: Check RPC_URL is correct and accessible

---

## Future Improvements

### Planned Features

1. **Layer 2 Scaling**: Deploy to Arbitrum/Optimism for lower fees
2. **Order Book**: Add limit orders for better price discovery
3. **Liquidity Mining**: Reward liquidity providers
4. **Cross-Chain**: Bridge to multiple chains
5. **Oracle Integration**: Chainlink integration for automated resolution

### Contract Upgrades

The contracts are **not upgradeable** by design for security. Any changes require:
1. Deploy new contract
2. Migrate liquidity
3. Update frontend configuration

---

## Support & Resources

- **Documentation**: This file
- **Smart Contracts**: `/contracts/contracts/`
- **Frontend Integration**: `/frontend/src/hooks/useWeb3.jsx`
- **Deployment Scripts**: `/contracts/scripts/`
- **Test Suite**: `/contracts/test/`

---

**Last Updated**: November 21, 2024
**Contract Version**: 1.0.0
**Network**: Incentiv Testnet (Chain ID: 28802)

