# Admin System Documentation - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Admin Authentication System](#admin-authentication-system)
3. [Admin Routes & Access Control](#admin-routes--access-control)
4. [Market Creation System](#market-creation-system)
5. [Revenue Dashboard](#revenue-dashboard)
6. [Complete Admin Workflows](#complete-admin-workflows)
7. [Smart Contract Integration](#smart-contract-integration)
8. [Code Examples](#code-examples)
9. [Security Considerations](#security-considerations)

---

## Overview

The admin system allows authorized administrators to:
- **Create new prediction markets** on the blockchain
- **View real-time revenue metrics** from on-chain data
- **Monitor platform performance** (volume, fees, markets)

**Important**: There is **NO on-chain admin role** - anyone can create markets if they pay the fee. The frontend admin system is a **UI convenience layer** that:
- Provides an authenticated admin interface
- Validates forms before submitting to blockchain
- Fetches and displays on-chain data
- Routes admin users to admin-specific pages

---

## Admin Authentication System

### How It Works

The admin authentication is **frontend-only** and uses **localStorage** for session management. There is no blockchain-based admin role.

#### 1. **Admin Login Page** (`/admin`)

**File**: `frontend/src/pages/admin/AdminLogin.jsx`

**Default Credentials**:
```javascript
// Hardcoded in AdminLogin.jsx
const adminUsers = [
  { username: 'admin', password: 'admin123' },
  { username: 'administrator', password: 'admin' }
];
```

#### 2. **Authentication Flow**

```javascript
// Step 1: User submits login form
handleSubmit = async (e) => {
  // Step 2: Check credentials against hardcoded list
  const isValidUser = adminUsers.find(
    user => user.username === credentials.username && 
            user.password === credentials.password
  );
  
  // Step 3: If valid, store session in localStorage
  if (isValidUser) {
    localStorage.setItem('usertype', 'admin');
    localStorage.setItem('username', credentials.username);
    localStorage.setItem('isAdminLoggedIn', 'true');
    
    // Step 4: Redirect to admin dashboard
    history.push('/admin/create-market');
  }
};
```

#### 3. **Session Storage**

The system stores three keys in `localStorage`:

| Key | Value | Purpose |
|-----|-------|---------|
| `usertype` | `'admin'` | Identifies user as admin |
| `username` | `'admin'` or `'administrator'` | Admin username |
| `isAdminLoggedIn` | `'true'` | Login status flag |

#### 4. **Session Checking**

Every admin-protected page checks localStorage:

```javascript
// In MarketCreation.jsx
const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn') === 'true';
const usertype = localStorage.getItem('usertype');

// Redirect if not authenticated
useEffect(() => {
  if (!isAdminLoggedIn || usertype !== 'admin') {
    history.push('/admin');
  }
}, [history, isAdminLoggedIn, usertype]);
```

#### 5. **Logout**

```javascript
// Clears all admin session data
const handleLogout = () => {
  localStorage.removeItem('isAdminLoggedIn');
  localStorage.removeItem('usertype');
  localStorage.removeItem('username');
  history.push('/admin');
};
```

**⚠️ Security Note**: This is a **simple frontend authentication** for UI access only. Anyone with blockchain access can still call `createMarket()` directly on the smart contract if they pay the fee. The admin UI is purely for convenience and form validation.

---

## Admin Routes & Access Control

### Admin Routes

**File**: `frontend/src/helpers/AppRoutes.jsx`

```javascript
<Route exact path='/admin' component={AdminLogin} />
<Route exact path='/admin/create-market' component={MarketCreation} />
<Route exact path='/admin/revenue' component={RevenueDashboard} />
```

### Route Protection

#### 1. **`/admin`** (Login Page)
- **Public**: Anyone can access
- **Purpose**: Admin authentication
- **Redirects**: If already logged in, redirects to `/admin/create-market`

#### 2. **`/admin/create-market`** (Market Creation)
- **Protected**: Requires `isAdminLoggedIn === 'true'` and `usertype === 'admin'`
- **Redirects**: If not authenticated → `/admin`
- **Also requires**: Wallet connection (for blockchain interaction)

#### 3. **`/admin/revenue`** (Revenue Dashboard)
- **Protected**: Requires admin session (same check)
- **Purpose**: View platform revenue metrics from blockchain

### Access Control Logic

```javascript
// Pattern used in all admin pages
const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn') === 'true';
const usertype = localStorage.getItem('usertype');

// Protection
useEffect(() => {
  if (!isAdminLoggedIn || usertype !== 'admin') {
    history.push('/admin');
  }
}, [history, isAdminLoggedIn, usertype]);

// Early return if not authenticated
if (!isAdminLoggedIn || usertype !== 'admin') {
  return <RedirectToLogin />;
}
```

---

## Market Creation System

### Complete Flow

```
1. Admin logs in → localStorage session created
2. Admin navigates to /admin/create-market
3. Admin fills form (question, description, category, dates)
4. Frontend validates form data
5. Admin connects wallet (if not connected)
6. Frontend fetches marketCreationFee from contract
7. Frontend calls createMarket() with ETH payment
8. Smart contract validates and creates market
9. Market appears on frontend immediately
10. Admin redirected to /markets
```

### Step-by-Step Process

#### Step 1: Admin Form (`MarketCreation.jsx`)

**Form Fields**:
```javascript
const [formData, setFormData] = useState({
  question: '',           // Market question (required)
  description: '',        // Detailed description (optional)
  category: 'general',    // Category dropdown
  endDate: '',           // Date picker for end date
  endTime: '',           // Time picker for end time
  resolutionDate: '',    // Date picker for resolution date
  resolutionTime: ''     // Time picker for resolution time
});
```

**Categories Available**:
- `general`
- `sports`
- `politics`
- `crypto`
- `entertainment`
- `technology`
- `economics`
- `science`

#### Step 2: Form Validation

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validation checks:
  if (!isConnected) {
    toast.error('Please connect your wallet first');
    return;
  }
  
  if (!formData.question.trim()) {
    toast.error('Question is required');
    return;
  }
  
  // Calculate timestamps from date/time inputs
  const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
  const resolutionDateTime = new Date(`${formData.resolutionDate}T${formData.resolutionTime}`);
  
  const endTime = Math.floor(endDateTime.getTime() / 1000); // Unix timestamp
  const resolutionTime = Math.floor(resolutionDateTime.getTime() / 1000);
  
  // Time validations
  if (endTime <= now) {
    toast.error('End time must be in the future');
    return;
  }
  
  if (resolutionTime <= endTime) {
    toast.error('Resolution time must be after end time');
    return;
  }
  
  // Proceed to blockchain...
};
```

#### Step 3: Frontend → Blockchain Call

**File**: `frontend/src/hooks/useWeb3.jsx`

```javascript
const createMarket = useCallback(async (question, description, category, endTime, resolutionTime) => {
  if (!contracts.predictionMarket || !signer) {
    throw new Error('Contracts not initialized');
  }

  try {
    // Step 3a: Fetch current market creation fee from contract
    const marketCreationFee = await contracts.predictionMarket.marketCreationFee();
    // Returns: BigNumber in Wei (e.g., 10000000000000000 = 0.01 ETH)
    
    console.log('Creating market with fee:', ethers.utils.formatEther(marketCreationFee), 'ETH');
    
    // Step 3b: Call smart contract function with ETH payment
    const tx = await contracts.predictionMarket.createMarket(
      question,        // string
      description,     // string
      category,        // string
      endTime,         // uint256 (Unix timestamp)
      resolutionTime, // uint256 (Unix timestamp)
      {
        value: marketCreationFee,  // ETH payment (in Wei)
        gasLimit: 1000000           // Gas limit for transaction
      }
    );

    console.log('Create market transaction sent:', tx.hash);
    
    // Step 3c: Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log('Create market transaction confirmed:', receipt);

    return receipt;
  } catch (err) {
    console.error('Error creating market:', err);
    throw err;
  }
}, [contracts, signer]);
```

#### Step 4: Smart Contract Processing

**File**: `contracts/contracts/ETHPredictionMarket.sol`

```solidity
function createMarket(
    string memory _question,
    string memory _description,
    string memory _category,
    uint256 _endTime,
    uint256 _resolutionTime
) external payable nonReentrant {
    // Validation 1: Check fee payment
    require(msg.value >= marketCreationFee, "Insufficient market creation fee");
    
    // Validation 2: End time must be future
    require(_endTime > block.timestamp, "End time must be in future");
    
    // Validation 3: Resolution time must be after end time
    require(_resolutionTime > _endTime, "Resolution time must be after end time");
    
    // Validation 4: Question cannot be empty
    require(bytes(_question).length > 0, "Question cannot be empty");

    // Step 4a: Assign new market ID
    uint256 marketId = nextMarketId++;
    
    // Step 4b: Create market struct
    markets[marketId] = Market({
        id: marketId,
        question: _question,
        description: _description,
        category: _category,
        endTime: _endTime,
        resolutionTime: _resolutionTime,
        resolved: false,
        outcome: 0,
        totalYesShares: 0,
        totalNoShares: 0,
        totalVolume: 0,
        creator: msg.sender,          // Admin wallet address
        createdAt: block.timestamp,
        active: true,
        lastTradedPrice: 5000,        // 50% initial price (50¢)
        yesBidPrice: 5000,            // 50¢
        yesAskPrice: 5000,            // 50¢
        noBidPrice: 5000,             // 50¢
        noAskPrice: 5000              // 50¢
    });
    
    // Step 4c: Initialize AMM for this market
    pricingAMM.createMarket(marketId, 0);
    // Creates market in PricingAMM with 0 initial liquidity
    
    // Step 4d: Emit event
    emit MarketCreated(marketId, msg.sender, _question, _category, _endTime);
    
    // Step 4e: Market creation fee is kept by contract (accumulates in contract balance)
    // No explicit transfer needed - ETH stays in contract
}
```

#### Step 5: Event & State Update

After the transaction is confirmed:

1. **Event Emitted**: `MarketCreated(marketId, creator, question, category, endTime)`
   - Frontend can listen to this event to detect new markets
   
2. **State Changes**:
   - `nextMarketId` increments (used for next market ID)
   - New market added to `markets` mapping
   - Market creation fee added to contract balance
   - AMM initialized with 0 liquidity (first trade will establish price)

3. **Market Available**:
   - Market appears in `getActiveMarkets()` immediately
   - Market data accessible via `getMarket(marketId)`
   - Frontend can fetch and display the market

#### Step 6: Frontend Redirect

```javascript
// After successful creation
toast.success('Market created successfully!');

// Reset form
setFormData({
  question: '',
  description: '',
  category: 'general',
  endDate: '',
  endTime: '',
  resolutionDate: '',
  resolutionTime: ''
});

// Redirect to markets list
history.push('/markets');
```

### Market Creation Fee

- **Default**: `0.01 ETH` (set in `deploy.js`)
- **Configurable**: Set during contract deployment
- **Read from contract**: `await contract.marketCreationFee()`
- **Paid by**: Admin wallet (must have sufficient ETH balance)
- **Stored**: Accumulates in contract balance (can be withdrawn by owner)

### Time Calculations

**Important**: All times are stored as **Unix timestamps** (seconds since Jan 1, 1970)

```javascript
// Frontend converts Date objects to Unix timestamps
const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
const endTime = Math.floor(endDateTime.getTime() / 1000);
// JavaScript gives milliseconds, divide by 1000 to get seconds

// Example:
// User selects: 2024-12-31 at 23:59
// endTime = 1735689540 (Unix timestamp in seconds)
```

**Timeline**:
- **`endTime`**: No new trades can be placed after this time
- **`resolutionTime`**: Market must be resolved by this time (via optimistic oracle)

---

## Revenue Dashboard

### Overview

The Revenue Dashboard (`/admin/revenue`) displays **100% on-chain data** fetched directly from the smart contract. No API calls or estimated data.

### Data Sources

All data comes from these on-chain sources:

1. **Contract Functions**:
   - `marketCreationFee()` → Current market creation fee
   - `platformFeePercent()` → Platform fee percentage (basis points)
   - `getActiveMarkets()` → Array of active market IDs
   - `getMarket(marketId)` → Market data including `totalVolume`

2. **Provider Queries**:
   - `provider.getBalance(contractAddress)` → Current contract ETH balance

### Metrics Calculated

#### 1. **Trading Fees**

```javascript
// Step 1: Get all active markets
const activeMarkets = await contracts.predictionMarket.getActiveMarkets();

// Step 2: Sum total volume from all markets
let totalVolume = ethers.BigNumber.from(0);
for (const marketId of activeMarkets) {
  const market = await contracts.predictionMarket.getMarket(marketId);
  totalVolume = totalVolume.add(market.totalVolume);
}

// Step 3: Get platform fee percentage
const platformFeePercent = await contracts.predictionMarket.platformFeePercent();
// Returns: 200 (for 2% fee in basis points)

// Step 4: Calculate trading fees
const tradingVolume = parseFloat(ethers.utils.formatEther(totalVolume));
// Example: totalVolume = 10 ETH → tradingVolume = 10.0

const platformFeeBasisPoints = platformFeePercent.toNumber(); // 200
const tradingFeesETH = tradingVolume * (platformFeeBasisPoints / 10000);
// Example: 10.0 * (200 / 10000) = 10.0 * 0.02 = 0.2 ETH
```

**Formula**: `Trading Fees = Total Volume × (Platform Fee % / 100)`

#### 2. **Market Creation Fees**

```javascript
// Step 1: Get market creation fee
const marketCreationFee = await contracts.predictionMarket.marketCreationFee();
// Returns: BigNumber in Wei (e.g., 10000000000000000 = 0.01 ETH)

// Step 2: Get number of markets
const activeMarkets = await contracts.predictionMarket.getActiveMarkets();
const totalMarkets = activeMarkets.length;

// Step 3: Calculate total creation fees collected
const marketCreationFeeETH = parseFloat(ethers.utils.formatEther(marketCreationFee));
// Example: 0.01 ETH

const totalMarketCreationFeesETH = marketCreationFeeETH * totalMarkets;
// Example: 0.01 ETH × 10 markets = 0.1 ETH
```

**Formula**: `Market Creation Fees = Market Creation Fee × Number of Markets`

#### 3. **Total Revenue**

```javascript
const totalRevenueETH = tradingFeesETH + totalMarketCreationFeesETH;
// Example: 0.2 ETH + 0.1 ETH = 0.3 ETH
```

**Formula**: `Total Revenue = Trading Fees + Market Creation Fees`

#### 4. **Contract Balance**

```javascript
const contractBalance = await provider.getBalance(contracts.predictionMarket.address);
// Returns: BigNumber in Wei

const contractBalanceETH = ethers.utils.formatEther(contractBalance);
// Example: "1.5" ETH
```

This is the **actual ETH balance** held by the contract (accumulated fees).

### Auto-Refresh

The dashboard refreshes every **10 seconds**:

```javascript
useEffect(() => {
  const fetchOnChainData = async () => {
    // Fetch all on-chain data
    // Update state
  };

  const interval = setInterval(fetchOnChainData, 10000); // 10 seconds
  fetchOnChainData(); // Initial fetch
  
  return () => clearInterval(interval); // Cleanup on unmount
}, [contracts, provider]);
```

### Displayed Metrics

1. **Total Markets**: Number of active markets (`activeMarkets.length`)
2. **Total Volume**: Sum of all market volumes (in ETH)
3. **Contract Balance**: Current contract ETH balance (in ETH)
4. **Platform Fee**: Percentage fee on trades (e.g., `2%`)
5. **Market Creation Fee**: Fee per market (e.g., `0.01 ETH`)
6. **Trading Fees**: Calculated from volume × platform fee (in ETH)
7. **Market Creation Fees**: Calculated from fee × markets (in ETH)
8. **Total Revenue**: Sum of trading fees + creation fees (in ETH)

### UI Components

- **Statistics Cards**: Total Markets, Total Volume, Contract Balance
- **Platform Settings**: Platform Fee %, Market Creation Fee
- **Total Revenue Card**: Large display of total revenue
- **Revenue Streams**: Trading Fees vs Market Creation Fees breakdown
- **Platform Statistics Table**: Detailed metrics by category
- **Refresh Button**: Manual data refresh

---

## Complete Admin Workflows

### Workflow 1: Admin Login & Market Creation

```
┌─────────────────────────────────────────────────────────┐
│ 1. Admin navigates to /admin                            │
│    → Sees AdminLogin component                          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Admin enters credentials                             │
│    → Username: "admin"                                  │
│    → Password: "admin123"                               │
│    → Clicks "Sign In"                                   │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Frontend validates credentials                        │
│    → Checks against hardcoded list                       │
│    → If valid:                                          │
│      • localStorage.setItem('usertype', 'admin')        │
│      • localStorage.setItem('username', 'admin')         │
│      • localStorage.setItem('isAdminLoggedIn', 'true') │
│    → Redirects to /admin/create-market                  │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 4. MarketCreation component loads                        │
│    → Checks localStorage for admin session              │
│    → If authenticated, shows form                       │
│    → If not, redirects to /admin                         │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Admin fills market creation form                     │
│    → Question: "Will Bitcoin reach $100k by 2024?"      │
│    → Description: "Market resolves YES if BTC..."      │
│    → Category: "crypto"                                  │
│    → End Date: 2024-12-31                               │
│    → End Time: 23:59                                     │
│    → Resolution Date: 2025-01-07                         │
│    → Resolution Time: 23:59                             │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Admin clicks "Create Market"                         │
│    → Frontend validates:                                │
│      • Wallet connected?                                │
│      • Question not empty?                              │
│      • End time in future?                              │
│      • Resolution time after end time?                  │
│    → If all valid, proceeds                            │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Frontend prepares blockchain call                    │
│    → Fetches marketCreationFee from contract            │
│    → Converts dates to Unix timestamps                  │
│    → Calls createMarket() with params                   │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 8. Smart contract processes                             │
│    → Validates fee payment                              │
│    → Validates timestamps                               │
│    → Creates Market struct                             │
│    → Initializes AMM                                    │
│    → Emits MarketCreated event                          │
│    → Stores market creation fee                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 9. Transaction confirmed                                 │
│    → Frontend shows success toast                       │
│    → Form resets                                        │
│    → Redirects to /markets                               │
│    → New market appears in list                          │
└─────────────────────────────────────────────────────────┘
```

### Workflow 2: View Revenue Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ 1. Admin navigates to /admin/revenue                     │
│    → Checks localStorage for admin session             │
│    → If authenticated, loads RevenueDashboard           │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. RevenueDashboard component mounts                     │
│    → useEffect triggers fetchOnChainData()              │
│    → Sets up 10-second interval                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Frontend fetches on-chain data                       │
│    → marketCreationFee()                                │
│    → platformFeePercent()                               │
│    → getActiveMarkets()                                 │
│    → getMarket() for each market (to get volume)        │
│    → provider.getBalance() (contract balance)           │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Frontend calculates metrics                          │
│    → Sums all market volumes                            │
│    → Calculates trading fees (volume × fee %)          │
│    → Calculates creation fees (fee × markets)          │
│    → Calculates total revenue                           │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 5. UI updates with real-time data                        │
│    → Displays all metrics in cards                      │
│    → Shows percentages and breakdowns                   │
│    → Updates every 10 seconds                           │
└─────────────────────────────────────────────────────────┘
```

### Workflow 3: Admin Logout

```
┌─────────────────────────────────────────────────────────┐
│ 1. Admin clicks "Logout" button                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Frontend clears localStorage                         │
│    → localStorage.removeItem('isAdminLoggedIn')         │
│    → localStorage.removeItem('usertype')                │
│    → localStorage.removeItem('username')                │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Redirects to /admin (login page)                       │
│    → Admin session ended                                 │
│    → Must login again to access admin features           │
└─────────────────────────────────────────────────────────┘
```

---

## Smart Contract Integration

### Contract Functions Used by Admin

#### 1. `createMarket()`

```solidity
function createMarket(
    string memory _question,
    string memory _description,
    string memory _category,
    uint256 _endTime,
    uint256 _resolutionTime
) external payable nonReentrant
```

**Parameters**:
- `_question`: Market question (string)
- `_description`: Market description (string)
- `_category`: Category (string, e.g., "crypto")
- `_endTime`: End time (Unix timestamp in seconds)
- `_resolutionTime`: Resolution time (Unix timestamp in seconds)

**Payment**: Must send `msg.value >= marketCreationFee`

**Returns**: No return value (creates market via side effects)

**Events**:
- `MarketCreated(uint256 indexed marketId, address indexed creator, string question, string category, uint256 endTime)`

**Frontend Call**:
```javascript
const tx = await contracts.predictionMarket.createMarket(
  question,
  description,
  category,
  endTime,
  resolutionTime,
  {
    value: marketCreationFee,  // ETH payment in Wei
    gasLimit: 1000000
  }
);
await tx.wait(); // Wait for confirmation
```

#### 2. `marketCreationFee()`

```solidity
function marketCreationFee() external view returns (uint256)
```

**Returns**: Market creation fee in Wei (e.g., `10000000000000000` = 0.01 ETH)

**Frontend Call**:
```javascript
const fee = await contracts.predictionMarket.marketCreationFee();
const feeETH = ethers.utils.formatEther(fee); // "0.01"
```

#### 3. `platformFeePercent()`

```solidity
function platformFeePercent() external view returns (uint256)
```

**Returns**: Platform fee in basis points (e.g., `200` = 2%)

**Frontend Call**:
```javascript
const feePercent = await contracts.predictionMarket.platformFeePercent();
const feePercentNumber = feePercent.toNumber(); // 200
const feePercentage = feePercentNumber / 100; // 2.0
```

#### 4. `getActiveMarkets()`

```solidity
function getActiveMarkets() external view returns (uint256[] memory)
```

**Returns**: Array of active market IDs

**Frontend Call**:
```javascript
const markets = await contracts.predictionMarket.getActiveMarkets();
// Returns: [0, 1, 2, 3, ...]
```

#### 5. `getMarket(uint256 _marketId)`

```solidity
function getMarket(uint256 _marketId) external view returns (
    uint256 id,
    string question,
    string description,
    string category,
    uint256 endTime,
    uint256 resolutionTime,
    bool resolved,
    uint8 outcome,
    uint256 totalYesShares,
    uint256 totalNoShares,
    uint256 totalVolume,
    address creator,
    uint256 createdAt,
    bool active,
    uint256 lastTradedPrice,
    uint256 yesBidPrice,
    uint256 yesAskPrice,
    uint256 noBidPrice,
    uint256 noAskPrice
)
```

**Returns**: Complete market data struct

**Frontend Call**:
```javascript
const market = await contracts.predictionMarket.getMarket(marketId);
const volume = market.totalVolume; // BigNumber in Wei
const volumeETH = ethers.utils.formatEther(volume); // "10.5"
```

### Provider Queries

#### 1. `provider.getBalance(address)`

```javascript
const balance = await provider.getBalance(contracts.predictionMarket.address);
// Returns: BigNumber in Wei

const balanceETH = ethers.utils.formatEther(balance);
// Example: "1.5" ETH
```

**Purpose**: Get current ETH balance of the contract (accumulated fees)

---

## Code Examples

### Example 1: Complete Market Creation

```javascript
// In MarketCreation.jsx

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // 1. Validate wallet connection
  if (!isConnected) {
    toast.error('Please connect your wallet first');
    return;
  }

  // 2. Validate form
  if (!formData.question.trim()) {
    toast.error('Question is required');
    return;
  }

  // 3. Calculate timestamps
  const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
  const resolutionDateTime = new Date(`${formData.resolutionDate}T${formData.resolutionTime}`);
  
  const endTime = Math.floor(endDateTime.getTime() / 1000);
  const resolutionTime = Math.floor(resolutionDateTime.getTime() / 1000);
  
  const now = Math.floor(Date.now() / 1000);
  
  // 4. Validate times
  if (endTime <= now) {
    toast.error('End time must be in the future');
    return;
  }
  
  if (resolutionTime <= endTime) {
    toast.error('Resolution time must be after end time');
    return;
  }

  // 5. Show loading state
  setIsLoading(true);
  toast.loading('Creating market...');
  
  try {
    // 6. Call createMarket function from useWeb3
    const receipt = await createMarket(
      formData.question,
      formData.description,
      formData.category,
      endTime,
      resolutionTime
    );

    // 7. Success
    toast.success('Market created successfully!');
    
    // 8. Reset form
    setFormData({
      question: '',
      description: '',
      category: 'general',
      endDate: '',
      endTime: '',
      resolutionDate: '',
      resolutionTime: ''
    });

    // 9. Redirect
    history.push('/markets');
  } catch (error) {
    console.error('Error creating market:', error);
    toast.error(error.message || 'Failed to create market');
  } finally {
    setIsLoading(false);
    toast.dismiss();
  }
};
```

### Example 2: Fetching Revenue Data

```javascript
// In RevenueDashboard.jsx

useEffect(() => {
  const fetchOnChainData = async () => {
    if (!contracts.predictionMarket || !provider) {
      return;
    }

    try {
      setLoading(true);
      
      // 1. Get contract settings
      const marketCreationFee = await contracts.predictionMarket.marketCreationFee();
      const platformFeePercent = await contracts.predictionMarket.platformFeePercent();
      
      // 2. Get contract balance
      const contractBalance = await provider.getBalance(
        contracts.predictionMarket.address
      );
      
      // 3. Get all markets
      const activeMarkets = await contracts.predictionMarket.getActiveMarkets();
      
      // 4. Sum total volume
      let totalVolume = ethers.BigNumber.from(0);
      for (const marketId of activeMarkets) {
        const market = await contracts.predictionMarket.getMarket(marketId);
        totalVolume = totalVolume.add(market.totalVolume);
      }
      
      // 5. Calculate fees
      const platformFeeBasisPoints = platformFeePercent.toNumber();
      const tradingVolume = parseFloat(ethers.utils.formatEther(totalVolume));
      const tradingFeesETH = tradingVolume * (platformFeeBasisPoints / 10000);
      
      const marketCreationFeeETH = parseFloat(ethers.utils.formatEther(marketCreationFee));
      const totalMarketCreationFeesETH = marketCreationFeeETH * activeMarkets.length;
      
      const totalRevenueETH = tradingFeesETH + totalMarketCreationFeesETH;
      
      // 6. Update state
      setRevenueData({
        tradingFees: tradingFeesETH,
        marketCreationFees: totalMarketCreationFeesETH,
        totalRevenue: totalRevenueETH,
        contractBalance: ethers.utils.formatEther(contractBalance),
        totalMarkets: activeMarkets.length,
        totalVolume: ethers.utils.formatEther(totalVolume),
        platformFee: platformFeeBasisPoints / 100,
        marketCreationFee: ethers.utils.formatEther(marketCreationFee)
      });
    } catch (error) {
      console.error('Error fetching on-chain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const interval = setInterval(fetchOnChainData, 10000);
  fetchOnChainData();
  
  return () => clearInterval(interval);
}, [contracts, provider]);
```

### Example 3: Admin Authentication Check

```javascript
// Pattern used in all admin pages

import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

const AdminPage = () => {
  const history = useHistory();
  
  // Check admin session
  const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn') === 'true';
  const usertype = localStorage.getItem('usertype');
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAdminLoggedIn || usertype !== 'admin') {
      history.push('/admin');
    }
  }, [history, isAdminLoggedIn, usertype]);
  
  // Early return if not authenticated
  if (!isAdminLoggedIn || usertype !== 'admin') {
    return (
      <div>Redirecting to admin login...</div>
    );
  }
  
  // Render admin content
  return (
    <div>Admin Content</div>
  );
};
```

---

## Security Considerations

### Current Security Model

1. **Frontend-Only Authentication**
   - Admin login is **client-side only**
   - Uses localStorage (can be cleared/modified)
   - No backend validation
   - Anyone can bypass by clearing localStorage or modifying code

2. **No On-Chain Admin Role**
   - Smart contract has **NO admin-only functions**
   - Anyone can call `createMarket()` if they pay the fee
   - No wallet address whitelist
   - No role-based access control (RBAC)

3. **Fee-Based Access**
   - Market creation requires paying `marketCreationFee`
   - This acts as **economic security** (spam prevention)
   - Only users with ETH can create markets

### Security Recommendations

For production, consider:

1. **Backend Authentication**
   - Implement server-side admin login
   - Use JWT tokens or session cookies
   - Validate admin status on backend

2. **On-Chain Admin Role**
   ```solidity
   mapping(address => bool) public admins;
   
   modifier onlyAdmin() {
       require(admins[msg.sender], "Not admin");
       _;
   }
   
   function createMarket(...) external payable onlyAdmin {
       // Only admins can create markets
   }
   ```

3. **Multisig Admin**
   - Require multiple admin signatures for critical operations
   - Use a multisig wallet for admin functions

4. **Rate Limiting**
   - Limit markets per admin per day
   - Prevent spam market creation

5. **Input Validation**
   - ✅ Currently validates timestamps (good)
   - ✅ Currently validates question length (good)
   - ⚠️ Consider max length for strings
   - ⚠️ Consider category validation

6. **Access Control Logging**
   - Log all admin actions
   - Monitor unauthorized access attempts

---

## Summary

### Admin System Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React)                                         │
│  ├─ AdminLogin.jsx (Authentication UI)                 │
│  ├─ MarketCreation.jsx (Market Form)                    │
│  └─ RevenueDashboard.jsx (Metrics Display)             │
└─────────────────────────────────────────────────────────┘
                      ↓
              localStorage (Session)
                      ↓
┌─────────────────────────────────────────────────────────┐
│ useWeb3 Hook                                            │
│  ├─ Wallet Connection (MetaMask, etc.)                  │
│  ├─ Contract Interaction                                │
│  └─ createMarket() function                             │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Smart Contract (ETHPredictionMarket.sol)                │
│  ├─ createMarket() function                             │
│  ├─ marketCreationFee() view                           │
│  ├─ platformFeePercent() view                          │
│  ├─ getActiveMarkets() view                             │
│  └─ getMarket() view                                    │
└─────────────────────────────────────────────────────────┘
```

### Key Points

1. **Admin authentication is frontend-only** (localStorage-based)
2. **No on-chain admin role** - anyone can create markets by paying fee
3. **Market creation requires**:
   - Admin login (frontend)
   - Wallet connection
   - ETH for market creation fee
   - Valid form data
4. **Revenue dashboard** fetches 100% on-chain data (no API)
5. **All data is real-time** and updates every 10 seconds
6. **Market creation fee** accumulates in contract balance
7. **Platform fee** is applied on every trade automatically

### Default Admin Credentials

- **Username**: `admin` | Password: `admin123`
- **Username**: `administrator` | Password: `admin`

### Admin Routes

- `/admin` → Login page
- `/admin/create-market` → Market creation form
- `/admin/revenue` → Revenue dashboard

---

**End of Documentation**

