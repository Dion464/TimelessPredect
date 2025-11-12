# Incentiv Testnet Deployment Guide

## 🎉 Deployment Complete!

Your prediction market smart contracts have been successfully deployed to the **Incentiv Testnet** using native **TCENT** tokens.

---

## 📋 Deployment Information

### Contract Addresses
- **ETHPredictionMarket**: `0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40`
- **Network**: Incentiv Testnet
- **Chain ID**: 28802
- **Currency**: TCENT (native token)
- **Deployer Address**: `0xed27C34A8434ADc188A2D7503152024F64967B61`

### Contract Configuration
- **Market Creation Fee**: 0.01 TCENT
- **Platform Fee**: 2% (200 basis points)
- **Token Type**: Native TCENT (no ERC20 tokens)

---

## 🔗 Network Details

### Incentiv Testnet
- **Network Name**: Incentiv Testnet
- **RPC URL**: https://rpc-testnet.incentiv.io/
- **Chain ID**: 28802
- **Currency Symbol**: TCENT
- **Block Explorer**: https://explorer-testnet.incentiv.io

### Add to MetaMask
The frontend will automatically prompt you to add the Incentiv Testnet to MetaMask when you connect your wallet.

Manual configuration:
1. Open MetaMask → Settings → Networks → Add Network
2. Fill in the details above
3. Save and switch to Incentiv Testnet

---

## 🔐 Private Key Configuration

Your private key has been configured in:
```
/Users/zs/Desktop/tmlspredict/TimelessPredect/contracts/.env
```

**⚠️ SECURITY WARNING**: 
- Never commit the `.env` file to version control
- Keep your private key secure
- This is a testnet key - never use it for mainnet

---

## 🚀 Frontend Configuration

The frontend has been updated to support Incentiv Testnet:

### Updated Files
1. **`frontend/src/contracts/config.js`**
   - Contract address: `0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40`
   - Chain ID: 28802
   - Network name: Incentiv Testnet

2. **`frontend/src/hooks/useWeb3.jsx`**
   - Added Incentiv Testnet support (Chain ID: 28802)
   - Added automatic network switching
   - Currency display shows "TCENT" instead of "ETH"

3. **`frontend/src/components/modern/ModernNavbar.jsx`**
   - Balance display shows correct currency (TCENT/ETH) based on network

### Supported Networks
The frontend now supports:
- **Hardhat Local** (Chain ID: 1337/31337) - Uses ETH
- **Incentiv Testnet** (Chain ID: 28802) - Uses TCENT

---

## 🎮 How to Use

### 1. Start the Frontend
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect/frontend
npm run dev
```

### 2. Connect Your Wallet
- Click "Connect Wallet" in the navbar
- MetaMask will prompt you to add/switch to Incentiv Testnet
- Approve the network addition
- Your wallet will connect automatically

### 3. Get Testnet Tokens
If you need more TCENT tokens:
- Visit: https://testnet.incentiv.io
- Click "Get Free Tokens"
- You'll receive 100 TCENT for testing

### 4. Create Markets
- Navigate to Admin → Create Market
- Fill in market details
- Pay 0.01 TCENT creation fee
- Market will be created on Incentiv Testnet

### 5. Trade on Markets
- Browse markets on the home page
- Click on a market to view details
- Buy YES or NO shares using TCENT
- All transactions use native TCENT tokens

---

## 📊 Verify Your Deployment

### View Contract on Explorer
```
https://explorer-testnet.incentiv.io/address/0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40
```

### Check Your Balance
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect/contracts
npx hardhat run scripts/test-incentiv-connection.js --network incentiv
```

---

## 🛠️ Deployment Commands

### Deploy to Incentiv Testnet
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect/contracts
npm run deploy:incentiv
```

### Test Connection
```bash
npx hardhat run scripts/test-incentiv-connection.js --network incentiv
```

### Delete All Markets
```bash
npx hardhat run scripts/delete-all-markets.js --network incentiv
```

---

## 📝 Important Notes

### No Mock Tokens
- The deployment uses **native TCENT tokens only**
- No Mock USDC or other ERC20 tokens are deployed
- All transactions are in TCENT

### Contract Features
- ✅ Market creation with TCENT fee
- ✅ Buy/Sell shares with TCENT
- ✅ Limit orders with TCENT
- ✅ Claim winnings in TCENT
- ✅ Platform fees collected in TCENT

### Gas Fees
- All gas fees are paid in TCENT
- Make sure you have enough TCENT for:
  - Market creation: ~0.01 TCENT + gas
  - Trading: Amount + gas
  - Claiming: Gas only

---

## 🔧 Troubleshooting

### "Wrong Network" Error
- Make sure MetaMask is connected to Incentiv Testnet (Chain ID: 28802)
- Click "Connect Wallet" to trigger automatic network switch

### "Insufficient Balance" Error
- Get more TCENT from https://testnet.incentiv.io
- Check your balance in MetaMask

### Contract Not Found
- Verify you're on Incentiv Testnet (Chain ID: 28802)
- Check contract address: `0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40`

### Frontend Not Connecting
- Clear browser cache and reload
- Check console for errors
- Verify MetaMask is unlocked

---

## 📚 Additional Resources

- **Incentiv Documentation**: https://docs.incentiv.io/docs/developers/contracts
- **Incentiv Testnet Faucet**: https://testnet.incentiv.io
- **Block Explorer**: https://explorer-testnet.incentiv.io
- **RPC Endpoint**: https://rpc-testnet.incentiv.io/

---

## ✅ Deployment Checklist

- [x] Smart contracts deployed to Incentiv Testnet
- [x] Frontend configured for Incentiv Testnet
- [x] Network auto-switching implemented
- [x] Currency display updated (TCENT)
- [x] Private key configured in .env
- [x] Contract addresses updated in config
- [x] Test connection script created
- [x] Documentation created

---

**🎊 Your prediction market is now live on Incentiv Testnet!**

Start creating markets and trading with TCENT tokens.

