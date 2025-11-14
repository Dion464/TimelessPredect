# 🚀 Vercel Deployment Guide

## Prerequisites
1. Push all changes to GitHub
2. Have a Vercel account connected to your GitHub

## Step 1: Push to GitHub

```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
git push origin main
```

## Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Select your GitHub repository: `TimelessPredect`
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

## Step 3: Configure Environment Variables

In Vercel project settings, add these environment variables:

### For Incentiv Testnet (Production):

```
VITE_RPC_URL=https://rpc.incentiv-testnet.com
VITE_CHAIN_ID=9876
VITE_NETWORK_NAME=Incentiv Testnet
VITE_CONTRACT_ADDRESS=0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
VITE_MARKET_CREATION_FEE=0.01
VITE_PLATFORM_FEE_BPS=200
```

### Environment Variable Descriptions:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_RPC_URL` | The RPC endpoint for the blockchain network | `https://rpc.incentiv-testnet.com` |
| `VITE_CHAIN_ID` | The chain ID of the network | `9876` |
| `VITE_NETWORK_NAME` | Display name for the network | `Incentiv Testnet` |
| `VITE_CONTRACT_ADDRESS` | Deployed PredictionMarket contract address | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` |
| `VITE_MARKET_CREATION_FEE` | Fee in ETH to create a market | `0.01` |
| `VITE_PLATFORM_FEE_BPS` | Platform fee in basis points (200 = 2%) | `200` |

## Step 4: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete
3. Your app will be live at `https://your-project.vercel.app`

## Step 5: Verify Deployment

1. Visit your Vercel URL
2. Check that markets load without wallet connection
3. Connect MetaMask and ensure it prompts to switch to Incentiv Testnet
4. Test creating and trading on markets

## Troubleshooting

### Markets Not Loading
- Check browser console for RPC errors
- Verify `VITE_RPC_URL` is correct and accessible
- Verify `VITE_CONTRACT_ADDRESS` matches your deployed contract

### MetaMask Network Mismatch
- Ensure `VITE_CHAIN_ID` matches your MetaMask network
- Add Incentiv Testnet to MetaMask manually if needed:
  - Network Name: `Incentiv Testnet`
  - RPC URL: `https://rpc.incentiv-testnet.com`
  - Chain ID: `9876`
  - Currency Symbol: `ETH`

### Build Errors
- Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Verify `vite.config.mjs` has `outDir: 'dist'`

## Local Development

For local development with Hardhat:

```bash
# Copy .env.example to .env
cp frontend/.env.example frontend/.env

# Edit .env for local network
VITE_RPC_URL=http://localhost:8545
VITE_CHAIN_ID=1337
VITE_NETWORK_NAME=Hardhat Local
```

## Network Information

### Incentiv Testnet
- **RPC URL**: `https://rpc.incentiv-testnet.com`
- **Chain ID**: `9876`
- **Block Explorer**: (if available)
- **Faucet**: (if available)

### Hardhat Local (Development)
- **RPC URL**: `http://localhost:8545`
- **Chain ID**: `1337`
- **Network**: Local development only

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set correctly
4. Ensure contract is deployed on the target network
