const { ethers } = require("hardhat");

async function main() {
  console.log("🔗 Testing Incentiv Testnet Connection...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("✅ Connected to Incentiv Testnet!");
  console.log("📍 Your address:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("💰 Balance:", ethers.utils.formatEther(balance), "TCENT");
  
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name);
  console.log("🔢 Chain ID:", network.chainId);
  
  if (balance.eq(0)) {
    console.log("\n⚠️  WARNING: Your balance is 0 TCENT!");
    console.log("📌 Get free testnet tokens at: https://testnet.incentiv.io");
  } else {
    console.log("\n✅ You have enough TCENT to deploy contracts!");
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });

