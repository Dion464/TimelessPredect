# ⚡ Quick Commands Reference

## 🎯 Common Tasks

### 1. Add Liquidity to Markets
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect/contracts
npx hardhat run scripts/add-liquidity.js --network incentiv
```

### 2. Create New Markets
```bash
npx hardhat run scripts/create-real-markets.js --network incentiv
```

### 3. Delete All Markets (Reset)
```bash
npx hardhat run scripts/delete-all-markets.js --network incentiv
```

### 4. Deploy Contracts
```bash
npm run deploy:incentiv
```

### 5. Check Connection
```bash
npx hardhat run scripts/test-incentiv-connection.js --network incentiv
```

---

## 🔄 Complete Workflow

### Fresh Start (New Deployment)
```bash
# 1. Deploy contract
cd contracts
npm run deploy:incentiv

# 2. Create markets
npx hardhat run scripts/create-real-markets.js --network incentiv

# 3. Add liquidity
npx hardhat run scripts/add-liquidity.js --network incentiv

# 4. Start backend
cd ..
node api-server.js

# 5. Start frontend (in new terminal)
cd frontend
npm run dev
```

### Reset Everything
```bash
# 1. Delete all markets
cd contracts
npx hardhat run scripts/delete-all-markets.js --network incentiv

# 2. Create new markets
npx hardhat run scripts/create-real-markets.js --network incentiv

# 3. Add liquidity again
npx hardhat run scripts/add-liquidity.js --network incentiv
```

### Just Add More Liquidity
```bash
cd contracts
npx hardhat run scripts/add-liquidity.js --network incentiv
```

---

## 📊 Backend Commands

### Start Backend
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js
```

### Start Backend in Background
```bash
node api-server.js > api-server.log 2>&1 &
```

### Stop Backend
```bash
# Find process
lsof -ti:8080

# Kill it (replace PID)
kill <PID>
```

### View Backend Logs
```bash
tail -f api-server.log
```

---

## 🎨 Frontend Commands

### Start Frontend
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect/frontend
npm run dev
```

### Build Frontend
```bash
npm run build
```

### Check for Errors
```bash
npm run lint
```

---

## 🔍 Debugging Commands

### Check Your Balance
```bash
# In Hardhat console
npx hardhat console --network incentiv

# Then run:
const balance = await ethers.provider.getBalance("YOUR_ADDRESS");
console.log(ethers.utils.formatEther(balance));
```

### Check Market State
```bash
# Create script to check
npx hardhat run scripts/check-markets.js --network incentiv
```

### View Contract on Explorer
```
https://explorer-testnet.incentiv.io/address/0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
```

---

## 💰 Get TCENT Tokens

### From Faucet
```
1. Visit: https://testnet.incentiv.io
2. Connect wallet
3. Click "Get Free Tokens"
4. Receive 100 TCENT
```

---

## 🛠️ Environment Setup

### Update Backend Chain ID
```bash
# Edit .env
nano .env

# Change:
CHAIN_ID=28802

# Restart backend
node api-server.js
```

### Update Contract Address
```bash
# Edit frontend config
nano frontend/src/contracts/config.js

# Update:
export const PREDICTION_MARKET_ADDRESS = "0x...";
```

---

## 🚀 One-Line Commands

```bash
# Deploy + Create + Add Liquidity
cd contracts && npm run deploy:incentiv && npx hardhat run scripts/create-real-markets.js --network incentiv && npx hardhat run scripts/add-liquidity.js --network incentiv

# Start Everything
cd /Users/zs/Desktop/tmlspredict/TimelessPredect && node api-server.js & cd frontend && npm run dev

# Reset Markets
cd contracts && npx hardhat run scripts/delete-all-markets.js --network incentiv && npx hardhat run scripts/create-real-markets.js --network incentiv && npx hardhat run scripts/add-liquidity.js --network incentiv
```

---

## 📝 Custom Liquidity Amount

### Edit add-liquidity.js
```bash
nano contracts/scripts/add-liquidity.js

# Find this line:
const liquidityPerMarket = ethers.utils.parseEther("100");

# Change to your desired amount:
const liquidityPerMarket = ethers.utils.parseEther("500"); // 500 TCENT
```

### Add to Specific Market
```javascript
// Edit script to target one market
const marketId = 1;
const liquidityAmount = ethers.utils.parseEther("200");
```

---

## 🎯 Production Deployment

### Deploy to Mainnet
```bash
# 1. Update .env with mainnet keys
PRIVATE_KEY=your_mainnet_key
CHAIN_ID=mainnet_chain_id

# 2. Deploy
npm run deploy:mainnet

# 3. Verify on explorer
npx hardhat verify --network mainnet CONTRACT_ADDRESS
```

---

## 📦 Package Management

### Install Dependencies
```bash
# Backend
npm install

# Frontend
cd frontend && npm install

# Contracts
cd contracts && npm install
```

### Update Packages
```bash
npm update
```

---

## 🔐 Security

### Generate New Private Key
```bash
# Using Hardhat
npx hardhat node
# Copy one of the private keys

# Or use MetaMask
# Create new account → Export private key
```

### Backup Important Files
```bash
# Backup .env
cp .env .env.backup

# Backup deployment info
cp contracts/deployments/incentiv-28802.json deployments.backup.json
```

---

## 📊 Monitoring

### Check Active Markets
```bash
npx hardhat run scripts/check-markets-direct.js --network incentiv
```

### View Recent Trades
```bash
# Check database
sqlite3 prisma/dev.db "SELECT * FROM Trade ORDER BY timestamp DESC LIMIT 10;"
```

### Check Backend Health
```bash
curl http://localhost:8080/api/orders?marketId=1&outcomeId=0
```

---

**Save this file for quick reference!** 🚀

