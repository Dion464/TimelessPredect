const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔴 Deactivating all markets...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Contract address on Incentiv Testnet
  const contractAddress = "0x8cF17Ff1Abe81B5c74f78edb62b0AeF31936642C";

  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const contract = ETHPredictionMarket.attach(contractAddress);

  // Get all active markets
  const activeMarketIds = await contract.getActiveMarkets();
  console.log(`Found ${activeMarketIds.length} active markets\n`);

  if (activeMarketIds.length === 0) {
    console.log("✅ No active markets to deactivate");
    return;
  }

  // Deactivate each market
  for (let i = 0; i < activeMarketIds.length; i++) {
    const marketId = activeMarketIds[i];
    console.log(`Deactivating market ${marketId}...`);
    
    try {
      const tx = await contract.emergencyPause(marketId);
      await tx.wait();
      console.log(`✅ Market ${marketId} deactivated`);
    } catch (error) {
      console.error(`❌ Failed to deactivate market ${marketId}:`, error.message);
    }
  }

  console.log("\n✅ All markets deactivated!");
  
  // Verify
  const remainingMarkets = await contract.getActiveMarkets();
  console.log(`\nRemaining active markets: ${remainingMarkets.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

