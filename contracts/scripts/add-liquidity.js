const { ethers } = require("hardhat");

async function main() {
    console.log("💰 Adding Liquidity to Prediction Markets...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "TCENT\n");

    // Get contract addresses
    const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS || "0x6b1e116ba6F6396cc3c16b1152CA32c3eb911f40";
    
    console.log("Contract address:", PREDICTION_MARKET_ADDRESS);

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach(PREDICTION_MARKET_ADDRESS);

    try {
        // Get all active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log(`\n📊 Found ${activeMarkets.length} active market(s)`);
        
        if (activeMarkets.length === 0) {
            console.log("⚠️  No active markets found. Create markets first.");
            return;
        }

        console.log("Market IDs:", activeMarkets.map(id => id.toString()));
        
        // Amount of liquidity to add per market (in TCENT)
        const liquidityPerMarket = ethers.utils.parseEther("100"); // 100 TCENT per market
        
        console.log(`\n💵 Adding ${ethers.utils.formatEther(liquidityPerMarket)} TCENT to each market...`);
        
        // Add liquidity to each market
        for (let i = 0; i < activeMarkets.length; i++) {
            const marketId = activeMarkets[i];
            
            try {
                console.log(`\n📈 Adding liquidity to Market ${marketId.toString()}...`);
                
                // Get market details
                const market = await contract.markets(marketId);
                console.log(`   Question: ${market.question}`);
                
                // Buy equal amounts of YES and NO shares to add balanced liquidity
                // This creates a liquidity pool that allows others to trade
                const halfLiquidity = liquidityPerMarket.div(2);
                
                // Buy YES shares
                console.log(`   🟢 Buying YES shares with ${ethers.utils.formatEther(halfLiquidity)} TCENT...`);
                const yesTx = await contract.buyShares(marketId, true, {
                    value: halfLiquidity,
                    gasLimit: 500000
                });
                await yesTx.wait();
                console.log(`   ✅ YES shares purchased`);
                
                // Buy NO shares
                console.log(`   🔴 Buying NO shares with ${ethers.utils.formatEther(halfLiquidity)} TCENT...`);
                const noTx = await contract.buyShares(marketId, false, {
                    value: halfLiquidity,
                    gasLimit: 500000
                });
                await noTx.wait();
                console.log(`   ✅ NO shares purchased`);
                
                // Get updated market state
                const updatedMarket = await contract.markets(marketId);
                console.log(`   📊 Total YES shares: ${ethers.utils.formatEther(updatedMarket.totalYesShares)}`);
                console.log(`   📊 Total NO shares: ${ethers.utils.formatEther(updatedMarket.totalNoShares)}`);
                console.log(`   ✅ Liquidity added to Market ${marketId.toString()}`);
                
            } catch (error) {
                console.error(`   ❌ Error adding liquidity to market ${marketId.toString()}:`, error.message);
            }
        }
        
        // Display final account balance
        const finalBalance = await deployer.getBalance();
        console.log(`\n💰 Final account balance: ${ethers.utils.formatEther(finalBalance)} TCENT`);
        
        console.log("\n✅ Liquidity addition completed!");
        console.log("\n📝 Summary:");
        console.log(`   - Added liquidity to ${activeMarkets.length} market(s)`);
        console.log(`   - Total TCENT spent: ~${ethers.utils.formatEther(liquidityPerMarket.mul(activeMarkets.length))} TCENT`);
        console.log(`   - Markets now have balanced YES/NO liquidity`);
        console.log(`   - Users can now trade with real price discovery`);

    } catch (error) {
        console.error("\n❌ Error during liquidity addition:", error.message);
        console.error("Error details:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

