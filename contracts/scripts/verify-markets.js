const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying market status...\n");

  const contractAddress = "0x8cF17Ff1Abe81B5c74f78edb62b0AeF31936642C";

  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const contract = ETHPredictionMarket.attach(contractAddress);

  // Check first 3 markets directly
  for (let i = 1; i <= 3; i++) {
    try {
      const market = await contract.getMarket(i);
      console.log(`Market ${i}:`);
      console.log(`  Question: ${market.question}`);
      console.log(`  Active: ${market.active}`);
      console.log(`  Resolved: ${market.resolved}`);
      console.log();
    } catch (error) {
      console.log(`Market ${i}: Does not exist\n`);
    }
  }

  // Check getActiveMarkets
  const activeMarkets = await contract.getActiveMarkets();
  console.log(`getActiveMarkets() returns: ${activeMarkets.length} markets`);
  console.log(`Market IDs: ${activeMarkets.join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

