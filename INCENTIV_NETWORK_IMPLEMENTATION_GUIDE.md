# 🎓 Complete Guide: How We Implemented Incentiv Network

## 📚 Table of Contents
1. [Overview](#overview)
2. [Step-by-Step Implementation](#step-by-step-implementation)
3. [Smart Contract Deployment](#smart-contract-deployment)
4. [Frontend Configuration](#frontend-configuration)
5. [Backend Configuration](#backend-configuration)
6. [Key Concepts](#key-concepts)
7. [Troubleshooting](#troubleshooting)
8. [Testing Guide](#testing-guide)

---

## 🎯 Overview

### What is Incentiv Network?
- **Incentiv Testnet** is a blockchain testnet (testing network)
- **Chain ID**: 28802
- **Native Currency**: TCENT (test tokens)
- **RPC URL**: https://rpc-testnet.incentiv.io/
- **Explorer**: https://explorer-testnet.incentiv.io

### What We Built
A **prediction market platform** where users can:
- Create markets about future events
- Buy/Sell YES/NO shares using TCENT
- Trade using native TCENT tokens (no ERC20 tokens)

---

## 🔧 Step-by-Step Implementation

### Phase 1: Network Setup

#### 1.1 Add Incentiv Testnet to MetaMask
```javascript
Network Name: Incentiv Testnet
RPC URL: https://rpc-testnet.incentiv.io/
Chain ID: 28802
Currency Symbol: TCENT
Block Explorer: https://explorer-testnet.incentiv.io
```

**How to add:**
1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Fill in the details above
4. Save and switch to Incentiv Testnet

#### 1.2 Get Testnet Tokens
- Visit: https://testnet.incentiv.io
- Click "Get Free Tokens"
- Receive 100 TCENT for testing

---

### Phase 2: Smart Contract Deployment

#### 2.1 Configure Hardhat for Incentiv

**File: `contracts/hardhat.config.js`**
```javascript
module.exports = {
  networks: {
    incentiv: {
      url: "https://rpc-testnet.incentiv.io/",
      accounts: [process.env.PRIVATE_KEY],  // Your private key
      chainId: 28802,
      gasPrice: 20000000000, // 20 gwei
    }
  }
};
```

**What this does:**
- Tells Hardhat how to connect to Incentiv network
- Uses your private key to deploy contracts
- Sets the correct chain ID (28802)

#### 2.2 Configure Environment Variables

**File: `contracts/.env`**
```bash
PRIVATE_KEY=0xe516ae4914310bca210e71786c48fafda9aed07457654f649f32576746b5120c
```

**⚠️ Security Note:**
- This is a testnet key only
- Never use testnet keys for mainnet
- Never commit .env files to git
- Keep mainnet keys in hardware wallets

#### 2.3 Update Deployment Script

**File: `contracts/scripts/deploy.js`**
```javascript
// Check if we're on Incentiv Testnet
if (network.chainId === 28802) {
  // Incentiv Testnet - uses native TCENT tokens, no USDC needed
  usdcAddress = ethers.constants.AddressZero;
  console.log("✅ Using native TCENT tokens (no USDC needed)");
}
```

**Why this matters:**
- Incentiv uses **native TCENT** tokens
- No need for ERC20 tokens like USDC
- All transactions use TCENT directly

#### 2.4 Deploy Contracts

**Command:**
```bash
cd contracts
npm run deploy:incentiv
```

**What happens:**
1. Connects to Incentiv Testnet via RPC
2. Uses your private key to sign deployment transactions
3. Deploys `ETHPredictionMarket` contract
4. Pays gas fees in TCENT
5. Returns deployed contract address

**Our Deployed Contract:**
```
ETHPredictionMarket: 0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
Network: Incentiv Testnet (28802)
Deployer: 0xed27C34A8434ADc188A2D7503152024F64967B61
```

---

### Phase 3: Frontend Configuration

#### 3.1 Update Contract Config

**File: `frontend/src/contracts/config.js`**
```javascript
export const PREDICTION_MARKET_ADDRESS = "0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40";
export const CHAIN_ID = 28802;
export const NETWORK_NAME = "Incentiv Testnet";
```

**What this does:**
- Tells frontend which contract to interact with
- Sets the expected network (28802)
- Displays correct network name

#### 3.2 Add Network Support in Web3 Hook

**File: `frontend/src/hooks/useWeb3.jsx`**
```javascript
// Contract addresses for each network
const CONTRACT_ADDRESSES = {
  1337: { /* Hardhat Local */ },
  28802: {  // Incentiv Testnet
    ETH_PREDICTION_MARKET: PREDICTION_MARKET_ADDRESS,
    PRICING_AMM: "0x0000000000000000000000000000000000000000",
  }
};

// Network names
const getNetworkName = (chainId) => {
  switch (chainId) {
    case 28802: return 'Incentiv Testnet';
    case 1337: return 'Hardhat Local';
    default: return `Chain ${chainId}`;
  }
};
```

**What this does:**
- Maps chain IDs to contract addresses
- Provides user-friendly network names
- Supports multiple networks

#### 3.3 Add Network Auto-Switching

**File: `frontend/src/hooks/useWeb3.jsx`**
```javascript
const addNetwork = useCallback(async (targetChainId = CHAIN_ID) => {
  const networkConfigs = {
    28802: {
      chainId: '0x7082',  // 28802 in hex
      chainName: 'Incentiv Testnet',
      nativeCurrency: { 
        name: 'TCENT', 
        symbol: 'TCENT', 
        decimals: 18 
      },
      rpcUrls: ['https://rpc-testnet.incentiv.io/'],
      blockExplorerUrls: ['https://explorer-testnet.incentiv.io'],
    }
  };
  
  // Try to switch, or add if doesn't exist
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [config],
      });
    }
  }
}, []);
```

**What this does:**
- Automatically prompts user to add Incentiv network
- Switches to correct network when connecting
- No manual network setup needed

#### 3.4 Create Currency Utility

**File: `frontend/src/utils/currency.js`**
```javascript
export const getCurrencySymbol = (chainId = CHAIN_ID) => {
  switch (chainId) {
    case 28802: return 'TCENT';  // Incentiv Testnet
    case 1337: return 'ETH';      // Hardhat Local
    default: return 'ETH';
  }
};
```

**What this does:**
- Shows "TCENT" on Incentiv Testnet
- Shows "ETH" on Hardhat Local
- Updates dynamically when network changes

#### 3.5 Update All UI Components

**Updated Files:**
- `ModernNavbar.jsx` - Balance display
- `Web3TradingInterface.jsx` - Trading amounts
- `MarketCreation.jsx` - Creation fees
- `User.jsx` - User stats
- `RevenueDashboard.jsx` - Revenue metrics

**Example:**
```javascript
const { chainId } = useWeb3();
const currencySymbol = getCurrencySymbol(chainId);

return (
  <div>Balance: {balance} {currencySymbol}</div>
);
```

**Result:**
- On Incentiv: "Balance: 4242.45 TCENT"
- On Hardhat: "Balance: 9999.94 ETH"

---

### Phase 4: Backend Configuration

#### 4.1 Update Environment Variables

**File: `.env`**
```bash
# Network Configuration - Incentiv Testnet
CHAIN_ID=28802
RPC_URL=https://rpc-testnet.incentiv.io/

# Smart Contract Addresses
PREDICTION_MARKET_ADDRESS=0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40

# Settlement Private Key (for executing trades)
SETTLEMENT_PRIVATE_KEY=0xe516ae4914310bca210e71786c48fafda9aed07457654f649f32576746b5120c

# Treasury Address (receives fees)
TREASURY_ADDRESS=0xed27C34A8434ADc188A2D7503152024F64967B61
```

**Why each variable:**
- `CHAIN_ID`: Backend verifies signatures with this
- `RPC_URL`: Backend connects to blockchain
- `PREDICTION_MARKET_ADDRESS`: Contract to interact with
- `SETTLEMENT_PRIVATE_KEY`: Executes trades on-chain
- `TREASURY_ADDRESS`: Receives platform fees

#### 4.2 Update Trading Components

**File: `frontend/src/components/trading/Web3TradingInterface.jsx`**

**Before (WRONG):**
```javascript
const CHAIN_ID = 1337;  // ❌ Hardcoded!
const signature = await signOrder(order, CHAIN_ID, ...);
```

**After (CORRECT):**
```javascript
const { chainId } = useWeb3();  // ✅ Dynamic!
const signature = await signOrder(order, chainId, ...);
```

**Why this matters:**
- EIP-712 signatures include chain ID
- Frontend and backend must use same chain ID
- If they don't match, signature verification fails

---

## 🔑 Key Concepts

### 1. Chain ID
**What is it?**
- Unique identifier for each blockchain network
- Prevents replay attacks across networks
- Required for EIP-712 signatures

**Common Chain IDs:**
- 1 = Ethereum Mainnet
- 1337 = Hardhat Local
- 28802 = Incentiv Testnet
- 80002 = Polygon Amoy Testnet

### 2. EIP-712 Signatures
**What is it?**
- Standard for typed data signing
- Makes signatures human-readable
- Includes domain separator with chain ID

**Structure:**
```javascript
{
  domain: {
    name: 'Exchange',
    version: '1',
    chainId: 28802,  // ← Must match network!
    verifyingContract: '0x...'
  },
  message: {
    maker: '0x...',
    price: '5000',
    size: '100',
    // ... order data
  }
}
```

**Why it matters:**
- MetaMask validates chain ID matches network
- Backend verifies signature using same chain ID
- Mismatch = signature invalid

### 3. Native vs ERC20 Tokens

**Native Tokens (TCENT):**
- Built into the blockchain
- No contract address needed
- Transferred directly in transactions
- Used for gas fees
- Example: `msg.value` in Solidity

**ERC20 Tokens (USDC):**
- Smart contracts on the blockchain
- Have their own contract address
- Require `transfer()` function calls
- Cannot be used for gas fees
- Example: USDC, DAI, USDT

**Our Implementation:**
```solidity
// ETHPredictionMarket uses native tokens
function buyShares(uint256 marketId, bool isYes) 
  payable  // ← Accepts native TCENT
{
  uint256 amount = msg.value;  // Amount of TCENT sent
  // ... buy shares
}
```

### 4. RPC (Remote Procedure Call)
**What is it?**
- API endpoint to interact with blockchain
- Lets you read/write blockchain data
- Required for all blockchain operations

**Our RPC:**
- URL: `https://rpc-testnet.incentiv.io/`
- Used by: Frontend (MetaMask), Backend (Ethers.js), Hardhat

**What it does:**
- Send transactions
- Read contract data
- Get account balances
- Query blockchain state

---

## 🐛 Troubleshooting

### Problem 1: "Provided chainId '1337' must match active chainId '28802'"

**Cause:**
- Frontend signing with wrong chain ID
- Hardcoded `CHAIN_ID = 1337` in trading component

**Solution:**
```javascript
// ❌ Wrong
const CHAIN_ID = 1337;

// ✅ Correct
const { chainId } = useWeb3();
```

### Problem 2: "Invalid signature" (401 Error)

**Cause:**
- Backend verifying with wrong chain ID
- `.env` file has `CHAIN_ID=1337`

**Solution:**
1. Update `.env`: `CHAIN_ID=28802`
2. Restart backend server
3. Clear browser cache

### Problem 3: "No contract deployed at address"

**Cause:**
- Wrong contract address
- Not deployed on Incentiv Testnet

**Solution:**
1. Deploy contract: `npm run deploy:incentiv`
2. Copy deployed address
3. Update `config.js` with new address
4. Restart frontend

### Problem 4: "Insufficient balance"

**Cause:**
- Not enough TCENT tokens

**Solution:**
1. Visit https://testnet.incentiv.io
2. Click "Get Free Tokens"
3. Receive 100 TCENT
4. Check balance in MetaMask

---

## 🧪 Testing Guide

### Test 1: Verify Network Connection

**Check Frontend:**
```javascript
// Open browser console
console.log('Chain ID:', await window.ethereum.request({ 
  method: 'eth_chainId' 
}));
// Expected: "0x7082" (28802 in hex)
```

**Check Backend:**
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
grep CHAIN_ID .env
# Expected: CHAIN_ID=28802
```

### Test 2: Verify Contract Deployment

**Visit Explorer:**
```
https://explorer-testnet.incentiv.io/address/0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
```

**Should see:**
- Contract bytecode
- Transaction history
- Contract creator

### Test 3: Create a Market

**Steps:**
1. Go to Admin → Create Market
2. Fill in market details
3. Click "Create Market"
4. Sign transaction (pays 0.01 TCENT)
5. Wait for confirmation

**Expected:**
- Toast: "Market created successfully!"
- New market appears on home page
- Transaction on block explorer

### Test 4: Buy Shares

**Steps:**
1. Go to a market page
2. Select YES or NO
3. Enter amount (e.g., 100 TCENT)
4. Click "Buy"
5. Sign the order
6. Wait for execution

**Expected:**
- Console: "Order signed"
- Backend: Status 200 or 201
- Shares appear in position
- Balance decreases

### Test 5: Sell Shares

**Steps:**
1. Go to a market where you have shares
2. Switch to "Sell" tab
3. Enter amount of shares
4. Click "Sell"
5. Sign the order

**Expected:**
- Shares decrease
- TCENT balance increases
- Transaction confirmed

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           Incentiv Testnet                  │
│   Chain ID: 28802 | Currency: TCENT         │
└─────────────────────────────────────────────┘
                    ↑
                    │ RPC: https://rpc-testnet.incentiv.io/
                    │
    ┌───────────────┴───────────────┐
    │                               │
┌───▼───────┐              ┌────────▼────────┐
│  Frontend │              │     Backend     │
│  (React)  │◄────────────►│   (Node.js)     │
└───────────┘   HTTP/WS    └─────────────────┘
    │                              │
    │ Web3                         │ Ethers.js
    │ (via MetaMask)               │
    │                              │
    ▼                              ▼
┌─────────────────────────────────────────────┐
│          Smart Contract                     │
│  ETHPredictionMarket                        │
│  0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40│
└─────────────────────────────────────────────┘
```

**Flow:**
1. User connects MetaMask to Incentiv Testnet
2. Frontend gets chain ID (28802) from MetaMask
3. User signs order with chain ID 28802
4. Backend receives order
5. Backend verifies signature with chain ID 28802
6. Backend executes trade on smart contract
7. Smart contract transfers TCENT tokens

---

## 📝 Files Modified

### Smart Contracts
- ✅ `contracts/hardhat.config.js` - Added Incentiv network
- ✅ `contracts/.env` - Added private key and chain ID
- ✅ `contracts/scripts/deploy.js` - Added Incentiv support
- ✅ `contracts/package.json` - Added deploy:incentiv script

### Frontend
- ✅ `frontend/src/contracts/config.js` - Updated contract address
- ✅ `frontend/src/hooks/useWeb3.jsx` - Added network support
- ✅ `frontend/src/utils/currency.js` - Created currency utility
- ✅ `frontend/src/components/modern/ModernNavbar.jsx` - Updated UI
- ✅ `frontend/src/components/trading/Web3TradingInterface.jsx` - Fixed chain ID
- ✅ `frontend/src/pages/admin/MarketCreation.jsx` - Updated currency
- ✅ `frontend/src/pages/user/User.jsx` - Updated stats
- ✅ `frontend/src/components/admin/RevenueDashboard.jsx` - Updated metrics

### Backend
- ✅ `.env` - Updated chain ID and RPC URL
- ✅ `api/orders.js` - Uses CHAIN_ID from env

---

## 🎓 Key Takeaways

### 1. Chain ID is Critical
- Must match everywhere (frontend, backend, network)
- Used in signature verification
- Prevents cross-network attacks

### 2. Environment Variables
- Use `.env` files for configuration
- Never commit private keys
- Restart servers after changes

### 3. Native Token Benefits
- Simpler than ERC20 tokens
- No token contract needed
- Users already have TCENT
- Less transaction steps

### 4. Testing Workflow
1. Deploy to testnet first
2. Test all functionality
3. Fix bugs on testnet
4. Deploy to mainnet when ready

### 5. Network Switching
- MetaMask can add networks programmatically
- User-friendly auto-configuration
- No manual network setup

---

## 🚀 Next Steps

### For Development:
1. Test all features on Incentiv Testnet
2. Add more market categories
3. Implement limit orders
4. Add price charts
5. Implement market resolution

### For Production:
1. Audit smart contracts
2. Deploy to Incentiv Mainnet
3. Update frontend config
4. Update backend config
5. Monitor and maintain

---

## 📚 Resources

### Official Documentation
- Incentiv Docs: https://docs.incentiv.io/docs/developers/contracts
- Hardhat Docs: https://hardhat.org/docs
- Ethers.js Docs: https://docs.ethers.org/
- EIP-712 Spec: https://eips.ethereum.org/EIPS/eip-712

### Network Info
- Testnet Faucet: https://testnet.incentiv.io
- Block Explorer: https://explorer-testnet.incentiv.io
- RPC URL: https://rpc-testnet.incentiv.io/

### Your Deployment
- Contract: 0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
- Deployer: 0xed27C34A8434ADc188A2D7503152024F64967B61
- Network: Incentiv Testnet (28802)

---

**🎉 Congratulations! You now understand how we implemented Incentiv Network support!**

This guide covers everything from network setup to smart contract deployment to frontend/backend configuration. You can use this as a reference for future blockchain integrations!

