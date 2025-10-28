const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking USDC balance for imported account...");
  
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const accountAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  const balance = await usdc.balanceOf(accountAddress);
  
  console.log("📊 Account:", accountAddress);
  console.log("💰 USDC Balance:", ethers.utils.formatUnits(balance, 6));
  console.log("🏦 Token Address:", usdcAddress);
  
  if (balance.gt(0)) {
    console.log("✅ Account has USDC! Add the token to MetaMask to see it.");
  } else {
    console.log("❌ Account has no USDC. Running faucet...");
    const faucetTx = await usdc.faucet();
    await faucetTx.wait();
    console.log("✅ Faucet complete!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
