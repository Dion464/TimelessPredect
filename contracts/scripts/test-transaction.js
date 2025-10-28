const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Transaction Execution...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x07882Ae1ecB7429a84f1D53048d35c4bB2056877");

    try {
        // Get active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        if (activeMarkets.length > 0) {
            const marketId = activeMarkets[0];
            console.log(`\n📊 Testing transaction on market ${marketId.toString()}...`);
            
            // Test with a small amount first
            console.log("\n📊 Testing with 0.01 ETH...");
            try {
                const tx1 = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("0.01")
                });
                console.log("Transaction hash:", tx1.hash);
                const receipt1 = await tx1.wait();
                console.log("✅ Transaction successful! Gas used:", receipt1.gasUsed.toString());
            } catch (error) {
                console.log("❌ Transaction failed:", error.message);
            }

            // Test with 0.1 ETH
            console.log("\n📊 Testing with 0.1 ETH...");
            try {
                const tx2 = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("0.1")
                });
                console.log("Transaction hash:", tx2.hash);
                const receipt2 = await tx2.wait();
                console.log("✅ Transaction successful! Gas used:", receipt2.gasUsed.toString());
            } catch (error) {
                console.log("❌ Transaction failed:", error.message);
            }

            // Test with 1 ETH
            console.log("\n📊 Testing with 1 ETH...");
            try {
                const tx3 = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("1.0")
                });
                console.log("Transaction hash:", tx3.hash);
                const receipt3 = await tx3.wait();
                console.log("✅ Transaction successful! Gas used:", receipt3.gasUsed.toString());
            } catch (error) {
                console.log("❌ Transaction failed:", error.message);
            }

            // Test with 10 ETH (like the user tried)
            console.log("\n📊 Testing with 10 ETH...");
            try {
                const tx4 = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("10.0")
                });
                console.log("Transaction hash:", tx4.hash);
                const receipt4 = await tx4.wait();
                console.log("✅ Transaction successful! Gas used:", receipt4.gasUsed.toString());
            } catch (error) {
                console.log("❌ Transaction failed:", error.message);
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
