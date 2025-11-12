# TimelessPredict - Complete System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Admin Market Creation Flow](#admin-market-creation-flow)
3. [User Buy/Sell Trading Flow](#user-buysell-trading-flow)
4. [Market Creation Logic (Smart Contract)](#market-creation-logic-smart-contract)
5. [Price Calculation Logic (AMM/LMSR)](#price-calculation-logic-ammlmsr)
6. [Smart Contract Architecture](#smart-contract-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

TimelessPredict is a decentralized prediction market platform built on Ethereum. Users can create markets, trade on outcomes (YES/NO), and resolve markets using an optimistic oracle system. The platform uses ETH as the native currency and implements an Automated Market Maker (AMM) with Logarithmic Market Scoring Rule (LMSR) for pricing.

### Key Features:
- **Market Creation**: Admins can create prediction markets with specific questions, categories, and resolution dates
- **Trading**: Users can buy/sell YES or NO shares using ETH
- **Price Discovery**: LMSR algorithm ensures smooth price movements based on supply and demand
- **Optimistic Oracle**: Community-driven market resolution with dispute mechanisms
- **Price Impact**: Polymarket-style smooth price curves (B_PARAM = 10 ETH)

---

## Admin Market Creation Flow

### Frontend: MarketCreation.jsx

**Location**: `frontend/src/pages/admin/MarketCreation.jsx`

#### Step-by-Step Process:

1. **Admin Authentication**
   - Admin must be logged in (localStorage: `isAdminLoggedIn === 'true'` and `usertype === 'admin'`)
   - If not authenticated, redirected to `/admin` login page

2. **Wallet Connection**
   - Admin must connect MetaMask wallet
   - Frontend checks `isConnected` status
   - Shows warning banner if wallet not connected

3. **Form Submission**
   - Admin fills out form with:
     - **Question**: The prediction question (required)
     - **Description**: Additional context (optional)
     - **Category**: General, Sports, Politics, Crypto, etc.
     - **End Date & Time**: When trading stops (must be future)
     - **Resolution Date & Time**: When market can be resolved (must be after end time)
   
4. **Validation**
   ```javascript
   // Validations performed:
   - Question cannot be empty
   - End time must be in future
   - Resolution time must be after end time
   - Wallet must be connected
   ```

5. **Timestamp Calculation**
   ```javascript
   const endDateTime = new Date(`${endDate}T${endTime}`);
   const resolutionDateTime = new Date(`${resolutionDate}T${resolutionTime}`);
   
   endTime = Math.floor(endDateTime.getTime() / 1000);      // Unix timestamp
   resolutionTime = Math.floor(resolutionDateTime.getTime() / 1000);
   ```

6. **Smart Contract Call**
   ```javascript
   // Frontend calls useWeb3.createMarket()
   const receipt = await createMarket(
     question,
     description,
     category,
     endTime,
     resolutionTime
   );
   ```

7. **Transaction Execution**
   - Frontend calls `contracts.predictionMarket.createMarket()` with:
     - Market creation fee (0.01 ETH) as `value`
     - Gas limit: 1,000,000
   - Waits for transaction confirmation
   - Shows success/error toast notifications

8. **Post-Creation**
   - Form reset
   - Redirect to `/markets` page
   - New market appears in market list

---

## User Buy/Sell Trading Flow

### Frontend: Web3TradingInterface.jsx

**Location**: `frontend/src/components/trading/Web3TradingInterface.jsx`

### BUY SHARES Flow:

#### 1. **User Interface Selection**
   - User navigates to market detail page: `/markets/{marketId}`
   - Selects "Buy" tab
   - Clicks on "Yes" or "No" price box to select side
   - Enters ETH amount (or clicks "Max" to use full balance)
   - Frontend calculates estimated shares in real-time

#### 2. **Share Estimation (Frontend)**
   ```javascript
   // Calculate using AMM pricing
   const [yesPriceBasis, noPriceBasis] = await contracts.pricingAMM.calculatePrice(marketId);
   const currentPriceBasis = tradeSide === 'yes' ? yesPriceBasis : noPriceBasis;
   const currentPriceDecimal = currentPriceBasis / 10000; // Convert basis points to decimal
   
   // Example: At 50% (0.5), 0.1 ETH buys 0.1 / 0.5 = 0.2 shares
   estimatedShares = investmentAmount / currentPriceDecimal;
   estimatedShares = estimatedShares * 0.98; // Apply 2% fee
   ```

#### 3. **Validation (Frontend)**
   - Checks: `tradeAmount > 0`
   - Checks: `tradeAmount <= ethBalance`
   - Shows error if validation fails

#### 4. **Smart Contract Call: buyShares()**
   ```javascript
   // Frontend calls useWeb3.buyShares()
   await buyShares(marketId, tradeSide === 'yes', tradeAmount);
   ```

#### 5. **Smart Contract Execution: buyShares()**

   **Location**: `contracts/ETHPredictionMarket.sol` (line 207)
   
   **Step-by-step:**
   
   a. **Validation Checks**:
      ```solidity
      require(msg.value > 0, "Must send ETH to buy shares");
      require(market.active, "Market not active");
      require(!market.resolved, "Market already resolved");
      require(block.timestamp < market.endTime, "Market has ended");
      ```
   
   b. **Sync AMM State**:
      ```solidity
      // Update AMM to match current market state BEFORE calculating shares
      pricingAMM.updateMarketState(_marketId, market.totalYesShares, market.totalNoShares);
      ```
   
   c. **Calculate Platform Fee**:
      ```solidity
      platformFee = (msg.value * platformFeePercent) / 10000; // 2% = 200 basis points
      investmentAmount = msg.value - platformFee;
      ```
   
   d. **Get Current Price from AMM**:
      ```solidity
      (currentYesPrice, currentNoPrice) = pricingAMM.calculatePrice(_marketId);
      currentPrice = _isYes ? currentYesPrice : currentNoPrice;
      
      // Price validation
      require(currentPrice >= 100 && currentPrice <= 9900, "Price at extreme");
      ```
   
   e. **Calculate Shares**:
      ```solidity
      // Formula: shares = (investmentAmount * 10000) / currentPrice
      // Example: At 50¢ (5000 basis points), 0.1 ETH buys:
      //          (0.1 * 10000) / 5000 = 0.2 shares
      shares = (investmentAmount * 10000) / currentPrice;
      shares = (shares * 9800) / 10000; // Apply 2% fee
      ```
   
   f. **Update Market State**:
      ```solidity
      if (_isYes) {
          market.totalYesShares += shares;
      } else {
          market.totalNoShares += shares;
      }
      market.totalVolume += msg.value;
      ```
   
   g. **Update User Position**:
      ```solidity
      Position storage position = positions[_marketId][msg.sender];
      if (_isYes) {
          position.yesShares += shares;
      } else {
          position.noShares += shares;
      }
      position.totalInvested += msg.value;
      ```
   
   h. **Sync AMM State Again**:
      ```solidity
      // Update AMM with new totals AFTER adding shares (for next trade)
      pricingAMM.updateMarketState(_marketId, market.totalYesShares, market.totalNoShares);
      ```
   
   i. **Record Trade & Emit Event**:
      ```solidity
      allTrades.push(Trade({...}));
      emit SharesPurchased(_marketId, msg.sender, _isYes, shares, msg.value, newPrice);
      ```

#### 6. **Frontend Updates**
   - Transaction confirmation received
   - `onTradeComplete()` callback triggers:
     - Refresh market data
     - Refresh price history
     - Refresh recent trades
     - Update chart
     - Update user position

---

### SELL SHARES Flow:

#### 1. **User Selection**
   - User selects "Sell" tab
   - Selects side (Yes/No) to sell
   - Enters amount of shares to sell (or clicks "Max")

#### 2. **Validation (Frontend)**
   - Checks: `tradeAmount > 0`
   - Checks: User has enough shares
   - Shows error if insufficient shares

#### 3. **Smart Contract Call: sellShares()**
   ```javascript
   await sellShares(marketId, tradeSide === 'yes', tradeAmount);
   ```

#### 4. **Smart Contract Execution: sellShares()**

   **Location**: `contracts/ETHPredictionMarket.sol` (line 300)
   
   **Step-by-step:**
   
   a. **Validation Checks**:
      ```solidity
      require(market.active, "Market not active");
      require(!market.resolved, "Market already resolved");
      require(block.timestamp < market.endTime, "Market has ended");
      require(_shares > 0, "Must sell at least some shares");
      require(position.yesShares >= _shares, "Insufficient shares"); // or noShares
      ```
   
   b. **Get Current Price**:
      ```solidity
      (currentYesPrice, currentNoPrice) = pricingAMM.calculatePrice(_marketId);
      currentPrice = _isYes ? currentYesPrice : currentNoPrice;
      require(currentPrice >= 100 && currentPrice <= 9900, "Price at extreme");
      ```
   
   c. **Calculate Payout**:
      ```solidity
      // Formula: payout = (shares * currentPrice) / 10000
      // Example: 0.2 shares at 50¢ (5000 basis points):
      //          (0.2 * 5000) / 10000 = 0.1 ETH
      payout = (_shares * currentPrice) / 10000;
      platformFee = (payout * 200) / 10000; // 2% fee
      userPayout = payout - platformFee;
      ```
   
   d. **Update Positions** (Reentrancy protection - do this FIRST):
      ```solidity
      if (_isYes) {
          position.yesShares -= _shares;
          market.totalYesShares -= _shares;
      } else {
          position.noShares -= _shares;
          market.totalNoShares -= _shares;
      }
      ```
   
   e. **Sync AMM State**:
      ```solidity
      pricingAMM.updateMarketState(_marketId, market.totalYesShares, market.totalNoShares);
      ```
   
   f. **Update Volume**:
      ```solidity
      market.totalVolume += payout;
      ```
   
   g. **Transfer ETH to User**:
      ```solidity
      if (address(this).balance >= userPayout) {
          payable(msg.sender).transfer(userPayout);
      }
      ```
   
   h. **Record Trade & Emit Event**:
      ```solidity
      allTrades.push(Trade({...}));
      emit SharesSold(_marketId, msg.sender, _isYes, _shares, userPayout, currentPrice);
      ```

#### 5. **Frontend Updates**
   - Transaction confirmation
   - Refresh all market data
   - Update user balance
   - Update position display

---

## Market Creation Logic (Smart Contract)

### Contract: ETHPredictionMarket.sol

**Function**: `createMarket()` (line 160)

### Complete Flow:

```solidity
function createMarket(
    string memory _question,
    string memory _description,
    string memory _category,
    uint256 _endTime,
    uint256 _resolutionTime
) external payable nonReentrant
```

#### 1. **Validation**
   ```solidity
   require(msg.value >= marketCreationFee, "Insufficient market creation fee");
   require(_endTime > block.timestamp, "End time must be in future");
   require(_resolutionTime > _endTime, "Resolution time must be after end time");
   require(bytes(_question).length > 0, "Question cannot be empty");
   ```
   
   **Fee**: Default `marketCreationFee = 0.01 ETH` (10,000,000,000,000,000 wei)

#### 2. **Generate Market ID**
   ```solidity
   uint256 marketId = nextMarketId++; // Increment and assign
   ```

#### 3. **Create Market Struct**
   ```solidity
   markets[marketId] = Market({
       id: marketId,
       question: _question,
       description: _description,
       category: _category,
       endTime: _endTime,
       resolutionTime: _resolutionTime,
       resolved: false,
       outcome: 0,
       totalYesShares: 0,           // Start with 0 shares
       totalNoShares: 0,
       totalVolume: 0,
       creator: msg.sender,         // Admin's address
       createdAt: block.timestamp,
       active: true,                // Market is active
       lastTradedPrice: 5000,       // Initial 50¢ price
       yesBidPrice: 0,
       yesAskPrice: 10000,
       noBidPrice: 0,
       noAskPrice: 10000
   });
   ```

#### 4. **Add to Active Markets**
   ```solidity
   activeMarketIds.push(marketId);           // Add to global list
   userMarkets[msg.sender].push(marketId);   // Add to creator's list
   ```

#### 5. **Initialize AMM**
   ```solidity
   // Create market in PricingAMM with initial liquidity
   pricingAMM.createMarket(marketId, 1 ether); // 1 ETH initial liquidity
   ```
   
   **AMM Initialization** (`PricingAMM.sol` line 20):
   ```solidity
   markets[marketId] = Market({
       yesShares: 0,
       noShares: 0,
       liquidity: initialLiquidity,  // 1 ETH
       b: B_PARAM                     // 10 ETH (10000000000000000000 wei)
   });
   ```

#### 6. **Emit Event**
   ```solidity
   emit MarketCreated(marketId, msg.sender, _question, _category, _endTime);
   ```

#### 7. **Fee Collection**
   - The `marketCreationFee` (0.01 ETH) stays in contract balance
   - Platform can withdraw accumulated fees

---

## Price Calculation Logic (AMM/LMSR)

### Contract: PricingAMM.sol

### LMSR (Logarithmic Market Scoring Rule) Formula

The platform uses LMSR for price discovery, providing smooth price curves similar to Polymarket.

#### Formula:
```
Price_i = e^(q_i/b) / Σ_j e^(q_j/b)

Where:
- q_i = Quantity of shares for outcome i (in wei)
- b = Liquidity parameter (B_PARAM = 10 ETH)
- e^(x) = Exponential function (e ≈ 2.718)
```

#### For YES/NO Markets:
```
p_YES = e^(q_YES/b) / (e^(q_YES/b) + e^(q_NO/b))
p_NO = e^(q_NO/b) / (e^(q_YES/b) + e^(q_NO/b))

p_YES + p_NO = 1 (always sums to 100%)
```

### Implementation: `calculatePrice()`

**Location**: `contracts/PricingAMM.sol` (line 46)

#### Step-by-Step Calculation:

1. **Initial State Check**:
   ```solidity
   if (m.liquidity == 0 || (m.yesShares == 0 && m.noShares == 0)) {
       return (5000, 5000); // 50¢ each (50/50 split)
   }
   ```

2. **Get Liquidity Parameter**:
   ```solidity
   uint256 b = m.b > 0 ? m.b : B_PARAM; // B_PARAM = 10 ETH
   ```

3. **Calculate Exponential Terms**:
   ```solidity
   // Scale to 1e18 for precision
   uint256 qYesOverB = (m.yesShares * 1e18) / b;
   uint256 qNoOverB = (m.noShares * 1e18) / b;
   
   // Calculate e^(q_YES/b) and e^(q_NO/b) using Taylor series
   expYes = expScaled(qYesOverB); // Returns value scaled by 1e18
   expNo = expScaled(qNoOverB);
   ```

4. **Taylor Series for exp(x)**:
   ```solidity
   // exp(x) ≈ 1 + x + x²/2! + x³/3! + x⁴/4! + x⁵/5! + x⁶/6!
   function expScaled(uint256 x) internal pure returns (uint256) {
       if (x == 0) return 1e18; // exp(0) = 1
       
       uint256 result = 1e18;
       uint256 term = x;
       
       for (uint256 i = 1; i <= 6; i++) {
           result += term;
           term = (term * x) / (i * 1e18); // Divide by factorial
           if (term < 1e12) break; // Stop if term too small
       }
       
       return result;
   }
   ```

5. **Calculate Prices**:
   ```solidity
   uint256 sumExp = expYes + expNo;
   
   // Convert to basis points (10000 = 100% = $1.00)
   yesPrice = (expYes * 10000) / sumExp;  // Example: 5000 = 50¢
   noPrice = (expNo * 10000) / sumExp;    // Example: 5000 = 50¢
   ```

6. **Price Clamping (Prevent 0% or 100%)**:
   ```solidity
   uint256 MIN_PRICE = 100;   // 1% minimum (always tradeable)
   uint256 MAX_PRICE = 9900;  // 99% maximum (always tradeable)
   
   if (yesPrice < MIN_PRICE) yesPrice = MIN_PRICE;
   if (yesPrice > MAX_PRICE) yesPrice = MAX_PRICE;
   
   // Ensure they sum to exactly 10000
   noPrice = 10000 - yesPrice;
   
   // Double-check noPrice bounds
   if (noPrice < MIN_PRICE || noPrice > MAX_PRICE) {
       // Adjust both to stay within bounds
       noPrice = noPrice < MIN_PRICE ? MIN_PRICE : MAX_PRICE;
       yesPrice = 10000 - noPrice;
   }
   ```

### Price Impact Examples:

With **B_PARAM = 10 ETH** (Polymarket-style):

- **Small Trade (0.1 ETH)**:
  - Starting: 50¢/50¢
  - After: ~50.5¢/49.5¢
  - **Impact**: ~0.5-1% movement

- **Medium Trade (0.5 ETH)**:
  - Starting: 50¢/50¢
  - After: ~52.5¢/47.5¢
  - **Impact**: ~5% movement

- **Large Trade (1 ETH)**:
  - Starting: 50¢/50¢
  - After: ~55¢/45¢
  - **Impact**: ~10% movement

### Why B_PARAM = 10 ETH?

- **Higher B = Smoother prices**: More liquidity = less price volatility
- **Lower B = More volatility**: Smaller trades cause larger price swings
- **10 ETH**: Provides Polymarket-like smooth price curves
  - Prevents extreme price swings on small trades
  - Still allows reasonable price movement for larger trades
  - Balances liquidity and price discovery

---

## Smart Contract Architecture

### Main Contracts:

1. **ETHPredictionMarket.sol**
   - **Purpose**: Main prediction market contract
   - **Key Functions**:
     - `createMarket()`: Create new markets
     - `buyShares()`: Buy YES/NO shares
     - `sellShares()`: Sell shares
     - `proposeResolution()`: Propose market outcome
     - `disputeResolution()`: Dispute a proposal
     - `finalizeResolution()`: Finalize outcome
     - `getMarket()`: Get market data
     - `getActiveMarkets()`: Get all active market IDs
     - `getUserPosition()`: Get user's shares
     - `getCurrentPrice()`: Get current YES/NO prices

2. **PricingAMM.sol**
   - **Purpose**: Automated Market Maker for price calculation
   - **Key Functions**:
     - `createMarket()`: Initialize AMM for market
     - `calculatePrice()`: Calculate YES/NO prices using LMSR
     - `updateMarketState()`: Sync AMM with market state
     - `getMarketState()`: Get market liquidity info
   - **Constants**:
     - `B_PARAM = 10 ETH`: Liquidity parameter
     - `FEE_BASIS_POINTS = 200`: 2% fee

3. **PredictionOracle.sol** (Legacy)
   - Not actively used (replaced by Optimistic Oracle)

### Data Structures:

#### Market Struct:
```solidity
struct Market {
    uint256 id;
    string question;
    string description;
    string category;
    uint256 endTime;           // Trading stops here
    uint256 resolutionTime;    // Can be resolved after this
    bool resolved;
    uint8 outcome;             // 0=unresolved, 1=YES, 2=NO, 3=INVALID
    uint256 totalYesShares;
    uint256 totalNoShares;
    uint256 totalVolume;
    address creator;
    uint256 createdAt;
    bool active;
    uint256 lastTradedPrice;   // In basis points
    uint256 yesBidPrice;
    uint256 yesAskPrice;
    uint256 noBidPrice;
    uint256 noAskPrice;
}
```

#### Position Struct:
```solidity
struct Position {
    uint256 yesShares;
    uint256 noShares;
    uint256 totalInvested;
}
```

#### Trade Struct:
```solidity
struct Trade {
    uint256 marketId;
    address trader;
    bool isYes;
    uint256 shares;
    uint256 price;            // In basis points
    uint256 timestamp;
}
```

#### ResolutionProposal Struct (Optimistic Oracle):
```solidity
struct ResolutionProposal {
    uint8 proposedOutcome;    // 1=YES, 2=NO, 3=INVALID
    address proposer;
    uint256 proposalTime;
    uint256 proposerBond;
    bool disputed;
    address disputer;
    uint256 disputeTime;
    uint256 disputerBond;
    bool finalized;
}
```

### Key State Variables:

```solidity
mapping(uint256 => Market) public markets;
mapping(uint256 => mapping(address => Position)) public positions;
Trade[] public allTrades;
uint256[] public activeMarketIds;
mapping(address => uint256[]) public userMarkets;

uint256 public nextMarketId = 1;
uint256 public marketCreationFee = 0.01 ether;
uint256 public platformFeePercent = 200; // 2% in basis points

PricingAMM public pricingAMM;

// Optimistic Oracle
mapping(uint256 => ResolutionProposal) public resolutionProposals;
uint256 public proposerBondAmount = 0.01 ether;
uint256 public disputePeriod = 1 days;
uint256 public disputerBondMultiplier = 2; // Disputer pays 2x proposer bond
```

---

## Frontend Architecture

### Key Components:

1. **MarketCreation.jsx** (`/admin/create-market`)
   - Admin form for creating markets
   - Validates inputs, calculates timestamps
   - Calls `useWeb3.createMarket()`

2. **Web3TradingInterface.jsx** (`/markets/{marketId}`)
   - Trading UI with Buy/Sell tabs
   - Real-time price display
   - Share estimation
   - Calls `useWeb3.buyShares()` / `useWeb3.sellShares()`

3. **PolymarketStyleTrading.jsx** (`/markets/{marketId}`)
   - Main market detail page
   - Displays market info, chart, trading interface
   - Fetches market data using `useWeb3.getMarketData()`

4. **Home.jsx** (`/`)
   - Market listing page
   - Shows all active markets
   - Fetches via `contracts.predictionMarket.getActiveMarkets()`

5. **useWeb3.jsx** (Hook)
   - Main Web3 integration hook
   - Handles wallet connection
   - Provides contract interfaces
   - Functions:
     - `connectWallet()`: Connect MetaMask
     - `createMarket()`: Create market
     - `buyShares()`: Buy shares
     - `sellShares()`: Sell shares
     - `getMarketData()`: Get market data with prices
     - `getUserPosition()`: Get user shares

### Data Flow:

```
User Action → Frontend Component → useWeb3 Hook → Smart Contract → Blockchain
                                                                    ↓
User Interface ← Frontend Component ← useWeb3 Hook ← Event Logs ← Blockchain
```

---

## Data Flow Diagrams

### Market Creation Flow:

```
Admin (Browser)
    ↓
[MarketCreation.jsx]
    ↓ (Form Submission)
[useWeb3.createMarket()]
    ↓ (MetaMask Transaction)
[ETHPredictionMarket.createMarket()]
    ↓
[Validation Checks]
    ↓
[Create Market Struct]
    ↓
[pricingAMM.createMarket()]
    ↓ (Initialize AMM)
[Market Created Event]
    ↓
[Transaction Confirmed]
    ↓
[Redirect to /markets]
```

### Buy Shares Flow:

```
User (Browser)
    ↓
[Web3TradingInterface.jsx]
    ↓ (Enter Amount, Click Buy)
[Frontend Validation]
    ↓
[Calculate Estimated Shares]
    ↓ (Show to user)
[User Confirms]
    ↓
[useWeb3.buyShares()]
    ↓ (MetaMask Transaction)
[ETHPredictionMarket.buyShares()]
    ↓
[Sync AMM State]
    ↓
[Calculate Shares using AMM Price]
    ↓
[Update Market State]
    ↓
[Update User Position]
    ↓
[Sync AMM State Again]
    ↓
[SharesPurchased Event]
    ↓
[Transaction Confirmed]
    ↓
[onTradeComplete() callback]
    ↓
[Refresh: Chart, Prices, Trades]
```

### Price Calculation Flow:

```
Trade Occurs
    ↓
[ETHPredictionMarket updates shares]
    ↓
[pricingAMM.updateMarketState()]
    ↓
[Next Trade: buyShares() calls]
    ↓
[pricingAMM.calculatePrice()]
    ↓
[Get: yesShares, noShares, b (liquidity)]
    ↓
[Calculate: q_YES/b, q_NO/b]
    ↓
[expScaled() - Taylor series for e^(x)]
    ↓
[expYes = e^(q_YES/b), expNo = e^(q_NO/b)]
    ↓
[sumExp = expYes + expNo]
    ↓
[yesPrice = (expYes * 10000) / sumExp]
[noPrice = (expNo * 10000) / sumExp]
    ↓
[Clamp to 1%-99% range]
    ↓
[Return prices to buyShares()]
    ↓
[Use price to calculate shares]
```

---

## Key Formulas & Calculations

### 1. Share Calculation (Buy):
```
shares = (investmentAmount * 10000) / currentPrice
shares_after_fee = shares * 0.98  // 2% fee
```

**Example**:
- Investment: 0.1 ETH
- Current Price: 5000 basis points (50¢)
- Shares: (0.1 * 10000) / 5000 = 0.2 shares
- After Fee: 0.2 * 0.98 = 0.196 shares

### 2. Payout Calculation (Sell):
```
payout = (shares * currentPrice) / 10000
platformFee = payout * 0.02  // 2%
userPayout = payout - platformFee
```

**Example**:
- Shares: 0.196 shares
- Current Price: 5200 basis points (52¢)
- Payout: (0.196 * 5200) / 10000 = 0.10192 ETH
- Fee: 0.10192 * 0.02 = 0.0020384 ETH
- User Receives: 0.10192 - 0.0020384 = 0.0998816 ETH

### 3. Price Calculation (LMSR):
```
q_YES_over_b = yesShares / b          // e.g., 2 ETH / 10 ETH = 0.2
q_NO_over_b = noShares / b            // e.g., 0 ETH / 10 ETH = 0

expYes = e^(q_YES_over_b)              // e.g., e^0.2 ≈ 1.221
expNo = e^(q_NO_over_b)                // e.g., e^0 ≈ 1.0

sumExp = expYes + expNo                // 1.221 + 1.0 = 2.221

yesPrice = (expYes / sumExp) * 10000   // (1.221 / 2.221) * 10000 = 5500 (55¢)
noPrice = (expNo / sumExp) * 10000     // (1.0 / 2.221) * 10000 = 4500 (45¢)
```

### 4. Price Impact (Approximate):
```
Price Change ≈ (Trade Amount / B_PARAM) * Sensitivity Factor

For B_PARAM = 10 ETH:
- 0.1 ETH trade → ~1% price movement
- 0.5 ETH trade → ~5% price movement
- 1.0 ETH trade → ~10% price movement
```

---

## Fee Structure

### Market Creation Fee:
- **Amount**: 0.01 ETH
- **Who Pays**: Admin/Market Creator
- **When**: During market creation
- **Purpose**: Prevents spam, generates platform revenue

### Trading Fees:
- **Buy Fee**: 2% of investment (platformFeePercent = 200 basis points)
  - Calculated on `msg.value` sent by user
  - Deducted before share calculation
  
- **Sell Fee**: 2% of payout
  - Calculated on `payout` amount
  - Deducted from user's payout
  
- **Where Fees Go**: Contract balance (platform can withdraw)

### Optimistic Oracle Fees:
- **Proposer Bond**: 0.01 ETH (default)
  - Required to propose resolution
  - Returned if not disputed
  - Forfeited if disputed
  
- **Disputer Bond**: 2x proposer bond (0.02 ETH default)
  - Required to dispute
  - Returned if dispute is valid

---

## Security Features

### 1. Reentrancy Protection
- All state-changing functions use `nonReentrant` modifier
- Positions updated BEFORE external transfers

### 2. Price Clamping
- Prices clamped to 1%-99% range
- Prevents division by zero
- Ensures trading always possible

### 3. Validation Checks
- Market must be active
- Market must not be resolved
- Trading must be before endTime
- User must have sufficient balance/shares

### 4. Overflow Protection
- Uses `unchecked` blocks only for safe arithmetic
- Proper scaling to prevent overflow/underflow

---

## Events & Logging

### Market Creation:
- `MarketCreated(marketId, creator, question, category, endTime)`

### Trading:
- `SharesPurchased(marketId, buyer, isYes, shares, cost, newPrice)`
- `SharesSold(marketId, seller, isYes, shares, payout, newPrice)`

### Resolution:
- `ResolutionProposed(marketId, proposer, outcome, time, bond)`
- `ResolutionDisputed(marketId, disputer, time, bond)`
- `ResolutionFinalized(marketId, outcome, finalizer)`

Frontend listens to these events for real-time updates.

---

## Optimistic Oracle Resolution System

### Overview:
Instead of a centralized oracle, anyone can propose market outcomes with a bond. Others can dispute with a larger bond. If undisputed, the proposal is finalized.

### Flow:

1. **Propose Resolution**:
   - After `resolutionTime`, anyone can propose outcome
   - Must post bond (0.01 ETH default)
   - Stores proposal in `resolutionProposals` mapping

2. **Dispute Period**:
   - Anyone can dispute within `disputePeriod` (1 day default)
   - Must post 2x bond (0.02 ETH default)
   - Dispute clears proposal, allows new proposal

3. **Finalize**:
   - After dispute period expires, anyone can finalize
   - Resolves market with proposed outcome
   - Proposer gets bond back if not disputed

### Functions:

- `proposeResolution(marketId, outcome)`: Propose with bond
- `disputeResolution(marketId)`: Dispute with larger bond
- `finalizeResolution(marketId)`: Finalize after dispute period

---

## Deployment & Configuration

### Contract Deployment:
1. Deploy `ETHPredictionMarket` with:
   - `marketCreationFee = 0.01 ETH`
   - `platformFeePercent = 200` (2%)

2. Contract automatically deploys `PricingAMM` in constructor

3. Set Optimistic Oracle parameters:
   - `proposerBondAmount = 0.01 ETH`
   - `disputePeriod = 1 days`
   - `disputerBondMultiplier = 2`

### Frontend Configuration:
- Contract addresses in: `frontend/src/contracts/config.js`
- Auto-generated by deployment script
- Includes ABI and addresses

---

## Testing

### Test Scripts Available:

1. `test-full-system.js`: Comprehensive system test
2. `test-polymarket-price-impact.js`: Verify price impact
3. `test-optimistic-resolution-full.js`: Test oracle resolution
4. `test-buy-sell.js`: Test trading functionality

### Run Tests:
```bash
cd contracts
npx hardhat run scripts/test-full-system.js --network localhost
```

---

## Summary

### Complete Flow from Creation to Trading:

1. **Admin creates market** → Pays 0.01 ETH fee → Market deployed on-chain
2. **AMM initialized** → 1 ETH liquidity, B_PARAM = 10 ETH → Prices start at 50¢/50¢
3. **User buys YES shares** → Pays ETH → Receives shares → Prices update via LMSR
4. **Prices move smoothly** → Small trades (0.1 ETH) = ~1% impact → Large trades (1 ETH) = ~10% impact
5. **Prices clamped** → Never hit 0% or 100% → Trading always possible
6. **User sells shares** → Receives ETH payout → Prices update → Shares removed from pool
7. **Market resolves** → Optimistic oracle → Propose → Dispute (optional) → Finalize → Winners claim

All logic is implemented in Solidity smart contracts with React frontend for user interaction.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-28  
**System**: TimelessPredict v1.0

