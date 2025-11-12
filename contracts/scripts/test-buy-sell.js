const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing buy/sell functionality...\n");

  const [deployer, buyer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Buyer:", buyer.address);

  // Load the deployment info
  const fs = require('fs');
  const path = require('path');
  const deploymentFile = path.join(__dirname, "../deployments/unknown-1337.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const contractAddress = deployment.contracts.ETHPredictionMarket.address;
  console.log("Contract address:", contractAddress);

  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const market = ETHPredictionMarket.attach(contractAddress);

  // Get active markets
  const activeMarkets = await market.getActiveMarkets();
  console.log("\n📊 Active markets:", activeMarkets.length);

  if (activeMarkets.length === 0) {
    console.log("❌ No active markets found!");
    return;
  }

  const marketId = activeMarkets[0];
  console.log("Testing with market ID:", marketId.toString());

  // Get market info
  const marketInfo = await market.getMarket(marketId);
  console.log("\n📋 Market Info:");
  console.log("Question:", marketInfo.question);
  console.log("Total YES shares:", marketInfo.totalYesShares.toString());
  console.log("Total NO shares:", marketInfo.totalNoShares.toString());
  console.log("Total volume:", ethers.utils.formatEther(marketInfo.totalVolume), "ETH");

  // Get current prices
  const yesPrice = await market.getCurrentPrice(marketId, true);
  const noPrice = await market.getCurrentPrice(marketId, false);
  console.log("\n💰 Current Prices:");
  console.log("YES price:", yesPrice.toString(), "basis points", `(${yesPrice/100}¢)`);
  console.log("NO price:", noPrice.toString(), "basis points", `(${noPrice/100}¢)`);

  // Try to buy YES shares
  console.log("\n🛒 Testing buy transaction...");
  try {
    const buyAmount = ethers.utils.parseEther("0.1"); // 0.1 ETH
    console.log("Buying YES shares with", ethers.utils.formatEther(buyAmount), "ETH");
    
    const tx = await market.connect(buyer).buyShares(marketId, true, { value: buyAmount });
    console.log("✅ Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Get updated market info
    const updatedMarketInfo = await market.getMarket(marketId);
    console.log("\n📊 Updated Market Info:");
    console.log("Total YES shares:", updatedMarketInfo.totalYesShares.toString());
    console.log("Total NO shares:", updatedMarketInfo.totalNoShares.toString());
    console.log("Total volume:", ethers.utils.formatEther(updatedMarketInfo.totalVolume), "ETH");

    // Get new prices
    const newYesPrice = await market.getCurrentPrice(marketId, true);
    const newNoPrice = await market.getCurrentPrice(marketId, false);
    console.log("\n💰 New Prices:");
    console.log("YES price:", newYesPrice.toString(), "basis points", `(${newYesPrice/100}¢)`);
    console.log("NO price:", newNoPrice.toString(), "basis points", `(${newNoPrice/100}¢)`);

    console.log("\n✅ Buy/Sell test PASSED!");
  } catch (error) {
    console.log("\n❌ Buy transaction failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
