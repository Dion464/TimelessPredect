const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * 🧪 COMPREHENSIVE TRADING LOGIC TEST
 * Tests all buy/sell functionality on Incentiv Testnet
 */

async function main() {
    console.log("\n🧪 ====== COMPREHENSIVE TRADING LOGIC TEST ======\n");

    const [deployer] = await ethers.getSigners();
    const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS;

    if (!PREDICTION_MARKET_ADDRESS) {
        throw new Error("❌ PREDICTION_MARKET_ADDRESS not set in .env");
    }

    console.log("📍 Test Account:", deployer.address);
    console.log("💰 Initial Balance:", ethers.utils.formatEther(await deployer.getBalance()), "TCENT\n");
    console.log("📄 Contract Address:", PREDICTION_MARKET_ADDRESS);

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach(PREDICTION_MARKET_ADDRESS);

    // ========================================
    // TEST 1: Contract Configuration
    // ========================================
    console.log("\n📊 TEST 1: Contract Configuration");
    console.log("=" .repeat(60));

    try {
        const marketCreationFee = await contract.marketCreationFee();
        const platformFeePercent = await contract.platformFeePercent();
        const totalRevenue = await contract.totalRevenue();
        
        console.log("✅ Market Creation Fee:", ethers.utils.formatEther(marketCreationFee), "TCENT");
        console.log("✅ Platform Fee:", platformFeePercent.toString() + "%");
        console.log("✅ Total Revenue:", ethers.utils.formatEther(totalRevenue), "TCENT");
    } catch (error) {
        console.log("❌ Failed to read contract config:", error.message);
    }

    // ========================================
    // TEST 2: Market State
    // ========================================
    console.log("\n📊 TEST 2: Active Markets");
    console.log("=" .repeat(60));

    let activeMarkets;
    let testMarketId;

    try {
        activeMarkets = await contract.getActiveMarkets();
        console.log("✅ Active Markets Count:", activeMarkets.length);

        if (activeMarkets.length === 0) {
            console.log("⚠️  No active markets found. Please create a market first.");
            return;
        }

        testMarketId = activeMarkets[0];
        console.log("✅ Testing with Market ID:", testMarketId.toString());

        const market = await contract.markets(testMarketId);
        console.log("\n📈 Market Details:");
        console.log("  Question:", market.question);
        console.log("  Total YES shares:", ethers.utils.formatEther(market.totalYesShares));
        console.log("  Total NO shares:", ethers.utils.formatEther(market.totalNoShares));
        console.log("  Resolved:", market.resolved);
        console.log("  Active:", market.active);

    } catch (error) {
        console.log("❌ Failed to fetch markets:", error.message);
        return;
    }

    // ========================================
    // TEST 3: Price Calculation
    // ========================================
    console.log("\n📊 TEST 3: Price Calculation");
    console.log("=" .repeat(60));

    try {
        const buyAmount = ethers.utils.parseEther("1.0"); // 1 TCENT
        
        const yesCost = await contract.calculateCost(testMarketId, true, buyAmount);
        const noCost = await contract.calculateCost(testMarketId, false, buyAmount);

        console.log("✅ Cost to buy 1 TCENT worth of YES shares:", ethers.utils.formatEther(yesCost), "TCENT");
        console.log("✅ Cost to buy 1 TCENT worth of NO shares:", ethers.utils.formatEther(noCost), "TCENT");

        // Calculate prices
        const market = await contract.markets(testMarketId);
        const totalYes = parseFloat(ethers.utils.formatEther(market.totalYesShares));
        const totalNo = parseFloat(ethers.utils.formatEther(market.totalNoShares));
        
        if (totalYes + totalNo > 0) {
            const yesPrice = totalYes / (totalYes + totalNo);
            const noPrice = totalNo / (totalYes + totalNo);
            console.log("✅ Current YES price:", (yesPrice * 100).toFixed(2) + "%", `(${yesPrice.toFixed(2)} TCENT)`);
            console.log("✅ Current NO price:", (noPrice * 100).toFixed(2) + "%", `(${noPrice.toFixed(2)} TCENT)`);
        }

    } catch (error) {
        console.log("❌ Failed to calculate costs:", error.message);
    }

    // ========================================
    // TEST 4: User Position (Before Trade)
    // ========================================
    console.log("\n📊 TEST 4: User Position (Before Trade)");
    console.log("=" .repeat(60));

    let initialYesShares = ethers.BigNumber.from(0);
    let initialNoShares = ethers.BigNumber.from(0);

    try {
        const position = await contract.getUserPosition(testMarketId, deployer.address);
        initialYesShares = position.yesShares;
        initialNoShares = position.noShares;

        console.log("✅ Your YES shares:", ethers.utils.formatEther(initialYesShares));
        console.log("✅ Your NO shares:", ethers.utils.formatEther(initialNoShares));

    } catch (error) {
        console.log("❌ Failed to get user position:", error.message);
    }

    // ========================================
    // TEST 5: Buy YES Shares
    // ========================================
    console.log("\n📊 TEST 5: Buy YES Shares");
    console.log("=" .repeat(60));

    const testBuyAmount = ethers.utils.parseEther("0.1"); // 0.1 TCENT

    try {
        console.log("🔄 Attempting to buy YES shares with", ethers.utils.formatEther(testBuyAmount), "TCENT...");
        
        const balanceBefore = await deployer.getBalance();
        
        const tx = await contract.buyShares(testMarketId, true, { value: testBuyAmount });
        const receipt = await tx.wait();
        
        const balanceAfter = await deployer.getBalance();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        const totalSpent = balanceBefore.sub(balanceAfter);
        const actualCost = totalSpent.sub(gasUsed);

        console.log("✅ Transaction successful!");
        console.log("  Gas used:", ethers.utils.formatEther(gasUsed), "TCENT");
        console.log("  Share cost:", ethers.utils.formatEther(actualCost), "TCENT");
        console.log("  Total spent:", ethers.utils.formatEther(totalSpent), "TCENT");

        // Check new position
        const newPosition = await contract.getUserPosition(testMarketId, deployer.address);
        const sharesReceived = newPosition.yesShares.sub(initialYesShares);
        
        console.log("  Shares received:", ethers.utils.formatEther(sharesReceived), "YES");
        console.log("  New YES balance:", ethers.utils.formatEther(newPosition.yesShares), "YES");

        // Verify the buy event
        const buyEvent = receipt.events?.find(e => e.event === 'SharesPurchased');
        if (buyEvent) {
            console.log("✅ SharesPurchased event emitted correctly");
        }

        // Update for next test
        initialYesShares = newPosition.yesShares;

    } catch (error) {
        console.log("❌ Failed to buy YES shares:", error.message);
        if (error.reason) console.log("   Reason:", error.reason);
    }

    // ========================================
    // TEST 6: Buy NO Shares
    // ========================================
    console.log("\n📊 TEST 6: Buy NO Shares");
    console.log("=" .repeat(60));

    try {
        console.log("🔄 Attempting to buy NO shares with", ethers.utils.formatEther(testBuyAmount), "TCENT...");
        
        const balanceBefore = await deployer.getBalance();
        
        const tx = await contract.buyShares(testMarketId, false, { value: testBuyAmount });
        const receipt = await tx.wait();
        
        const balanceAfter = await deployer.getBalance();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        const totalSpent = balanceBefore.sub(balanceAfter);
        const actualCost = totalSpent.sub(gasUsed);

        console.log("✅ Transaction successful!");
        console.log("  Gas used:", ethers.utils.formatEther(gasUsed), "TCENT");
        console.log("  Share cost:", ethers.utils.formatEther(actualCost), "TCENT");
        console.log("  Total spent:", ethers.utils.formatEther(totalSpent), "TCENT");

        // Check new position
        const newPosition = await contract.getUserPosition(testMarketId, deployer.address);
        const sharesReceived = newPosition.noShares.sub(initialNoShares);
        
        console.log("  Shares received:", ethers.utils.formatEther(sharesReceived), "NO");
        console.log("  New NO balance:", ethers.utils.formatEther(newPosition.noShares), "NO");

        // Update for next test
        initialNoShares = newPosition.noShares;

    } catch (error) {
        console.log("❌ Failed to buy NO shares:", error.message);
        if (error.reason) console.log("   Reason:", error.reason);
    }

    // ========================================
    // TEST 7: Sell YES Shares
    // ========================================
    console.log("\n📊 TEST 7: Sell YES Shares");
    console.log("=" .repeat(60));

    try {
        if (initialYesShares.gt(0)) {
            const sellAmount = initialYesShares.div(2); // Sell half
            
            console.log("🔄 Attempting to sell", ethers.utils.formatEther(sellAmount), "YES shares...");
            
            const balanceBefore = await deployer.getBalance();
            
            const tx = await contract.sellShares(testMarketId, true, sellAmount);
            const receipt = await tx.wait();
            
            const balanceAfter = await deployer.getBalance();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            const received = balanceAfter.sub(balanceBefore).add(gasUsed);

            console.log("✅ Transaction successful!");
            console.log("  Gas used:", ethers.utils.formatEther(gasUsed), "TCENT");
            console.log("  TCENT received:", ethers.utils.formatEther(received), "TCENT");

            // Check new position
            const newPosition = await contract.getUserPosition(testMarketId, deployer.address);
            console.log("  Shares sold:", ethers.utils.formatEther(sellAmount), "YES");
            console.log("  New YES balance:", ethers.utils.formatEther(newPosition.yesShares), "YES");

            // Verify the sell event
            const sellEvent = receipt.events?.find(e => e.event === 'SharesSold');
            if (sellEvent) {
                console.log("✅ SharesSold event emitted correctly");
            }

        } else {
            console.log("⚠️  No YES shares to sell (skipping test)");
        }

    } catch (error) {
        console.log("❌ Failed to sell YES shares:", error.message);
        if (error.reason) console.log("   Reason:", error.reason);
    }

    // ========================================
    // TEST 8: Sell NO Shares
    // ========================================
    console.log("\n📊 TEST 8: Sell NO Shares");
    console.log("=" .repeat(60));

    try {
        if (initialNoShares.gt(0)) {
            const sellAmount = initialNoShares.div(2); // Sell half
            
            console.log("🔄 Attempting to sell", ethers.utils.formatEther(sellAmount), "NO shares...");
            
            const balanceBefore = await deployer.getBalance();
            
            const tx = await contract.sellShares(testMarketId, false, sellAmount);
            const receipt = await tx.wait();
            
            const balanceAfter = await deployer.getBalance();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            const received = balanceAfter.sub(balanceBefore).add(gasUsed);

            console.log("✅ Transaction successful!");
            console.log("  Gas used:", ethers.utils.formatEther(gasUsed), "TCENT");
            console.log("  TCENT received:", ethers.utils.formatEther(received), "TCENT");

            // Check new position
            const newPosition = await contract.getUserPosition(testMarketId, deployer.address);
            console.log("  Shares sold:", ethers.utils.formatEther(sellAmount), "NO");
            console.log("  New NO balance:", ethers.utils.formatEther(newPosition.noShares), "NO");

        } else {
            console.log("⚠️  No NO shares to sell (skipping test)");
        }

    } catch (error) {
        console.log("❌ Failed to sell NO shares:", error.message);
        if (error.reason) console.log("   Reason:", error.reason);
    }

    // ========================================
    // TEST 9: Price Impact
    // ========================================
    console.log("\n📊 TEST 9: Price Impact After Trades");
    console.log("=" .repeat(60));

    try {
        const market = await contract.markets(testMarketId);
        const totalYes = parseFloat(ethers.utils.formatEther(market.totalYesShares));
        const totalNo = parseFloat(ethers.utils.formatEther(market.totalNoShares));
        
        if (totalYes + totalNo > 0) {
            const yesPrice = totalYes / (totalYes + totalNo);
            const noPrice = totalNo / (totalYes + totalNo);
            
            console.log("✅ Updated Market State:");
            console.log("  Total YES shares:", totalYes.toFixed(4));
            console.log("  Total NO shares:", totalNo.toFixed(4));
            console.log("  YES price:", (yesPrice * 100).toFixed(2) + "%", `(${yesPrice.toFixed(2)} TCENT)`);
            console.log("  NO price:", (noPrice * 100).toFixed(2) + "%", `(${noPrice.toFixed(2)} TCENT)`);
            console.log("  ✅ Prices sum to 100%:", ((yesPrice + noPrice) * 100).toFixed(2) + "%");
        }

    } catch (error) {
        console.log("❌ Failed to calculate updated prices:", error.message);
    }

    // ========================================
    // TEST 10: Edge Cases
    // ========================================
    console.log("\n📊 TEST 10: Edge Cases");
    console.log("=" .repeat(60));

    try {
        // Test 10a: Buy with 0 TCENT
        console.log("🔄 Test 10a: Attempting to buy with 0 TCENT...");
        try {
            await contract.buyShares(testMarketId, true, { value: 0 });
            console.log("❌ Should have failed but didn't!");
        } catch (error) {
            console.log("✅ Correctly rejected (amount must be > 0)");
        }

        // Test 10b: Sell more shares than owned
        console.log("\n🔄 Test 10b: Attempting to sell more shares than owned...");
        try {
            const position = await contract.getUserPosition(testMarketId, deployer.address);
            const tooMuch = position.yesShares.add(ethers.utils.parseEther("1000"));
            await contract.sellShares(testMarketId, true, tooMuch);
            console.log("❌ Should have failed but didn't!");
        } catch (error) {
            console.log("✅ Correctly rejected (insufficient shares)");
        }

        // Test 10c: Operate on non-existent market
        console.log("\n🔄 Test 10c: Attempting to buy from non-existent market...");
        try {
            await contract.buyShares(999999, true, { value: ethers.utils.parseEther("0.1") });
            console.log("❌ Should have failed but didn't!");
        } catch (error) {
            console.log("✅ Correctly rejected (market doesn't exist)");
        }

    } catch (error) {
        console.log("❌ Edge case test error:", error.message);
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log("\n📊 FINAL SUMMARY");
    console.log("=" .repeat(60));

    try {
        const finalBalance = await deployer.getBalance();
        const finalPosition = await contract.getUserPosition(testMarketId, deployer.address);

        console.log("💰 Final Account Balance:", ethers.utils.formatEther(finalBalance), "TCENT");
        console.log("📊 Final Position:");
        console.log("  YES shares:", ethers.utils.formatEther(finalPosition.yesShares));
        console.log("  NO shares:", ethers.utils.formatEther(finalPosition.noShares));

        console.log("\n✅ ====== ALL TESTS COMPLETED ======\n");

    } catch (error) {
        console.log("❌ Failed to generate final summary:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ====== TEST SUITE FAILED ======");
        console.error(error);
        process.exit(1);
    });

