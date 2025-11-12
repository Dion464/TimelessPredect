const { ethers } = require("hardhat");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("🗑️  Deleting All Markets...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

    // Get contract addresses
    const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    
    console.log("Contract address:", PREDICTION_MARKET_ADDRESS);

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach(PREDICTION_MARKET_ADDRESS);

    try {
        // Get all active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log(`\n📊 Found ${activeMarkets.length} active market(s)`);
        
        if (activeMarkets.length === 0) {
            console.log("✅ No active markets to delete");
        } else {
            console.log("Market IDs:", activeMarkets.map(id => id.toString()));
            
            // Resolve each market (this removes them from activeMarketIds)
            for (let i = 0; i < activeMarkets.length; i++) {
                const marketId = activeMarkets[i];
                try {
                    // Check if market exists and is active
                    const market = await contract.markets(marketId);
                    
                    if (market.active) {
                        console.log(`\n🔄 Resolving market ${marketId.toString()}...`);
                        
                        // Resolve as INVALID (outcome 3) to close it
                        const tx = await contract.resolveMarket(marketId, 3); // 3 = INVALID
                        console.log(`   Transaction hash: ${tx.hash}`);
                        
                        await tx.wait();
                        console.log(`   ✅ Market ${marketId.toString()} resolved and removed from active markets`);
                    } else {
                        console.log(`   ⚠️  Market ${marketId.toString()} is already inactive`);
                    }
                } catch (error) {
                    console.error(`   ❌ Error resolving market ${marketId.toString()}:`, error.message);
                    // Try to deactivate it instead
                    try {
                        console.log(`   🔄 Attempting to deactivate market ${marketId.toString()}...`);
                        const tx = await contract.emergencyPause(marketId);
                        await tx.wait();
                        console.log(`   ✅ Market ${marketId.toString()} deactivated`);
                    } catch (pauseError) {
                        console.error(`   ❌ Error deactivating market:`, pauseError.message);
                    }
                }
            }
        }

        // Verify all markets are removed
        const remainingMarkets = await contract.getActiveMarkets();
        console.log(`\n✅ Verification: ${remainingMarkets.length} active market(s) remaining`);
        
        if (remainingMarkets.length === 0) {
            console.log("✅ All markets successfully removed from blockchain!");
        } else {
            console.log("⚠️  Some markets could not be removed:", remainingMarkets.map(id => id.toString()));
        }

        // Clear database records
        console.log("\n🗑️  Clearing database records...");
        
        try {
            // Delete price snapshots
            const priceSnapshotResult = await prisma.priceSnapshot.deleteMany({});
            console.log(`   ✅ Deleted ${priceSnapshotResult.count} price snapshot(s)`);
            
            // Delete trades
            const tradeResult = await prisma.trade.deleteMany({});
            console.log(`   ✅ Deleted ${tradeResult.count} trade(s)`);
            
            // Delete positions
            const positionResult = await prisma.position.deleteMany({});
            console.log(`   ✅ Deleted ${positionResult.count} position(s)`);
            
            // Delete markets
            const marketResult = await prisma.market.deleteMany({});
            console.log(`   ✅ Deleted ${marketResult.count} market(s)`);
            
            console.log("\n✅ Database cleared successfully!");
        } catch (dbError) {
            console.error("\n❌ Error clearing database:", dbError.message);
            console.log("   (This is okay if database is not configured or empty)");
        }

    } catch (error) {
        console.error("\n❌ Error during market deletion:", error.message);
        console.error("Error details:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

