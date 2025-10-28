const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing SELL Price Update...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0xC66AB83418C20A65C3f8e83B3d11c8C3a6097b6F");

    // Get PricingAMM
    const pricingAMMAddress = await contract.pricingAMM();
    const PricingAMM = await ethers.getContractFactory("PricingAMM");
    const pricingAMM = await PricingAMM.attach(pricingAMMAddress);

    const marketId = 1;
    
    console.log(`\n📊 Testing Sell Price Updates for Market ${marketId}`);
    
    // Step 1: Buy YES shares
    console.log("\n🟢 STEP 1: Buying YES shares with 1 ETH...");
    const buyTx = await contract.buyShares(marketId, true, {
        value: ethers.utils.parseEther("1.0")
    });
    await buyTx.wait();
    
    // Get prices after buy
    const pricesAfterBuy = await pricingAMM.calculatePrice(marketId);
    console.log("✅ Bought YES shares!");
    console.log(`   YES price: ${(pricesAfterBuy[0].toNumber() / 100).toFixed(0)}¢`);
    console.log(`   NO price: ${(pricesAfterBuy[1].toNumber() / 100).toFixed(0)}¢`);
    
    // Get shares
    const position = await contract.getUserPosition(marketId, deployer.address);
    const yesShares = parseFloat(ethers.utils.formatEther(position.yesShares));
    console.log(`   YES shares held: ${yesShares.toFixed(4)}`);
    
    // Step 2: Sell half the YES shares
    const sharesToSell = yesShares / 2;
    console.log(`\n🔴 STEP 2: Selling ${sharesToSell.toFixed(4)} YES shares...`);
    
    const sellTx = await contract.sellShares(
        marketId,
        true,
        ethers.utils.parseEther(sharesToSell.toString())
    );
    await sellTx.wait();
    console.log("✅ Sold YES shares!");
    
    // Get prices after sell
    const pricesAfterSell = await pricingAMM.calculatePrice(marketId);
    console.log(`   YES price: ${(pricesAfterSell[0].toNumber() / 100).toFixed(0)}¢`);
    console.log(`   NO price: ${(pricesAfterSell[1].toNumber() / 100).toFixed(0)}¢`);
    
    // Check if prices changed
    const yesPriceChange = pricesAfterSell[0].toNumber() - pricesAfterBuy[0].toNumber();
    const noPriceChange = pricesAfterSell[1].toNumber() - pricesAfterBuy[1].toNumber();
    
    console.log(`\n📊 Price Changes:`);
    console.log(`   YES price change: ${yesPriceChange > 0 ? '+' : ''}${(yesPriceChange / 100).toFixed(0)}¢`);
    console.log(`   NO price change: ${noPriceChange > 0 ? '+' : ''}${(noPriceChange / 100).toFixed(0)}¢`);
    
    if (yesPriceChange < 0 && noPriceChange > 0) {
        console.log("\n🎉 ✅ SELL PRICE UPDATE TEST PASSED!");
        console.log("   Selling YES shares decreased YES price and increased NO price!");
    } else {
        console.log("\n❌ SELL PRICE UPDATE TEST FAILED!");
        console.log("   Prices didn't change as expected!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
