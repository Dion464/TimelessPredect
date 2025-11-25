const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load environment variables from frontend/.env file
const envPath = path.join(__dirname, '..', 'frontend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      const key = match[1];
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS;
const RPC_URL = process.env.VITE_RPC_URL;

const CONTRACT_ABI = [
  "function getActiveMarkets() view returns (uint256[] memory)",
  "function getMarket(uint256 _marketId) view returns (tuple(uint256 id, string question, string description, string category, uint256 endTime, uint256 resolutionTime, bool resolved, uint8 outcome, uint256 totalYesShares, uint256 totalNoShares, uint256 totalVolume, address creator, uint256 createdAt, bool active, uint256 lastTradedPrice, uint256 yesBidPrice, uint256 yesAskPrice, uint256 noBidPrice, uint256 noAskPrice))"
];

async function checkBlockchainMarkets() {
  try {
    console.log('🔗 Connecting to blockchain...\n');

    if (!CONTRACT_ADDRESS) {
      console.error('❌ VITE_CONTRACT_ADDRESS not found');
      process.exit(1);
    }

    if (!RPC_URL) {
      console.error('❌ VITE_RPC_URL not found');
      process.exit(1);
    }

    // Connect to blockchain (read-only)
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`🌐 RPC URL: ${RPC_URL}\n`);

    // Get active markets
    console.log('📊 Fetching active markets from blockchain...');
    const activeMarkets = await contract.getActiveMarkets();
    
    console.log(`\n✅ Found ${activeMarkets.length} active markets on blockchain\n`);

    if (activeMarkets.length === 0) {
      console.log('🎉 No markets on blockchain. Ready for fresh start!');
      return;
    }

    // Show details of each market
    for (let i = 0; i < activeMarkets.length; i++) {
      const marketId = activeMarkets[i].toString();
      
      try {
        const market = await contract.getMarket(marketId);
        console.log(`\n[${i + 1}] Market #${marketId}`);
        console.log(`   Question: ${market.question}`);
        console.log(`   Category: ${market.category}`);
        console.log(`   Creator: ${market.creator}`);
        console.log(`   Active: ${market.active}`);
        console.log(`   Resolved: ${market.resolved}`);
        console.log(`   End Time: ${new Date(market.endTime.toNumber() * 1000).toISOString()}`);
        console.log(`   Resolution Time: ${new Date(market.resolutionTime.toNumber() * 1000).toISOString()}`);
        console.log(`   Total Volume: ${ethers.utils.formatEther(market.totalVolume)} ETH`);
      } catch (error) {
        console.log(`   ❌ Error fetching market details: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Total: ${activeMarkets.length} markets on blockchain`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error checking blockchain markets:', error.message);
    process.exit(1);
  }
}

checkBlockchainMarkets();

