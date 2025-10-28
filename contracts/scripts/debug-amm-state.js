const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Debugging AMM State...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x6C2d83262fF84cBaDb3e416D527403135D757892");

    // Get PricingAMM address
    const pricingAMMAddress = await contract.pricingAMM();
    console.log("PricingAMM address:", pricingAMMAddress);

    // Get PricingAMM contract
    const PricingAMM = await ethers.getContractFactory("PricingAMM");
    const pricingAMM = await PricingAMM.attach(pricingAMMAddress);

    const marketId = 1;
    
    console.log(`\n📊 Market ${marketId} State:`);
    
    // Get market state from PricingAMM
    const marketState = await pricingAMM.getMarketState(marketId);
    console.log("Market State:");
    console.log("  YES shares:", ethers.utils.formatEther(marketState.yesShares));
    console.log("  NO shares:", ethers.utils.formatEther(marketState.noShares));
    console.log("  Liquidity:", ethers.utils.formatEther(marketState.liquidity));
    console.log("  YES price:", (marketState.yesPrice.toNumber() / 100).toFixed(0) + "¢");
    console.log("  NO price:", (marketState.noPrice.toNumber() / 100).toFixed(0) + "¢");
    
    // Get market data from main contract
    const marketData = await contract.getMarket(marketId);
    console.log("\nMain Contract Market Data:");
    console.log("  Total YES shares:", ethers.utils.formatEther(marketData.totalYesShares));
    console.log("  Total NO shares:", ethers.utils.formatEther(marketData.totalNoShares));
    console.log("  Total volume:", ethers.utils.formatEther(marketData.totalVolume));
    
    // Test a small buy transaction
    console.log("\n🔄 Making small YES buy transaction...");
    const buyTx = await contract.buyShares(marketId, true, {
        value: ethers.utils.parseEther("0.01")
    });
    console.log("Buy transaction hash:", buyTx.hash);
    await buyTx.wait();
    console.log("✅ Buy transaction confirmed!");
    
    // Check state after buy
    console.log(`\n📊 Market ${marketId} State AFTER BUY:`);
    const marketStateAfter = await pricingAMM.getMarketState(marketId);
    console.log("Market State After:");
    console.log("  YES shares:", ethers.utils.formatEther(marketStateAfter.yesShares));
    console.log("  NO shares:", ethers.utils.formatEther(marketStateAfter.noShares));
    console.log("  Liquidity:", ethers.utils.formatEther(marketStateAfter.liquidity));
    console.log("  YES price:", (marketStateAfter.yesPrice.toNumber() / 100).toFixed(0) + "¢");
    console.log("  NO price:", (marketStateAfter.noPrice.toNumber() / 100).toFixed(0) + "¢");
    
    console.log("\n🎉 Debug completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
