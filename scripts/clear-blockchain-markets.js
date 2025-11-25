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

// Also check root .env for PRIVATE_KEY
const rootEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^PRIVATE_KEY=(.+)$/);
    if (match) {
      process.env.PRIVATE_KEY = match[1].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS;
const RPC_URL = process.env.VITE_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const CONTRACT_ABI = [
  "function getActiveMarkets() view returns (uint256[] memory)",
  "function getMarket(uint256 _marketId) view returns (tuple(uint256 id, string question, string description, string category, uint256 endTime, uint256 resolutionTime, bool resolved, uint8 outcome, uint256 totalYesShares, uint256 totalNoShares, uint256 totalVolume, address creator, uint256 createdAt, bool active, uint256 lastTradedPrice, uint256 yesBidPrice, uint256 yesAskPrice, uint256 noBidPrice, uint256 noAskPrice))",
  "function resolveMarket(uint256 _marketId, uint8 _outcome)"
];

async function clearBlockchainMarkets() {
  try {
    console.log('🔗 Connecting to blockchain...\n');

    if (!CONTRACT_ADDRESS) {
      console.error('❌ VITE_CONTRACT_ADDRESS not found in .env file');
      process.exit(1);
    }

    if (!RPC_URL) {
      console.error('❌ VITE_RPC_URL not found in .env file');
      process.exit(1);
    }

    if (!PRIVATE_KEY) {
      console.error('❌ PRIVATE_KEY not found in .env file');
      console.log('💡 Add your wallet private key to .env as PRIVATE_KEY=your_key_here');
      process.exit(1);
    }

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`👛 Wallet Address: ${wallet.address}`);
    console.log(`🌐 RPC URL: ${RPC_URL}\n`);

    // Get active markets
    console.log('📊 Fetching active markets...');
    const activeMarkets = await contract.getActiveMarkets();
    
    if (activeMarkets.length === 0) {
      console.log('✅ No active markets found on blockchain. Nothing to clear!');
      return;
    }

    console.log(`Found ${activeMarkets.length} active markets\n`);

    // Resolve each market as INVALID (outcome = 3)
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < activeMarkets.length; i++) {
      const marketId = activeMarkets[i].toString();
      
      try {
        // Get market details
        const market = await contract.getMarket(marketId);
        console.log(`\n[${i + 1}/${activeMarkets.length}] Market #${marketId}`);
        console.log(`   Question: ${market.question}`);
        console.log(`   Category: ${market.category}`);
        console.log(`   Status: ${market.resolved ? 'Resolved' : 'Active'}`);

        if (market.resolved) {
          console.log(`   ⏭️  Already resolved, skipping...`);
          continue;
        }

        // Resolve market as INVALID (3)
        console.log(`   🔄 Resolving as INVALID...`);
        const tx = await contract.resolveMarket(marketId, 3);
        console.log(`   ⏳ Transaction sent: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`   ✅ Resolved successfully! Gas used: ${receipt.gasUsed.toString()}`);
        successCount++;

        // Wait a bit between transactions to avoid nonce issues
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`   ❌ Failed to resolve: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total markets: ${activeMarkets.length}`);
    console.log(`   Successfully resolved: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✨ Blockchain markets cleared successfully!');
      console.log('💡 All markets have been resolved as INVALID and removed from active list.');
    }

  } catch (error) {
    console.error('\n❌ Error clearing blockchain markets:', error);
    process.exit(1);
  }
}

clearBlockchainMarkets();

