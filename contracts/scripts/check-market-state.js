const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Market State...");

    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x19cEcCd6942ad38562Ee10bAfd44776ceB67e923");

    try {
        // Get PricingAMM address
        const pricingAMMAddress = await contract.pricingAMM();
        console.log("PricingAMM address:", pricingAMMAddress);

        const PricingAMM = await ethers.getContractFactory("PricingAMM");
        const pricingAMMContract = await PricingAMM.attach(pricingAMMAddress);

        // Get active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        for (let i = 0; i < activeMarkets.length; i++) {
            const marketId = activeMarkets[i];
            console.log(`\n📊 Market ${marketId.toString()}:`);
            
            // Get market data
            const market = await contract.getMarket(marketId);
            console.log(`  Question: ${market.question}`);
            
            // Get AMM market data
            const ammMarket = await pricingAMMContract.markets(marketId);
            console.log(`  AMM Market State:`);
            console.log(`    yesShares: ${ammMarket.yesShares.toString()}`);
            console.log(`    noShares: ${ammMarket.noShares.toString()}`);
            console.log(`    liquidity: ${ammMarket.liquidity.toString()}`);
            console.log(`    b: ${ammMarket.b.toString()}`);
            
            // Get current prices
            const [yesPrice, noPrice] = await pricingAMMContract.calculatePrice(marketId);
            console.log(`  Current Prices: YES=${(yesPrice.toNumber() / 100).toFixed(0)}¢, NO=${(noPrice.toNumber() / 100).toFixed(0)}¢`);
            
            // Calculate expected prices
            const totalShares = ammMarket.yesShares.add(ammMarket.noShares);
            console.log(`  Total Shares: ${totalShares.toString()}`);
            
            if (totalShares.eq(0)) {
                console.log(`  Expected: 50¢/50¢ (no shares)`);
            } else {
                const expectedYesPrice = (ammMarket.yesShares.mul(10000)).div(totalShares);
                const expectedNoPrice = (ammMarket.noShares.mul(10000)).div(totalShares);
                console.log(`  Expected: YES=${(expectedYesPrice.toNumber() / 100).toFixed(0)}¢, NO=${(expectedNoPrice.toNumber() / 100).toFixed(0)}¢`);
            }
        }
    } catch (error) {
        console.log("❌ Error during checking:", error.message);
        console.log("Error details:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
