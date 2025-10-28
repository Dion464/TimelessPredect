const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Buy/Sell Functionality...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x19cEcCd6942ad38562Ee10bAfd44776ceB67e923");

    try {
        // Get active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        if (activeMarkets.length > 0) {
            const marketId = activeMarkets[0];
            console.log(`\n📊 Testing buy/sell on market ${marketId.toString()}...`);
            
            // Test 1: Get initial market state
            console.log("\n📋 Initial market state:");
            const market = await contract.getMarket(marketId);
            console.log(`Market: ${market.question}`);
            
            // Test 2: Get current prices
            const yesPrice = await contract.getCurrentPrice(marketId, true);
            const noPrice = await contract.getCurrentPrice(marketId, false);
            console.log(`Current prices: YES=${(yesPrice.toNumber() / 100).toFixed(0)}¢, NO=${(noPrice.toNumber() / 100).toFixed(0)}¢`);
            
            // Test 3: Try to buy YES shares with 0.1 ETH
            console.log("\n🛒 Testing buy YES shares with 0.1 ETH...");
            try {
                const tx = await contract.buyShares(marketId, true, {
                    value: ethers.utils.parseEther("0.1"),
                    gasLimit: 500000 // Set explicit gas limit
                });
                console.log(`✅ Transaction sent: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`✅ Transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`);
                
                // Check prices after buy
                const newYesPrice = await contract.getCurrentPrice(marketId, true);
                const newNoPrice = await contract.getCurrentPrice(marketId, false);
                console.log(`New prices: YES=${(newYesPrice.toNumber() / 100).toFixed(0)}¢, NO=${(newNoPrice.toNumber() / 100).toFixed(0)}¢`);
                
            } catch (error) {
                console.log(`❌ Buy transaction failed:`, error.message);
                console.log("Error details:", error);
            }
            
            // Test 4: Try to buy NO shares with 0.1 ETH
            console.log("\n🛒 Testing buy NO shares with 0.1 ETH...");
            try {
                const tx = await contract.buyShares(marketId, false, {
                    value: ethers.utils.parseEther("0.1"),
                    gasLimit: 500000 // Set explicit gas limit
                });
                console.log(`✅ Transaction sent: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`✅ Transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`);
                
                // Check prices after buy
                const newYesPrice = await contract.getCurrentPrice(marketId, true);
                const newNoPrice = await contract.getCurrentPrice(marketId, false);
                console.log(`New prices: YES=${(newYesPrice.toNumber() / 100).toFixed(0)}¢, NO=${(newNoPrice.toNumber() / 100).toFixed(0)}¢`);
                
            } catch (error) {
                console.log(`❌ Buy transaction failed:`, error.message);
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
