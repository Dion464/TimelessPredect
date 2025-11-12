const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing price impact with multiple trades...\n");

  const [deployer, trader1, trader2] = await ethers.getSigners();
  
  // Load the deployment info
  const fs = require('fs');
  const path = require('path');
  const deploymentFile = path.join(__dirname, "../deployments/unknown-1337.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const contractAddress = deployment.contracts.ETHPredictionMarket.address;
  console.log("Contract:", contractAddress);

  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const market = ETHPredictionMarket.attach(contractAddress);

  const marketId = 1;
  console.log("Testing on market ID:", marketId);
  
  // Get initial state
  const initialMarket = await market.getMarket(marketId);
  const initialYesPrice = await market.getCurrentPrice(marketId, true);
  const initialNoPrice = await market.getCurrentPrice(marketId, false);
  
  console.log("\n📊 Initial State:");
  console.log("YES shares:", ethers.utils.formatEther(initialMarket.totalYesShares));
  console.log("NO shares:", ethers.utils.formatEther(initialMarket.totalNoShares));
  console.log("YES price:", (initialYesPrice.toNumber()/100).toFixed(2) + "¢");
  console.log("NO price:", (initialNoPrice.toNumber()/100).toFixed(2) + "¢");
  
  // Make 5 small trades
  console.log("\n🛒 Making 5 trades of 0.01 ETH each...");
  for (let i = 1; i <= 5; i++) {
    const buyAmount = ethers.utils.parseEther("0.01");
    
    console.log(`\nTrade ${i}: Buying 0.01 ETH of YES shares...`);
    const tx = await market.connect(trader1).buyShares(marketId, true, { value: buyAmount });
    await tx.wait();
    
    const marketData = await market.getMarket(marketId);
    const yesPrice = await market.getCurrentPrice(marketId, true);
    const noPrice = await market.getCurrentPrice(marketId, false);
    
    console.log(`  YES price: ${(yesPrice.toNumber()/100).toFixed(2)}¢ (was ${(initialYesPrice.toNumber()/100).toFixed(2)}¢)`);
    console.log(`  NO price: ${(noPrice.toNumber()/100).toFixed(2)}¢ (was ${(initialNoPrice.toNumber()/100).toFixed(2)}¢)`);
  }
  
  console.log("\n✅ Price impact test complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

