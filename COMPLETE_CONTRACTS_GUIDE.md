# Complete Contracts Guide: Architecture, Communication & Frontend Integration

**Date**: 2025-10-29  
**Network**: Hardhat Local (Chain ID: 1337)

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Contract Architecture](#contract-architecture)
3. [Individual Contracts Explained](#individual-contracts-explained)
4. [How Contracts Communicate](#how-contracts-communicate)
5. [Frontend Integration](#frontend-integration)
6. [Complete Data Flow](#complete-data-flow)
7. [Event System](#event-system)
8. [Security Features](#security-features)

---

## 🎯 Overview

This prediction market system consists of **3 main smart contracts** that work together to create, price, and resolve prediction markets. The frontend communicates with these contracts using **Web3.js (ethers.js)** through **ABI (Application Binary Interface)** files.

### System Components:
1. **ETHPredictionMarket.sol** - Main market contract (ETH-based)
2. **PricingAMM.sol** - Automated Market Maker for dynamic pricing
3. **MockUSDC.sol** - Mock token for testing (not actively used with ETH markets)
4. **Legacy Contracts** - PredictionMarket.sol, PredictionOracle.sol (older versions)

---

## 🏗️ Contract Architecture

### Deployment Hierarchy

```
ETHPredictionMarket (Main Contract)
    │
    ├── Deploys & Owns →
    │
    └── PricingAMM (Deployed by ETHPredictionMarket)
        │
        └── Stores pricing logic & market state
```

**Key Points:**
- `ETHPredictionMarket` is the **entry point** for all operations
- `PricingAMM` is **created inside** `ETHPredictionMarket` constructor
- `PricingAMM` is a **separate contract** with its own address
- Frontend only directly interacts with `ETHPredictionMarket`
- `ETHPredictionMarket` internally calls `PricingAMM` for prices

---

## 📋 Individual Contracts Explained

### 1. ETHPredictionMarket.sol (Main Contract)

**Address**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`  
**Purpose**: Core prediction market functionality

#### What It Does:

**1. Market Creation**
- Allows admins to create new prediction markets
- Requires 0.01 ETH fee to create a market
- Sets market end time and resolution time
- Initializes market with starting prices (50/50)

**2. Trading**
- Buy YES or NO shares with ETH
- Sell YES or NO shares for ETH
- Tracks user positions and balances
- Updates market volume and statistics

**3. Optimistic Oracle Resolution**
- Allows anyone to propose a winner (with 0.01 ETH bond)
- Allows disputes (with 0.02 ETH bond, 2x proposer bond)
- Finalizes resolution after dispute period (24 hours)
- Distributes winnings to holders

**4. Fee Management**
- Collects 2% platform fee on all trades
- Stores market creation fees
- Platform can collect accumulated fees

**5. Market Management**
- Tracks active markets list
- Marks markets as resolved/inactive
- Stores market metadata (question, description, category)

#### Key Data Structures:

```solidity
struct Market {
    uint256 id;
    string question;
    string description;
    string category;
    uint256 endTime;           // When trading stops
    uint256 resolutionTime;    // When resolution opens
    bool resolved;
    uint8 outcome;             // 0=none, 1=YES, 2=NO, 3=INVALID
    uint256 totalYesShares;    // Total YES shares in circulation
    uint256 totalNoShares;     // Total NO shares in circulation
    uint256 totalVolume;       // Total ETH traded
    address creator;
    uint256 createdAt;
    bool active;
    // Polymarket-style pricing fields
    uint256 lastTradedPrice;
    uint256 yesBidPrice;
    uint256 yesAskPrice;
    uint256 noBidPrice;
    uint256 noAskPrice;
}

struct Position {
    uint256 yesShares;      // User's YES shares
    uint256 noShares;       // User's NO shares
    uint256 totalInvested;  // Total ETH invested by user
}

struct ResolutionProposal {
    uint8 proposedOutcome;   // 1=YES, 2=NO, 3=INVALID
    address proposer;
    uint256 proposalTime;
    uint256 proposerBond;    // Bond posted (0.01 ETH)
    bool disputed;
    address disputer;
    uint256 disputeTime;
    uint256 disputerBond;
    bool finalized;
}
```

#### Key Functions:

| Function | Purpose | Inputs | Returns |
|----------|---------|--------|---------|
| `createMarket()` | Create new market | question, description, category, endTime, resolutionTime | marketId |
| `buyShares()` | Buy YES/NO shares | marketId, isYes | shares received |
| `sellShares()` | Sell YES/NO shares | marketId, isYes, shares | ETH payout |
| `getMarket()` | Get market data | marketId | Market struct |
| `getActiveMarkets()` | Get all active markets | none | uint256[] market IDs |
| `getCurrentPrice()` | Get current price | marketId, isYes | price in basis points |
| `proposeResolution()` | Propose winner | marketId, outcome | none |
| `disputeResolution()` | Dispute proposal | marketId | none |
| `finalizeResolution()` | Finalize resolution | marketId | none |

---

### 2. PricingAMM.sol (Automated Market Maker)

**Address**: `0x8F8E2D72D4Be91Fc98ac088f90A28e2a5c30b742`  
**Purpose**: Calculate dynamic prices using LMSR (Logarithmic Market Scoring Rule)

#### What It Does:

**1. Price Calculation**
- Uses **LMSR formula** to calculate YES/NO prices
- Prices change dynamically based on shares bought/sold
- Ensures prices always sum to 100% (10,000 basis points)
- Prevents extreme prices (clamps to 1%-99%)

**2. Market State Management**
- Stores YES shares, NO shares, and liquidity per market
- Updates state when trades occur
- Maintains initial liquidity (1 ETH per market)

**3. Price Impact Control**
- Uses **B_PARAM = 10 ETH** for smooth price movements
- Similar to Polymarket's price impact behavior
- Small trades (< 0.1 ETH) = ~0.5-1% price movement
- Large trades (1 ETH) = ~5-10% price movement

#### LMSR Formula:

```
Price_YES = e^(q_YES/b) / (e^(q_YES/b) + e^(q_NO/b))
Price_NO = e^(q_NO/b) / (e^(q_YES/b) + e^(q_NO/b))

Where:
- q_YES = Total YES shares outstanding
- q_NO = Total NO shares outstanding  
- b = Liquidity parameter (10 ETH)
- e = Euler's number (approximated)
```

**Price Clamping:**
- Minimum price: 100 basis points (1%)
- Maximum price: 9,900 basis points (99%)
- Prevents markets from becoming untradeable

#### Key Data Structures:

```solidity
struct Market {
    uint256 yesShares;    // Total YES shares
    uint256 noShares;     // Total NO shares
    uint256 liquidity;    // Total ETH in pool
    uint256 b;            // Liquidity parameter (10 ETH)
}
```

#### Key Functions:

| Function | Purpose | Called By |
|----------|---------|-----------|
| `createMarket()` | Initialize market | ETHPredictionMarket |
| `calculatePrice()` | Get current prices | ETHPredictionMarket |
| `updateMarketState()` | Update share counts | ETHPredictionMarket |
| `calculateSharesToGive()` | Calculate shares for ETH amount | Internal |

---

### 3. MockUSDC.sol (Testing Token)

**Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`  
**Purpose**: Mock ERC20 token for testing (not used in ETH-based markets)

#### What It Does:

- Standard ERC20 token with 6 decimals (like real USDC)
- Provides `faucet()` function for free tokens (testing)
- Can mint unlimited tokens for testing
- Used in legacy `PredictionMarket.sol` (USDC-based markets)

**Note**: This contract is **NOT actively used** with `ETHPredictionMarket`. It's deployed but not integrated.

---

## 🔄 How Contracts Communicate

### Internal Communication Flow

#### 1. Market Creation Flow

```
Frontend User
    ↓
ETHPredictionMarket.createMarket()
    ├── Validates inputs (endTime, fees)
    ├── Creates Market struct
    ├── Adds to activeMarketIds[]
    └── Calls → PricingAMM.createMarket()
        └── Initializes market with:
            - yesShares = 0
            - noShares = 0
            - liquidity = 1 ETH
            - b = 10 ETH
```

#### 2. Buy Shares Flow

```
Frontend User (0.1 ETH) → ETHPredictionMarket.buyShares()
    ↓
[Step 1] Update PricingAMM state
    └── pricingAMM.updateMarketState(marketId, totalYesShares, totalNoShares)
    
[Step 2] Calculate price
    └── pricingAMM.calculatePrice(marketId)
        └── Returns: (yesPrice, noPrice) in basis points
    
[Step 3] Calculate shares
    └── shares = (investmentAmount * 10000) / currentPrice
    
[Step 4] Update market state
    ├── market.totalYesShares += shares
    ├── market.totalVolume += msg.value
    └── Update user position
    
[Step 5] Update PricingAMM again (for next trade)
    └── pricingAMM.updateMarketState(marketId, newYesShares, newNoShares)
```

#### 3. Sell Shares Flow

```
Frontend User (sell 100 shares) → ETHPredictionMarket.sellShares()
    ↓
[Step 1] Get current price
    └── pricingAMM.calculatePrice(marketId)
    
[Step 2] Calculate payout
    └── payout = (shares * currentPrice) / 10000
    └── Apply 2% fee: userPayout = payout * 0.98
    
[Step 3] Update market state
    ├── market.totalYesShares -= shares
    ├── market.totalVolume += payout
    └── Update user position
    
[Step 4] Update PricingAMM
    └── pricingAMM.updateMarketState(marketId, newYesShares, newNoShares)
    
[Step 5] Send ETH to user
    └── payable(msg.sender).transfer(userPayout)
```

#### 4. Price Calculation Flow

```
ETHPredictionMarket needs price
    ↓
calls: pricingAMM.calculatePrice(marketId)
    ↓
PricingAMM reads market state:
    ├── yesShares
    ├── noShares
    └── liquidity
    ↓
Applies LMSR formula:
    ├── Calculate exp(q_YES/b)
    ├── Calculate exp(q_NO/b)
    ├── Calculate sum = exp_YES + exp_NO
    ├── yesPrice = (exp_YES * 10000) / sum
    └── noPrice = (exp_NO * 10000) / sum
    ↓
Clamp prices to [100, 9900] basis points
    ↓
Return (yesPrice, noPrice)
```

---

## 🖥️ Frontend Integration

### Connection Chain

```
Browser (React App)
    ↓
MetaMask Wallet Extension
    ↓ (JSON-RPC)
Hardhat Node (localhost:8545)
    ↓ (Ethereum Protocol)
ETHPredictionMarket Contract
    ↓ (Internal Call)
PricingAMM Contract
```

### Frontend Files Involved

#### 1. Contract Configuration

**File**: `frontend/src/contracts/config.js`
```javascript
export const PREDICTION_MARKET_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const CHAIN_ID = 1337;
```

**File**: `frontend/src/contracts/eth-config.js`
```javascript
export const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const CONTRACT_ABI = [ /* all function signatures */ ];
```

#### 2. Web3 Hook (Main Connection)

**File**: `frontend/src/hooks/useWeb3.jsx`

**What It Does:**

**Step 1: Wallet Connection**
```javascript
connectWallet() 
    → window.ethereum.request({ method: 'eth_requestAccounts' })
    → Creates provider: new ethers.providers.Web3Provider(window.ethereum)
    → Creates signer: provider.getSigner()
```

**Step 2: Initialize Contracts**
```javascript
initializeContracts(web3Signer)
    → Gets contract address from config.js
    → Creates contract instance:
        new ethers.Contract(
            address,
            ABI,
            signer
        )
    → Gets PricingAMM address: contract.pricingAMM()
    → Creates PricingAMM contract instance (optional)
```

**Step 3: Provide to React Components**
```javascript
<Web3Provider>
    {children}
</Web3Provider>

// Components can use:
const { contracts, buyShares, sellShares } = useWeb3();
```

### Frontend → Contract Communication

#### Example: Creating a Market

```javascript
// In MarketCreation.jsx
const { createMarket } = useWeb3();

const handleSubmit = async () => {
    // 1. Prepare data
    const endTime = Math.floor(endDate.getTime() / 1000);
    const resolutionTime = Math.floor(resolutionDate.getTime() / 1000);
    const fee = ethers.utils.parseEther("0.01");
    
    // 2. Call contract function
    const tx = await createMarket(
        question,
        description,
        category,
        endTime,
        resolutionTime,
        { value: fee }  // Send ETH with transaction
    );
    
    // 3. Wait for confirmation
    await tx.wait();
    
    // 4. Transaction is confirmed on blockchain
};
```

**What Happens Behind the Scenes:**

1. **Frontend**: `createMarket(...)` called
2. **useWeb3.jsx**: Wraps call in `contracts.predictionMarket.createMarket(...)`
3. **ethers.js**: Encodes function call + parameters into `data` field
4. **MetaMask**: User approves transaction
5. **Hardhat Node**: Executes transaction
6. **Contract**: Executes Solidity code, creates market
7. **Contract**: Emits `MarketCreated` event
8. **Frontend**: Transaction receipt returned
9. **Frontend**: Can listen for events or refresh data

#### Example: Buying Shares

```javascript
// In Web3TradingInterface.jsx
const { buyShares } = useWeb3();

const handleBuy = async () => {
    const amount = ethers.utils.parseEther("0.1");
    
    // Call contract
    const tx = await buyShares(marketId, true, { value: amount });
    await tx.wait();
    
    // Price updated on blockchain, frontend can refresh
};
```

**What Happens Inside the Contract:**

```
buyShares(marketId, true, { value: 0.1 ETH })
    ↓
ETHPredictionMarket.buyShares()
    ├── Checks: market active? not resolved? before endTime?
    ├── Calls: pricingAMM.updateMarketState()
    ├── Calls: pricingAMM.calculatePrice()
    ├── Calculates: shares = (0.1 ETH * 10000) / currentPrice
    ├── Updates: market.totalYesShares += shares
    ├── Updates: user position.yesShares += shares
    ├── Calls: pricingAMM.updateMarketState() again
    └── Emits: SharesPurchased event
```

### Contract → Frontend Communication

#### Event Listening

```javascript
// In useWeb3.jsx
contracts.predictionMarket.on("MarketCreated", (marketId, creator, question) => {
    console.log("New market created:", question);
    // Update UI, refresh market list
});

contracts.predictionMarket.on("SharesPurchased", (marketId, buyer, isYes, shares) => {
    console.log("Shares purchased:", shares);
    // Update price display, refresh market data
});
```

#### Real-time Updates

Frontend can:
1. **Listen to events** - React to blockchain events in real-time
2. **Poll contract** - Periodically call `getCurrentPrice()`, `getMarket()`
3. **Watch transactions** - Monitor pending transactions via transaction hash

---

## 📊 Complete Data Flow

### Scenario: User Buys YES Shares

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND (React App)                       │
│                                                              │
│  Web3TradingInterface.jsx                                   │
│  ├── User enters: 0.1 ETH                                   │
│  ├── Clicks "Buy YES"                                        │
│  └── Calls: buyShares(marketId, true, { value: 0.1 ETH })   │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    useWeb3 Hook                             │
│                                                              │
│  useWeb3.jsx                                                 │
│  ├── Validates wallet connected                             │
│  ├── Gets contract from: contracts.predictionMarket        │
│  ├── Calls: contract.buyShares(...)                        │
│  └── Returns: Transaction Promise                          │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   ethers.js Library                         │
│                                                              │
│  ethers.Contract                                             │
│  ├── Encodes function call using ABI                        │
│  ├── Creates transaction object                             │
│  ├── Sends to: MetaMask                                     │
│  └── Returns: Transaction Response                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    MetaMask Wallet                          │
│                                                              │
│  ├── Shows transaction to user                              │
│  ├── User approves                                          │
│  └── Sends transaction to blockchain                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Hardhat Node (JSON-RPC)                        │
│                                                              │
│  ├── Receives transaction                                   │
│  ├── Validates                                              │
│  └── Executes on blockchain                                 │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         ETHPredictionMarket Contract (Blockchain)           │
│                                                              │
│  buyShares(marketId, true) [msg.value = 0.1 ETH]           │
│  ├── [1] Validates: market active? before endTime?        │
│  ├── [2] Calculate fee: 0.002 ETH (2%)                     │
│  ├── [3] Investment: 0.098 ETH                             │
│  ├── [4] Call: pricingAMM.updateMarketState()             │
│  ├── [5] Call: pricingAMM.calculatePrice()                │
│  │   │                                                      │
│  │   └─→ PricingAMM Contract                              │
│  │       ├── Reads: yesShares, noShares                    │
│  │       ├── Applies LMSR formula                          │
│  │       ├── Calculates: yesPrice = 5000, noPrice = 5000   │
│  │       ├── Clamps to [100, 9900]                          │
│  │       └── Returns: (5000, 5000)                         │
│  │                                                          │
│  ├── [6] Calculate shares: (0.098 * 10000) / 5000 = 0.196  │
│  ├── [7] Apply 98%: 0.196 * 0.98 = 0.192 shares           │
│  ├── [8] Update: market.totalYesShares += 0.192           │
│  ├── [9] Update: position.yesShares += 0.192                │
│  ├── [10] Update: market.totalVolume += 0.1 ETH           │
│  ├── [11] Call: pricingAMM.updateMarketState() again       │
│  ├── [12] Emit: SharesPurchased event                       │
│  └── [13] Return: Transaction receipt                     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  BLOCKCHAIN STATE                           │
│                                                              │
│  Market 1:                                                    │
│  ├── totalYesShares: 0.2 (was 0, now 0.192)                │
│  ├── totalNoShares: 0                                       │
│  ├── totalVolume: 0.1 ETH                                   │
│  └── User position: 0.192 YES shares                        │
│                                                              │
│  PricingAMM Market 1:                                        │
│  ├── yesShares: 0.192                                       │
│  ├── noShares: 0                                           │
│  ├── liquidity: 1.1 ETH                                    │
│  └── New prices: YES=5048, NO=4952                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND UPDATE                            │
│                                                              │
│  ├── Transaction confirmed                                  │
│  ├── Refresh market data: getCurrentPrice()                 │
│  ├── Refresh user position: getUserPosition()              │
│  ├── Listen to SharesPurchased event                        │
│  └── Update UI with new prices                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 Event System

### Events Emitted by Contracts

#### ETHPredictionMarket Events

```solidity
event MarketCreated(uint256 indexed marketId, address indexed creator, ...)
event SharesPurchased(uint256 indexed marketId, address indexed buyer, ...)
event SharesSold(uint256 indexed marketId, address indexed seller, ...)
event ResolutionProposed(uint256 indexed marketId, address indexed proposer, ...)
event ResolutionDisputed(uint256 indexed marketId, address indexed disputer, ...)
event ResolutionFinalized(uint256 indexed marketId, uint8 finalOutcome, ...)
```

#### PricingAMM Events

```solidity
event MarketCreated(uint256 indexed marketId, uint256 initialLiquidity)
event YesBought(uint256 indexed marketId, uint256 amount, ...)
event NoBought(uint256 indexed marketId, uint256 amount, ...)
```

### Frontend Event Handling

```javascript
// Listen for new markets
contracts.predictionMarket.on("MarketCreated", (marketId, creator, question) => {
    // Add to market list
    setMarkets(prev => [...prev, { id: marketId, question }]);
});

// Listen for trades (update prices in real-time)
contracts.predictionMarket.on("SharesPurchased", (marketId, buyer, isYes, shares, cost, newPrice) => {
    // Update price display
    setCurrentPrice(newPrice);
});

// Filter events by market ID
const filter = contracts.predictionMarket.filters.MarketCreated(null, userAddress);
const events = await contracts.predictionMarket.queryFilter(filter);
```

---

## 🔒 Security Features

### Reentrancy Protection

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

function buyShares(...) external payable nonReentrant {
    // Protected from reentrancy attacks
}
```

### Input Validation

```solidity
require(msg.value >= marketCreationFee, "Insufficient fee");
require(_endTime > block.timestamp, "End time must be in future");
require(!market.resolved, "Market already resolved");
```

### Price Clamping

```solidity
// Prevent extreme prices (0% or 100%)
require(currentPrice >= 100 && currentPrice <= 9900, "Price at extreme");
```

### Ownership Controls

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

function collectFees() external onlyOwner {
    // Only owner can collect fees
}
```

---

## 🔗 Contract Addresses & ABIs

### Current Deployment

```
Network: Hardhat Local (Chain ID: 1337)

ETHPredictionMarket: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
PricingAMM:          0x8F8E2D72D4Be91Fc98ac088f90A28e2a5c30b742
MockUSDC:            0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### ABI Location

- **Frontend**: `frontend/src/contracts/eth-config.js`
- **ABI includes**: All function signatures, event definitions
- **ABI format**: Array of strings (simplified) or JSON (full)

---

## 📝 Summary

### How Everything Works Together:

1. **User interacts** with React frontend
2. **Frontend calls** `useWeb3` hook functions
3. **useWeb3** wraps ethers.js contract calls
4. **ethers.js** sends transaction to MetaMask
5. **MetaMask** sends to Hardhat node
6. **Hardhat node** executes transaction on blockchain
7. **ETHPredictionMarket** performs business logic
8. **PricingAMM** calculates prices when needed
9. **Events emitted** for frontend to react
10. **Frontend updates** UI based on events or polling

### Key Takeaways:

- **ETHPredictionMarket** = Main orchestrator
- **PricingAMM** = Price calculation engine
- **Frontend** = User interface, communicates via ethers.js
- **ABI** = Interface definition (tells frontend what functions exist)
- **Events** = Real-time notifications to frontend
- **State** = Stored on blockchain, immutable and transparent

---

**Last Updated**: 2025-10-29  
**Version**: 1.0  
**Main Contracts**: ETHPredictionMarket.sol, PricingAMM.sol

