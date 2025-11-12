const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing price direction...\n");

  const [deployer, trader] = await ethers.getSigners();
  
  const fs = require('fs');
  const path = require('path');
  const deploymentFile = path.join(__dirname, "../deployments/unknown-1337.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const contractAddress = deployment.contracts.ETHPredictionMarket.address;
  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const market = ETHPredictionMarket.attach(contractAddress);

  const marketId = 1;
  
  console.log("📊 Before trade:");
  const yesPrice1 = await market.getCurrentPrice(marketId, true);
  const noPrice1 = await market.getCurrentPrice(marketId, false);
  console.log("YES price:", (yesPrice1.toNumber()/100).toFixed(2) + "¢");
  console.log("NO price:", (noPrice1.toNumber()/100).toFixed(2) + "¢");
  
  const marketData1 = await market.getMarket(marketId);
  console.log("YES shares:", ethers.utils.formatEther(marketData1.totalYesShares));
  console.log("NO shares:", ethers.utils.formatEther(marketData1.totalNoShares));
  
  console.log("\n💸 Buying 0.1 ETH of YES shares...");
  const tx = await market.connect(trader).buyShares(marketId, true, { value: ethers.utils.parseEther("0.1") });
  await tx.wait();
  
  console.log("\n📊 After trade:");
  const yesPrice2 = await market.getCurrentPrice(marketId, true);
  const noPrice2 = await market.getCurrentPrice(marketId, false);
  console.log("YES price:", (yesPrice2.toNumber()/100).toFixed(2) + "¢ (was " + (yesPrice1.toNumber()/100).toFixed(2) + "¢)");
  console.log("NO price:", (noPrice2.toNumber()/100).toFixed(2) + "¢ (was " + (noPrice1.toNumber()/100).toFixed(2) + "¢)");
  
  const marketData2 = await market.getMarket(marketId);
  console.log("YES shares:", ethers.utils.formatEther(marketData2.totalYesShares));
  console.log("NO shares:", ethers.utils.formatEther(marketData2.totalNoShares));
  
  if (yesPrice2.gt(yesPrice1)) {
    console.log("\n✅ CORRECT: YES price increased when buying YES!");
  } else {
    console.log("\n❌ WRONG: YES price decreased when buying YES (backwards!)");
  }
}

main().catch(console.error);

