const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing USDC faucet and contracts...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get contract instances
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const predictionMarketAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  const predictionMarket = await ethers.getContractAt("PredictionMarket", predictionMarketAddress);

  // Check initial balance
  const initialBalance = await usdc.balanceOf(deployer.address);
  console.log("Initial USDC balance:", ethers.utils.formatUnits(initialBalance, 6));

  // Call faucet
  console.log("📦 Getting USDC from faucet...");
  const faucetTx = await usdc.faucet();
  await faucetTx.wait();

  // Check new balance
  const newBalance = await usdc.balanceOf(deployer.address);
  console.log("New USDC balance:", ethers.utils.formatUnits(newBalance, 6));

  // Test market data
  console.log("📊 Testing market data...");
  try {
    const market = await predictionMarket.getMarket(1);
    console.log("Market 1 exists:", market.questionTitle);
  } catch (error) {
    console.log("Market 1 not found, this is expected");
  }

  // Test current price
  try {
    const price = await predictionMarket.getCurrentPrice(1);
    console.log("Market 1 price:", price.toString());
  } catch (error) {
    console.log("Cannot get price for market 1, this is expected");
  }

  console.log("✅ Faucet test complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
