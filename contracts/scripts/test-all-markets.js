const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing All Markets Individually...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionDream = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionDream.attach("0x07882Ae1ecB7429a84f1D53048d35c4bB2056877");

    try {
        // Get active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        // Test each market individually
        for (let i = 0; i < activeMarkets.length; i++) {
            const marketId = activeMarkets[i];
            console.log(`\n📊 Testing Market ${marketId.toString()}...`);
            
            try {
                // Test 1: Get market data
                console.log("  📋 Getting market data...");
                const market = await contract.getMarket(marketId);
                console.log(`  ✅ Market ${marketId}: ${market.question}`);
                console.log(`     Active: ${market.active}, Resolved: ${market.resolved}`);
                
                // Test 2: Get PricingAMM address
                console.log("  🔗 Getting PricingAMM address...");
                const pricingAMMAddress = await contract.pricingAMM();
                console.log(`  ✅ PricingAMM address: ${pricingAMMAddress}`);
                
                // Test 3: Test PricingAMM contract
                const PricingAMM = await ethers.getContractFactory("PricingAMM");
                const pricingAMMContract = await PricingAMM.attach(pricingAMMAddress);
                
                console.log("  💰 Getting prices...");
                const [yesPrice, noPrice] = await pricingAMMContract.calculatePrice(marketId);
                console.log(`  ✅ Prices: YES=${(yesPrice.toNumber() / 100).toFixed(0)}¢, NO=${(noPrice.toNumber() / 100).toFixed(0)}¢`);
                
                // Test 4: Try a small buy transaction
                console.log("  🛒 Testing buy transaction...");
                const tx = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("0.01")
                });
                console.log(`  ✅ Transaction sent: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`  ✅ Transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`);
                
            } catch (error) {
                console.log(`  ❌ Market ${marketId} failed:`, error.message);
                console.log("  Error details:", error);
            }
        }
    } catch (error) {
        console.log("❌ Error during testing:", error.message);
        console.log("Error details:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
