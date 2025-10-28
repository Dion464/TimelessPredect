const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking PricingAMM State...");

    const [deployer] = await ethers.getSigners();
    console.log("Checking with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x4631BCAbD6dF18D94796344963cB60d44a4136b6");

    try {
        // Get PricingAMM address
        const pricingAMMAddress = await contract.pricingAMM();
        console.log("PricingAMM address:", pricingAMMAddress);

        const PricingAMM = await ethers.getContractFactory("PricingAMM");
        const pricingAMMContract = await PricingAMM.attach(pricingAMMAddress);

        // Check market states
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        for (let i = 0; i < Math.min(activeMarkets.length, 3); i++) {
            const marketId = activeMarkets[i];
            console.log(`\n📊 Checking market ${marketId.toString()}...`);
            
            try {
                // Check market state in PricingAMM
                const marketState = await pricingAMMContract.getMarketState(marketId);
                console.log("Market state:", {
                    yesShares: ethers.utils.formatEther(marketState.yesShares),
                    noShares: ethers.utils.formatEther(marketState.noShares),
                    liquidity: ethers.utils.formatEther(marketState.liquidity),
                    yesPrice: marketState.yesPrice.toString(),
                    noPrice: marketState.noPrice.toString()
                });

                // Test if market is initialized
                const markets = await pricingAMMContract.markets(marketId);
                console.log("Market struct:", {
                    yesShares: ethers.utils.formatEther(markets.yesShares),
                    noShares: ethers.utils.formatEther(markets.noShares),
                    liquidity: ethers.utils.formatEther(markets.liquidity),
                    b: ethers.utils.formatEther(markets.b)
                });

            } catch (error) {
                console.log("❌ Error checking market", marketId.toString(), ":", error.message);
            }
        }

    } catch (error) {
        console.log("❌ Error during check:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

