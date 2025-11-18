const { ethers } = require("hardhat");

/**
 * Check complete contract status: balance, markets, configuration
 */
async function main() {
    console.log("📊 Checking ETHPredictionMarket Contract Status...\n");

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

    // Get contract address from deployment file
    const fs = require("fs");
    const path = require("path");
    
    const deploymentFile = path.join(__dirname, "..", "deployments", `eth-${network.chainId}.json`);
    
    let contractAddress;
    
    if (fs.existsSync(deploymentFile)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        contractAddress = deploymentInfo.contracts?.ETHPredictionMarket?.address || deploymentInfo.contracts?.ETHPredictionMarket;
    }

    if (!contractAddress) {
        console.error("❌ Contract address not found in deployment file!");
        process.exit(1);
    }

    console.log("Contract address:", contractAddress);
    console.log("\n" + "=".repeat(60) + "\n");

    try {
        // Get contract instance
        const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
        const contract = ETHPredictionMarket.attach(contractAddress);

        // 1. Check balance
        console.log("💰 BALANCE:");
        const balance = await ethers.provider.getBalance(contractAddress);
        const balanceInTCENT = ethers.utils.formatEther(balance);
        console.log(`   Contract Balance: ${balanceInTCENT} TCENT`);
        console.log(`   Raw balance (wei): ${balance.toString()}\n`);

        // 2. Check contract configuration
        console.log("⚙️  CONFIGURATION:");
        const marketCreationFee = await contract.marketCreationFee();
        const platformFeePercent = await contract.platformFeePercent();
        const owner = await contract.owner();
        
        console.log(`   Market Creation Fee: ${ethers.utils.formatEther(marketCreationFee)} TCENT`);
        console.log(`   Platform Fee: ${platformFeePercent.toString()} basis points (${platformFeePercent.toNumber() / 100}%)`);
        console.log(`   Owner: ${owner}\n`);

        // 3. Check active markets
        console.log("📈 MARKETS:");
        try {
            const activeMarkets = await contract.getActiveMarkets();
            console.log(`   Active Markets Count: ${activeMarkets.length}`);
            
            if (activeMarkets.length > 0) {
                console.log(`   Market IDs: ${activeMarkets.map(m => m.toString()).join(", ")}`);
                
                // Get details for first 5 markets
                const marketsToShow = activeMarkets.slice(0, Math.min(5, activeMarkets.length));
                console.log("\n   Market Details (first 5):");
                for (const marketId of marketsToShow) {
                    try {
                        const market = await contract.getMarket(marketId);
                        const totalVolume = ethers.utils.formatEther(market.totalVolume);
                        const yesShares = ethers.utils.formatEther(market.totalYesShares);
                        const noShares = ethers.utils.formatEther(market.totalNoShares);
                        
                        console.log(`\n   Market #${marketId}:`);
                        console.log(`     Question: ${market.question}`);
                        console.log(`     Status: ${market.active ? "Active" : "Inactive"} | ${market.resolved ? "Resolved" : "Open"}`);
                        console.log(`     Total Volume: ${totalVolume} TCENT`);
                        console.log(`     YES Shares: ${yesShares}`);
                        console.log(`     NO Shares: ${noShares}`);
                    } catch (err) {
                        console.log(`   Market #${marketId}: Error fetching details - ${err.message}`);
                    }
                }
            } else {
                console.log("   ⚠️  No active markets found");
            }
        } catch (err) {
            console.log(`   ❌ Error fetching markets: ${err.message}`);
        }

        console.log("\n" + "=".repeat(60) + "\n");

        // Summary
        console.log("📋 SUMMARY:");
        if (balance.eq(0)) {
            console.log("   ⚠️  Contract has NO funds (0 TCENT)");
            console.log("   💡 Send TCENT to this address to provide liquidity for:");
            console.log("      • Paying users when they sell shares");
            console.log("      • Paying winners when they claim winnings (1 TCENT per share)");
        } else {
            console.log(`   ✅ Contract has ${balanceInTCENT} TCENT available`);
            console.log("   💡 These funds will be used for payouts");
        }

    } catch (error) {
        console.error("❌ Error checking contract:", error.message);
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

