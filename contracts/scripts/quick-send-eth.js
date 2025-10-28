const { ethers } = require("hardhat");

async function main() {
    console.log("💰 Quick ETH Transfer Tool");
    
    const [deployer] = await ethers.getSigners();
    console.log("Sender (deployer) account:", deployer.address);
    
    // Get sender balance
    const senderBalance = await deployer.getBalance();
    console.log("Sender balance:", ethers.utils.formatEther(senderBalance), "ETH\n");
    
    // CHANGE THIS TO YOUR METAMASK ADDRESS
    const recipientAddress = process.argv[2] || "YOUR_METAMASK_ADDRESS_HERE";
    
    // Amount to send (default 100 ETH)
    const amount = process.argv[3] || "100";
    
    if (recipientAddress === "YOUR_METAMASK_ADDRESS_HERE") {
        console.log("❌ Please provide your MetaMask address as an argument:");
        console.log("   npx hardhat run scripts/quick-send-eth.js --network localhost YOUR_ADDRESS AMOUNT");
        console.log("\nExample:");
        console.log("   npx hardhat run scripts/quick-send-eth.js --network localhost 0x1234... 100");
        process.exit(1);
    }
    
    // Validate address
    if (!ethers.utils.isAddress(recipientAddress)) {
        console.error("❌ Invalid Ethereum address:", recipientAddress);
        process.exit(1);
    }
    
    // Get recipient balance before
    const balanceBefore = await ethers.provider.getBalance(recipientAddress);
    console.log("📊 Recipient:", recipientAddress);
    console.log("   Balance before:", ethers.utils.formatEther(balanceBefore), "ETH");
    
    console.log(`\n💸 Sending ${amount} ETH...`);
    
    // Send transaction
    const tx = await deployer.sendTransaction({
        to: recipientAddress,
        value: ethers.utils.parseEther(amount)
    });
    
    console.log("   Transaction hash:", tx.hash);
    console.log("   ⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed! (Block:", receipt.blockNumber, ")");
    
    // Get recipient balance after
    const balanceAfter = await ethers.provider.getBalance(recipientAddress);
    const difference = balanceAfter.sub(balanceBefore);
    
    console.log("\n📊 Final Results:");
    console.log("   Balance before:", ethers.utils.formatEther(balanceBefore), "ETH");
    console.log("   Balance after:", ethers.utils.formatEther(balanceAfter), "ETH");
    console.log("   Received:", ethers.utils.formatEther(difference), "ETH");
    console.log("\n🎉 Successfully sent", amount, "ETH to your account!");
    
    // Show remaining deployer balance
    const finalSenderBalance = await deployer.getBalance();
    console.log("\n💼 Sender remaining balance:", ethers.utils.formatEther(finalSenderBalance), "ETH");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
