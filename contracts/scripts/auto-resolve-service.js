const { ethers } = require("hardhat");

// Configuration
const CONTRACT_ADDRESS = "0xC66AB83418C20A65C3f8e83B3d11c8C3a6097b6F";
const RESOLUTION_INTERVAL = 90000; // 1.5 minutes in milliseconds (90 seconds)

async function main() {
    console.log("🎲 Starting Automated Random Winner Resolution Service...");
    console.log(`⏱️  Resolution interval: ${RESOLUTION_INTERVAL / 1000} seconds (1.5 minutes)`);
    
    const [deployer] = await ethers.getSigners();
    console.log("Service running with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach(CONTRACT_ADDRESS);

    console.log("Contract address:", CONTRACT_ADDRESS);
    console.log("\n🚀 Service started! Checking for markets to resolve every 1.5 minutes...\n");

    // Track resolved markets to avoid re-resolving
    const resolvedMarkets = new Set();

    // Main resolution loop
    setInterval(async () => {
        try {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`\n⏰ [${timestamp}] Checking for markets to resolve...`);

            // Get all active markets
            const activeMarketIds = await contract.getActiveMarkets();
            
            if (activeMarketIds.length === 0) {
                console.log("   No active markets found.");
                return;
            }

            console.log(`   Found ${activeMarketIds.length} active market(s)`);

            // Check each market
            for (const marketId of activeMarketIds) {
                const marketIdNum = marketId.toNumber();
                
                // Skip if already resolved in this session
                if (resolvedMarkets.has(marketIdNum)) {
                    continue;
                }

                try {
                    const market = await contract.getMarket(marketIdNum);
                    
                    // Check if market has been active for at least 1.5 minutes
                    const currentTime = Math.floor(Date.now() / 1000);
                    const marketAge = currentTime - market.createdAt.toNumber();
                    
                    if (marketAge >= 90) { // 1.5 minutes = 90 seconds
                        console.log(`\n   🎲 Resolving Market ${marketIdNum}: "${market.question}"`);
                        console.log(`      Market age: ${Math.floor(marketAge / 60)} minutes ${marketAge % 60} seconds`);
                        console.log(`      Total YES shares: ${ethers.utils.formatEther(market.totalYesShares)}`);
                        console.log(`      Total NO shares: ${ethers.utils.formatEther(market.totalNoShares)}`);
                        console.log(`      Total volume: ${ethers.utils.formatEther(market.totalVolume)} ETH`);
                        
                        // Auto-resolve with random outcome
                        const tx = await contract.autoResolveMarket(marketIdNum);
                        console.log(`      Transaction sent: ${tx.hash}`);
                        
                        const receipt = await tx.wait();
                        console.log(`      ✅ Transaction confirmed!`);
                        
                        // Get the resolved market to see outcome
                        const resolvedMarket = await contract.getMarket(marketIdNum);
                        const outcomeText = resolvedMarket.outcome === 1 ? "YES" : "NO";
                        
                        console.log(`      🎉 Random Winner: ${outcomeText}!`);
                        console.log(`      ${outcomeText} holders can now claim their winnings!`);
                        
                        // Mark as resolved
                        resolvedMarkets.add(marketIdNum);
                    } else {
                        const remainingTime = 90 - marketAge;
                        console.log(`   ⏳ Market ${marketIdNum} needs ${remainingTime} more seconds`);
                    }
                } catch (error) {
                    if (error.message.includes("Market already resolved")) {
                        console.log(`   ℹ️  Market ${marketIdNum} already resolved`);
                        resolvedMarkets.add(marketIdNum);
                    } else {
                        console.error(`   ❌ Error resolving market ${marketIdNum}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error in resolution loop:", error.message);
        }
    }, RESOLUTION_INTERVAL);

    // Keep the service running
    console.log("Press Ctrl+C to stop the service");
}

main()
    .catch((error) => {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    });
