const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 Forcing USDC transfer to trigger MetaMask detection...");
  
  // Get accounts
  const [deployer] = await ethers.getSigners();
  const targetAccount = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  console.log("Deployer:", deployer.address);
  console.log("Target:", targetAccount);
  
  // Get USDC contract
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  
  // Check current balance
  const currentBalance = await usdc.balanceOf(targetAccount);
  console.log("Current USDC balance:", ethers.utils.formatUnits(currentBalance, 6));
  
  if (currentBalance.eq(0)) {
    // Call faucet if no balance
    console.log("📦 Getting USDC from faucet...");
    const faucetTx = await usdc.faucet();
    await faucetTx.wait();
    console.log("✅ Faucet transaction:", faucetTx.hash);
  } else {
    // Transfer 1 USDC to self to trigger MetaMask detection
    console.log("💸 Transferring 1 USDC to self to trigger MetaMask...");
    const transferTx = await usdc.transfer(targetAccount, ethers.utils.parseUnits("1", 6));
    await transferTx.wait();
    console.log("✅ Transfer transaction:", transferTx.hash);
  }
  
  // Final balance check
  const finalBalance = await usdc.balanceOf(targetAccount);
  console.log("Final USDC balance:", ethers.utils.formatUnits(finalBalance, 6));
  
  console.log("");
  console.log("🎯 USDC Token Details for MetaMask:");
  console.log("Contract Address:", usdcAddress);
  console.log("Symbol: USDC");
  console.log("Decimals: 6");
  console.log("");
  console.log("📱 MetaMask should now detect the USDC token automatically!");
  console.log("If not, manually add it using the details above.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
