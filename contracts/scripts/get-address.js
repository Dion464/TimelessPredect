const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔑 Your wallet address:", deployer.address);
    console.log("\n💰 Get testnet MATIC from these faucets:");
    console.log("🔗 https://faucet.polygon.technology/");
    console.log("🔗 https://mumbaifaucet.com/");
    console.log("🔗 https://faucet.quicknode.com/polygon/mumbai");
    
    // Check current balance
    try {
        const balance = await deployer.getBalance();
        console.log("\n💳 Current balance:", ethers.utils.formatEther(balance), "MATIC");
        
        if (balance.lt(ethers.utils.parseEther("0.1"))) {
            console.log("⚠️  You need at least 0.1 MATIC to deploy contracts");
        } else {
            console.log("✅ Sufficient balance for deployment!");
        }
    } catch (error) {
        console.log("⚠️  Could not check balance - make sure you're connected to Mumbai testnet");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
