const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Getting USDC from faucet...");
  
  // Get the first account (same as MetaMask imported account)
  const [account] = await ethers.getSigners();
  console.log("Using account:", account.address);

  // Get USDC contract
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

  // Check initial balance
  const initialBalance = await usdc.balanceOf(account.address);
  console.log("Initial USDC balance:", ethers.utils.formatUnits(initialBalance, 6));

  // Get USDC from faucet
  try {
    console.log("📦 Calling faucet...");
    const tx = await usdc.faucet();
    console.log("Transaction hash:", tx.hash);
    
    console.log("⏳ Waiting for confirmation...");
    await tx.wait();
    
    // Check new balance
    const newBalance = await usdc.balanceOf(account.address);
    console.log("New USDC balance:", ethers.utils.formatUnits(newBalance, 6));
    
    console.log("✅ Success! USDC added to your account.");
    console.log("");
    console.log("🔗 View transaction in block explorer:");
    console.log(`   http://localhost:4000/tx/${tx.hash}`);
    console.log("");
    console.log("💡 To see USDC in MetaMask, add this token:");
    console.log(`   Contract: ${usdcAddress}`);
    console.log("   Symbol: USDC");
    console.log("   Decimals: 6");
    
  } catch (error) {
    if (error.message.includes("Already have enough USDC")) {
      console.log("✅ You already have enough USDC!");
      console.log("💡 Add the token to MetaMask to see your balance:");
      console.log(`   Contract: ${usdcAddress}`);
      console.log("   Symbol: USDC");
      console.log("   Decimals: 6");
    } else {
      console.error("❌ Error:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
