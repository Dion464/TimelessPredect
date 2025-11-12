# Create Environment Files

Since `.env` files can't be auto-created, follow these steps to set them up manually.

---

## Step 1: Create Backend `.env` File

**Location:** `TimelessPredect/.env`

Create this file with the following content:

```bash
# Exchange Contract (deploy first, then add address here)
EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Blockchain Configuration
CHAIN_ID=1337
RPC_URL=http://localhost:8545

# Settlement (Relayer Account)
# Use Hardhat account 0 for localhost:
# Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
SETTLEMENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Token Addresses (optional - leave as zero for now)
PAYMENT_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
OUTCOME_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000

# Server Configuration
PORT=8080
API_BASE_URL=http://localhost:8080

# Database (if using)
DATABASE_URL=postgresql://user:password@localhost:5432/timelesspredect
```

**After deploying Exchange contract, update:**
- `EXCHANGE_CONTRACT_ADDRESS` with the deployed address
- `SETTLEMENT_PRIVATE_KEY` if using a different account

---

## Step 2: Create Frontend `.env` File

**Location:** `TimelessPredect/frontend/.env`

Create this file with the following content:

```bash
# Exchange Contract Address (same as backend after deployment)
VITE_EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Blockchain Configuration
VITE_CHAIN_ID=1337

# API Base URL
VITE_API_BASE_URL=http://localhost:8080

# Prediction Market Contract (if different)
VITE_PREDICTION_MARKET_ADDRESS=0x0000000000000000000000000000000000000000
```

**After deploying Exchange contract, update:**
- `VITE_EXCHANGE_CONTRACT_ADDRESS` with the deployed address (same as backend)

---

## Quick Commands

**Create backend .env:**
```bash
cat > .env << 'EOF'
EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
CHAIN_ID=1337
RPC_URL=http://localhost:8545
SETTLEMENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PAYMENT_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
OUTCOME_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
PORT=8080
API_BASE_URL=http://localhost:8080
EOF
```

**Create frontend .env:**
```bash
cd frontend
cat > .env << 'EOF'
VITE_EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_CHAIN_ID=1337
VITE_API_BASE_URL=http://localhost:8080
EOF
```

---

## Important Notes

⚠️ **Never commit `.env` files to git!** They contain sensitive information.

Make sure `.gitignore` includes:
```
.env
frontend/.env
*.env
```

---

## After Deployment

1. Deploy Exchange contract (see `SETUP_EXCHANGE.md`)
2. Copy the contract address from deployment output
3. Update `EXCHANGE_CONTRACT_ADDRESS` in both `.env` files
4. Restart services

---

## Verification

After creating files, verify they exist:

```bash
# Backend
ls -la .env

# Frontend
ls -la frontend/.env
```

Both should show the files exist.

