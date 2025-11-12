# Backend Chain ID Configuration - IMPORTANT! ⚠️

## 🐛 The Real Problem

The backend API server was using **Chain ID 1337** (Hardhat Local) to verify signatures, but your frontend is signing orders with **Chain ID 28802** (Incentiv Testnet).

### Error Flow:
1. ✅ Frontend signs order with Chain ID **28802** (correct)
2. ❌ Backend verifies signature with Chain ID **1337** (wrong!)
3. ❌ Signature verification fails → "Invalid signature" error

---

## ✅ Solution Applied

I've updated your `.env` file to use **Incentiv Testnet** configuration:

### Updated `.env` File:
```bash
# Network Configuration - Incentiv Testnet
CHAIN_ID=28802
RPC_URL=https://rpc-testnet.incentiv.io/

# Smart Contract Addresses - Incentiv Testnet
PREDICTION_MARKET_ADDRESS=0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40

# Settlement Configuration - Your Incentiv Testnet Private Key
SETTLEMENT_PRIVATE_KEY=0xe516ae4914310bca210e71786c48fafda9aed07457654f649f32576746b5120c

# Treasury Address - Your Incentiv Testnet Address
TREASURY_ADDRESS=0xed27C34A8434ADc188A2D7503152024F64967B61
```

---

## 🚀 **RESTART YOUR BACKEND SERVER**

**CRITICAL:** You must restart the backend API server for the changes to take effect!

### Option 1: If running in terminal
1. Find the terminal running the backend
2. Press `Ctrl+C` to stop it
3. Restart with:
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js
```

### Option 2: If running as a background process
```bash
# Kill the old process
pkill -f "api-server"

# Start the new one
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js &
```

### Option 3: Using the start script
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
./start-backend.sh
```

---

## 🧪 How to Verify It's Working

After restarting the backend, check the logs. You should see:
```
🔍 Verifying signature: { chainId: 28802, ... }
```

NOT:
```
🔍 Verifying signature: { chainId: 1337, ... }
```

---

## 📝 What Changed

### Before:
- **Frontend**: Signs with Chain ID 28802 ✅
- **Backend**: Verifies with Chain ID 1337 ❌
- **Result**: Signature mismatch → Error

### After:
- **Frontend**: Signs with Chain ID 28802 ✅
- **Backend**: Verifies with Chain ID 28802 ✅
- **Result**: Signature match → Success! 🎉

---

## ⚠️ Important Notes

1. **Backend MUST be restarted** - The .env file is only read on startup
2. **Chain IDs must match** - Frontend and backend must use the same chain ID
3. **Contract address updated** - Now points to your Incentiv deployment
4. **Private key configured** - Uses your Incentiv testnet key for settlements

---

## 🎯 After Restart

1. **Refresh your browser** (hard refresh: Cmd+Shift+R)
2. **Try buying shares again**
3. **It should work now!** ✅

The signature verification should now pass because both frontend and backend are using Chain ID 28802!

