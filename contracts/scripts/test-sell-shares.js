const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing SELL SHARES Functionality...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0xefAB0Beb0A557E452b398035eA964948c750b2Fd");

    const marketId = 1; // Test market 1
    
    console.log(`\n📊 Testing Sell Functionality for Market ${marketId}`);
    
    // Step 1: Buy some shares first
    console.log("\n🟢 STEP 1: Buying YES shares...");
    const buyTx = await contract.buyShares(marketId, true, {
        value: ethers.utils.parseEther("1.0")
    });
    await buyTx.wait();
    console.log("✅ Bought YES shares!");
    
    // Check position after buy
    const positionAfterBuy = await contract.getUserPosition(marketId, deployer.address);
    console.log("Position after buy:");
    console.log("  YES shares:", ethers.utils.formatEther(positionAfterBuy.yesShares));
    console.log("  NO shares:", ethers.utils.formatEther(positionAfterBuy.noShares));
    console.log("  Total invested:", ethers.utils.formatEther(positionAfterBuy.totalInvested), "ETH");
    
    const sharesBought = parseFloat(ethers.utils.formatEther(positionAfterBuy.yesShares));
    
    // Step 2: Try to sell half of the shares
    const sharesToSell = sharesBought / 2;
    console.log(`\n🔴 STEP 2: Selling ${sharesToSell.toFixed(4)} YES shares...`);
    
    try {
        const sellTx = await contract.sellShares(
            marketId, 
            true, // selling YES
            ethers.utils.parseEther(sharesToSell.toString())
        );
        await sellTx.wait();
        console.log("✅ Sold YES shares successfully!");
        
        // Check position after sell
        const positionAfterSell = await contract.getUserPosition(marketId, deployer.address);
        console.log("\nPosition after sell:");
        console.log("  YES shares:", ethers.utils.formatEther(positionAfterSell.yesShares));
        console.log("  NO shares:", ethers.utils.formatEther(positionAfterSell.noShares));
        console.log("  Total invested:", ethers.utils.formatEther(positionAfterSell.totalInvested), "ETH");
        
        // Calculate difference
        const sharesRemaining = parseFloat(ethers.utils.formatEther(positionAfterSell.yesShares));
        const sharesSold = sharesBought - sharesRemaining;
        
        console.log("\n📊 Summary:");
        console.log("  Shares bought:", sharesBought.toFixed(4));
        console.log("  Shares sold:", sharesSold.toFixed(4));
        console.log("  Shares remaining:", sharesRemaining.toFixed(4));
        
        console.log("\n🎉 SELL FUNCTIONALITY TEST PASSED!");
        
    } catch (error) {
        console.error("\n❌ SELL FUNCTIONALITY TEST FAILED!");
        console.error("Error:", error.message);
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
