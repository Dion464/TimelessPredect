const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Contract Directly...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x4631BCAbD6dF18D94796344963cB60d44a4136b6");

    console.log("Contract address:", contract.address);

    try {
        // Test 1: Get active markets
        console.log("\n📊 Test 1: Getting active markets...");
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        if (activeMarkets.length > 0) {
            const marketId = activeMarkets[0];
            console.log("\n📊 Test 2: Getting market data for market", marketId.toString());
            
            // Test 2: Get market data
            const market = await contract.getMarket(marketId);
            console.log("Market data:", {
                id: market.id.toString(),
                question: market.question,
                active: market.active,
                resolved: market.resolved
            });

            // Test 3: Get pricing AMM address
            console.log("\n📊 Test 3: Getting PricingAMM address...");
            const pricingAMMAddress = await contract.pricingAMM();
            console.log("PricingAMM address:", pricingAMMAddress);

            // Test 4: Test PricingAMM contract
            if (pricingAMMAddress !== "0x0000000000000000000000000000000000000000") {
                console.log("\n📊 Test 4: Testing PricingAMM contract...");
                const PricingAMM = await ethers.getContractFactory("PricingAMM");
                const pricingAMMContract = await PricingAMM.attach(pricingAMMAddress);
                
                // Test calculatePrice
                const [yesPrice, noPrice] = await pricingAMMContract.calculatePrice(marketId);
                console.log("Prices from PricingAMM:", {
                    yesPrice: yesPrice.toString(),
                    noPrice: noPrice.toString()
                });

                // Test calculateSharesToGive
                const sharesToGive = await pricingAMMContract.calculateSharesToGive(
                    marketId, 
                    true, 
                    ethers.utils.parseEther("0.1")
                );
                console.log("Shares to give for 0.1 ETH:", ethers.utils.formatEther(sharesToGive));

                // Test buyYes function (this is where the error likely occurs)
                console.log("\n📊 Test 5: Testing buyYes function...");
                try {
                    const tx = await pricingAMMContract.buyYes(marketId, ethers.utils.parseEther("0.1"), {
                        value: ethers.utils.parseEther("0.1")
                    });
                    console.log("buyYes transaction hash:", tx.hash);
                    await tx.wait();
                    console.log("✅ buyYes transaction successful!");
                } catch (error) {
                    console.log("❌ buyYes transaction failed:", error.message);
                }
            }

            // Test 5: Test main contract buyShares function
            console.log("\n📊 Test 6: Testing main contract buyShares function...");
            try {
                const tx = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("0.1")
                });
                console.log("buyShares transaction hash:", tx.hash);
                await tx.wait();
                console.log("✅ buyShares transaction successful!");
            } catch (error) {
                console.log("❌ buyShares transaction failed:", error.message);
                console.log("Error details:", error);
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

