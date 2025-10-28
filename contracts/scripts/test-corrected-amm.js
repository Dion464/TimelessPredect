const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing CORRECTED AMM Logic...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x07882Ae1ecB7429a84f1D53048d35c4bB2056877");

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
            
            // Check initial prices
            console.log("\n📊 Initial prices:");
            const [yesPriceInitial, noPriceInitial] = await pricingAMMContract.calculatePrice(marketId);
            console.log("YES price:", (yesPriceInitial.toNumber() / 100).toFixed(0) + "¢");
            console.log("NO price:", (noPriceInitial.toNumber() / 100).toFixed(0) + "¢");

            // Make a YES buy transaction
            console.log("\n📊 Making YES buy transaction...");
            const tx1 = await contract.buyShares(marketId, true, {
                value: ethers.utils.parseEther("1.0")
            });
            console.log("Buy transaction hash:", tx1.hash);
            await tx1.wait();
            console.log("✅ YES buy transaction confirmed!");

            // Check prices after YES buy (YES should INCREASE, NO should DECREASE)
            console.log("\n📊 Prices after YES buy:");
            const [yesPriceAfter1, noPriceAfter1] = await pricingAMMContract.calculatePrice(marketId);
            console.log("YES price:", (yesPriceAfter1.toNumber() / 100).toFixed(0) + "¢", "(should be HIGHER)");
            console.log("NO price:", (noPriceAfter1.toNumber() / 100).toFixed(0) + "¢", "(should be LOWER)");

            // Make another YES buy transaction
            console.log("\n📊 Making another YES buy transaction...");
            const tx2 = await contract.buyShares(marketId, true, {
                value: ethers.utils.parseEther("1.0")
            });
            console.log("Buy transaction hash:", tx2.hash);
            await tx2.wait();
            console.log("✅ Second YES buy transaction confirmed!");

            // Check prices after second YES buy
            console.log("\n📊 Prices after second YES buy:");
            const [yesPriceAfter2, noPriceAfter2] = await pricingAMMContract.calculatePrice(marketId);
            console.log("YES price:", (yesPriceAfter2.toNumber() / 100).toFixed(0) + "¢", "(should be EVEN HIGHER)");
            console.log("NO price:", (noPriceAfter2.toNumber() / 100).toFixed(0) + "¢", "(should be EVEN LOWER)");

            // Make a NO buy transaction
            console.log("\n📊 Making NO buy transaction...");
            const tx3 = await contract.buyShares(marketId, false, {
                value: ethers.utils.parseEther("1.0")
            });
            console.log("Buy transaction hash:", tx3.hash);
            await tx3.wait();
            console.log("✅ NO buy transaction confirmed!");

            // Check prices after NO buy (NO should INCREASE, YES should DECREASE)
            console.log("\n📊 Prices after NO buy:");
            const [yesPriceAfter3, noPriceAfter3] = await pricingAMMContract.calculatePrice(marketId);
            console.log("YES price:", (yesPriceAfter3.toNumber() / 100).toFixed(0) + "¢", "(should be LOWER than before)");
            console.log("NO price:", (noPriceAfter3.toNumber() / 100).toFixed(0) + "¢", "(should be HIGHER than before)");

            console.log("\n🎉 CORRECTED AMM test completed!");
            console.log("✅ YES price should increase when buying YES shares");
            console.log("✅ NO price should increase when buying NO shares");
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
