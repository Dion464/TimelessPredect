const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Contract After Buy Transaction...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x4631BCAbD6dF18D94796344963cB60d44a4136b6");

    try {
        // Get PricingAMM address
        const pricingAMMAddress = await contract.pricingAMM();
        console.log("PricingAMM address:", pricingAMMAddress);

        const PricingAMM = await ethers.getContractFactory("PricingAMM");
        const pricingAMMContract = await PricingAMM.attach(pricingAMMAddress);

        // Get active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        if (activeMarkets.length > 0) {
            const marketId = activeMarkets[0];
            console.log(`\n📊 Testing market ${marketId.toString()}...`);
            
            // Check prices before buy
            console.log("\n📊 Prices BEFORE buy:");
            const [yesPriceBefore, noPriceBefore] = await pricingAMMContract.calculatePrice(marketId);
            console.log("YES price:", yesPriceBefore.toString());
            console.log("NO price:", noPriceBefore.toString());

            // Check market state before buy
            console.log("\n📊 Market state BEFORE buy:");
            const marketStateBefore = await pricingAMMContract.getMarketState(marketId);
            console.log("Market state:", {
                yesShares: ethers.utils.formatEther(marketStateBefore.yesShares),
                noShares: ethers.utils.formatEther(marketStateBefore.noShares),
                liquidity: ethers.utils.formatEther(marketStateBefore.liquidity),
                yesPrice: marketStateBefore.yesPrice.toString(),
                noPrice: marketStateBefore.noPrice.toString()
            });

            // Make a buy transaction
            console.log("\n📊 Making buy transaction...");
            const tx = await contract.buyShares(marketId, true, {
                value: ethers.utils.parseEther("0.1")
            });
            console.log("Buy transaction hash:", tx.hash);
            await tx.wait();
            console.log("✅ Buy transaction confirmed!");

            // Check prices after buy
            console.log("\n📊 Prices AFTER buy:");
            const [yesPriceAfter, noPriceAfter] = await pricingAMMContract.calculatePrice(marketId);
            console.log("YES price:", yesPriceAfter.toString());
            console.log("NO price:", noPriceAfter.toString());

            // Check market state after buy
            console.log("\n📊 Market state AFTER buy:");
            const marketStateAfter = await pricingAMMContract.getMarketState(marketId);
            console.log("Market state:", {
                yesShares: ethers.utils.formatEther(marketStateAfter.yesShares),
                noShares: ethers.utils.formatEther(marketStateAfter.noShares),
                liquidity: ethers.utils.formatEther(marketStateAfter.liquidity),
                yesPrice: marketStateAfter.yesPrice.toString(),
                noPrice: marketStateAfter.noPrice.toString()
            });

            // Test frontend-style call
            console.log("\n📊 Testing frontend-style call:");
            try {
                const frontendPrices = await pricingAMMContract.calculatePrice(marketId);
                console.log("Frontend prices:", {
                    yesPrice: frontendPrices[0].toString(),
                    noPrice: frontendPrices[1].toString()
                });
            } catch (error) {
                console.log("❌ Frontend-style call failed:", error.message);
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
