const { ethers } = require("hardhat");

/**
 * Check the contract balance to see if deposits were received
 */
async function main() {
    console.log("💰 Checking ETHPredictionMarket contract balance...\n");

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

    // Get contract address from deployment file or environment
    const fs = require("fs");
    const path = require("path");
    
    const deploymentFile = path.join(__dirname, "..", "deployments", `eth-${network.chainId}.json`);
    
    let contractAddress;
    
    if (fs.existsSync(deploymentFile)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        contractAddress = deploymentInfo.contracts?.ETHPredictionMarket?.address || deploymentInfo.contracts?.ETHPredictionMarket;
    }

    // Also try to get from environment if available
    if (!contractAddress && process.env.VITE_CONTRACT_ADDRESS) {
        contractAddress = process.env.VITE_CONTRACT_ADDRESS;
    }

    if (!contractAddress) {
        console.error("❌ Contract address not found!");
        console.log("\nPlease provide the contract address:");
        console.log("  Option 1: Set VITE_CONTRACT_ADDRESS environment variable");
        console.log("  Option 2: Deploy the contract first (it will save the address)");
        console.log("  Option 3: Pass it as an argument: npx hardhat run scripts/check-contract-balance.js --network incentiv <address>");
        process.exit(1);
    }

    // Allow passing address as command line arg (Hardhat doesn't pass args after --network)
    // So we check for environment variable first, then process.argv
    // Or use: CONTRACT_ADDRESS=0x... npx hardhat run scripts/check-contract-balance.js --network incentiv
    if (process.env.CONTRACT_ADDRESS) {
        contractAddress = process.env.CONTRACT_ADDRESS;
    } else if (process.argv.length > 2 && process.argv[process.argv.length - 1].startsWith('0x')) {
        // Try to find address in argv (might be at different positions)
        const addressArg = process.argv.find(arg => arg.startsWith('0x') && arg.length === 42);
        if (addressArg) {
            contractAddress = addressArg;
        }
    }

    console.log("Contract address:", contractAddress);
    console.log("Checking balance...\n");

    try {
        const balance = await ethers.provider.getBalance(contractAddress);
        const balanceInTCENT = ethers.utils.formatEther(balance);

        console.log("✅ Contract Balance:", balanceInTCENT, "TCENT");
        console.log("   Raw balance (wei):", balance.toString());

        if (balance.eq(0)) {
            console.log("\n⚠️  Contract balance is 0 TCENT");
            console.log("   If you just sent funds, check:");
            console.log("   1. Transaction was successful on the explorer");
            console.log("   2. You used the correct contract address");
            console.log("   3. The contract has a receive() function to accept deposits");
        } else {
            console.log("\n✅ Contract has funds!");
            console.log("   These funds will be used for:");
            console.log("   • Paying users when they sell shares");
            console.log("   • Paying winners when they claim winnings (1 TCENT per share)");
        }

        // Try to get contract instance and check owner
        try {
            const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
            const contract = ETHPredictionMarket.attach(contractAddress);
            const owner = await contract.owner();
            console.log("\n📋 Contract Info:");
            console.log("   Owner:", owner);
        } catch (err) {
            console.log("\n⚠️  Could not load contract instance (this is okay if contract is deployed elsewhere)");
        }

    } catch (error) {
        console.error("❌ Error checking balance:", error.message);
        if (error.message.includes("invalid address")) {
            console.log("\n⚠️  Invalid contract address. Please check your address.");
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

