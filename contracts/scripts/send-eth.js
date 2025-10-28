const { ethers } = require("hardhat");

async function main() {
    console.log("💰 Sending ETH to your account...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Sender account:", deployer.address);
    
    // Get sender balance
    const senderBalance = await deployer.getBalance();
    console.log("Sender balance:", ethers.utils.formatEther(senderBalance), "ETH");
    
    // You can change this to your MetaMask address
    // For now, I'll prompt you to enter it
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    readline.question('Enter your MetaMask address: ', async (recipientAddress) => {
        try {
            // Validate address
            if (!ethers.utils.isAddress(recipientAddress)) {
                console.error("❌ Invalid Ethereum address!");
                process.exit(1);
            }
            
            // Get recipient balance before
            const balanceBefore = await ethers.provider.getBalance(recipientAddress);
            console.log("\n📊 Recipient balance before:", ethers.utils.formatEther(balanceBefore), "ETH");
            
            // Amount to send (you can change this)
            readline.question('How much ETH to send? (default: 100): ', async (amountInput) => {
                const amount = amountInput || "100";
                
                console.log(`\n💸 Sending ${amount} ETH to ${recipientAddress}...`);
                
                // Send transaction
                const tx = await deployer.sendTransaction({
                    to: recipientAddress,
                    value: ethers.utils.parseEther(amount)
                });
                
                console.log("Transaction hash:", tx.hash);
                console.log("⏳ Waiting for confirmation...");
                
                const receipt = await tx.wait();
                console.log("✅ Transaction confirmed!");
                
                // Get recipient balance after
                const balanceAfter = await ethers.provider.getBalance(recipientAddress);
                console.log("\n📊 Recipient balance after:", ethers.utils.formatEther(balanceAfter), "ETH");
                console.log(`✅ Successfully sent ${amount} ETH!`);
                
                readline.close();
                process.exit(0);
            });
        } catch (error) {
            console.error("❌ Error:", error.message);
            readline.close();
            process.exit(1);
        }
    });
}

main()
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });