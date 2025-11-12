const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🧪 Testing Price Clamping and Extreme Trading...\n");

    const [deployer, buyer1, buyer2] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Buyer 1:", buyer1.address);
    console.log("Buyer 2:", buyer2.address);

    // Load contract address from config
    const configPath = path.join(__dirname, '../../frontend/src/contracts/config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const PREDICTION_MARKET_ADDRESS_MATCH = configContent.match(/PREDICTION_MARKET_ADDRESS": "(0x[a-fA-F0-9]{40})"/);
    const PREDICTION_MARKET_ADDRESS = PREDICTION_MARKET_ADDRESS_MATCH ? PREDICTION_MARKET_ADDRESS_MATCH[1] : null;

    if (!PREDICTION_MARKET_ADDRESS) {
        console.error("❌ Prediction Market address not found in config.js");
        return;
    }

    console.log("Contract address:", PREDICTION_MARKET_ADDRESS);
    console.log("");

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const predictionMarket = ETHPredictionMarket.attach(PREDICTION_MARKET_ADDRESS);

    // Get AMM address
    const pricingAMMAddress = await predictionMarket.pricingAMM();
    const PricingAMM = await ethers.getContractFactory("PricingAMM");
    const pricingAMM = PricingAMM.attach(pricingAMMAddress);

    const activeMarketIds = await predictionMarket.getActiveMarkets();
    if (activeMarketIds.length === 0) {
        console.log("❌ No active markets found. Creating a test market...");
        
        // Create a test market
        const marketCreationFee = await predictionMarket.marketCreationFee();
        const tx = await predictionMarket.createMarket(
            "Test Market for Price Clamping",
            "Testing that prices never hit 0 or 100",
            "Test",
            Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
            Math.floor(Date.now() / 1000) + (37 * 24 * 60 * 60), // 37 days from now
            { value: marketCreationFee }
        );
        await tx.wait();
        const newMarketIds = await predictionMarket.getActiveMarkets();
        activeMarketIds.push(newMarketIds[newMarketIds.length - 1]);
    }

    const marketId = activeMarketIds[0];
    console.log("📊 Testing with market ID:", marketId.toString());
    console.log("");

    // Helper function to get and format prices
    const getPrices = async () => {
        const [yesPrice, noPrice] = await pricingAMM.calculatePrice(marketId);
        const yesCents = yesPrice.toNumber() / 100;
        const noCents = noPrice.toNumber() / 100;
        const sum = yesCents + noCents;
        
        return {
            yesPrice: yesPrice.toNumber(),
            noPrice: noPrice.toNumber(),
            yesCents: yesCents.toFixed(2),
            noCents: noCents.toFixed(2),
            sum: sum.toFixed(2),
            isValid: yesPrice.toNumber() >= 100 && yesPrice.toNumber() <= 9900 && noPrice.toNumber() >= 100 && noPrice.toNumber() <= 9900
        };
    };

    // Test 1: Check initial prices
    console.log("📋 Test 1: Initial State");
    let prices = await getPrices();
    console.log(`  YES: ${prices.yesCents}¢ (${prices.yesPrice} basis points)`);
    console.log(`  NO: ${prices.noCents}¢ (${prices.noPrice} basis points)`);
    console.log(`  Sum: ${prices.sum}¢ (should be 100.00¢)`);
    console.log(`  Valid range: ${prices.isValid ? '✅ YES' : '❌ NO'}`);
    
    if (Math.abs(parseFloat(prices.sum) - 100.0) > 0.01) {
        console.log("  ❌ FAIL: Prices don't sum to 100%");
        return;
    }
    if (!prices.isValid) {
        console.log("  ❌ FAIL: Prices outside valid range (1%-99%)");
        return;
    }
    console.log("  ✅ PASS\n");

    // Test 2: Push YES price high by buying many YES shares
    console.log("📋 Test 2: Pushing YES Price High");
    console.log("  Making 10 consecutive YES buys of 0.1 ETH each...\n");
    
    for (let i = 1; i <= 10; i++) {
        try {
            const buyAmount = ethers.utils.parseEther("0.1");
            const tx = await predictionMarket.connect(buyer1).buyShares(marketId, true, { value: buyAmount });
            await tx.wait();
            
            prices = await getPrices();
            console.log(`  Trade ${i}: YES ${prices.yesCents}¢ | NO ${prices.noCents}¢ | Sum: ${prices.sum}¢`);
            
            if (!prices.isValid) {
                console.log(`  ❌ FAIL at trade ${i}: Price outside valid range`);
                return;
            }
            if (Math.abs(parseFloat(prices.sum) - 100.0) > 0.01) {
                console.log(`  ❌ FAIL at trade ${i}: Prices don't sum to 100%`);
                return;
            }
        } catch (error) {
            console.log(`  ❌ FAIL at trade ${i}: ${error.message}`);
            return;
        }
    }
    
    console.log("  ✅ PASS: All trades successful, prices stay in range\n");

    // Test 3: Verify we can still buy NO even when YES is high
    console.log("📋 Test 3: Buying NO When YES Price is High");
    prices = await getPrices();
    console.log(`  Current: YES ${prices.yesCents}¢ | NO ${prices.noCents}¢`);
    
    try {
        const buyAmount = ethers.utils.parseEther("0.1");
        const tx = await predictionMarket.connect(buyer2).buyShares(marketId, false, { value: buyAmount });
        await tx.wait();
        
        const newPrices = await getPrices();
        console.log(`  After NO buy: YES ${newPrices.yesCents}¢ | NO ${newPrices.noCents}¢ | Sum: ${newPrices.sum}¢`);
        console.log(`  Valid range: ${newPrices.isValid ? '✅ YES' : '❌ NO'}`);
        
        if (!newPrices.isValid) {
            console.log("  ❌ FAIL: Price outside valid range after NO buy");
            return;
        }
        if (Math.abs(parseFloat(newPrices.sum) - 100.0) > 0.01) {
            console.log("  ❌ FAIL: Prices don't sum to 100%");
            return;
        }
        console.log("  ✅ PASS: Can still buy NO when YES is high\n");
    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}`);
        return;
    }

    // Test 4: Push NO price high by buying many NO shares
    console.log("📋 Test 4: Pushing NO Price High");
    console.log("  Making 15 consecutive NO buys of 0.1 ETH each...\n");
    
    for (let i = 1; i <= 15; i++) {
        try {
            const buyAmount = ethers.utils.parseEther("0.1");
            const tx = await predictionMarket.connect(buyer2).buyShares(marketId, false, { value: buyAmount });
            await tx.wait();
            
            prices = await getPrices();
            console.log(`  Trade ${i}: YES ${prices.yesCents}¢ | NO ${prices.noCents}¢ | Sum: ${prices.sum}¢`);
            
            if (!prices.isValid) {
                console.log(`  ❌ FAIL at trade ${i}: Price outside valid range`);
                return;
            }
            if (prices.noCents >= "99.99" || prices.yesCents <= "0.01") {
                console.log(`  ⚠️  WARNING at trade ${i}: Approaching extreme (NO: ${prices.noCents}¢, YES: ${prices.yesCents}¢)`);
            }
            if (Math.abs(parseFloat(prices.sum) - 100.0) > 0.01) {
                console.log(`  ❌ FAIL at trade ${i}: Prices don't sum to 100%`);
                return;
            }
        } catch (error) {
            console.log(`  ❌ FAIL at trade ${i}: ${error.message}`);
            return;
        }
    }
    
    console.log("  ✅ PASS: All trades successful, prices stay clamped\n");

    // Test 5: Final state check
    console.log("📋 Test 5: Final State Verification");
    prices = await getPrices();
    console.log(`  Final YES: ${prices.yesCents}¢ (${prices.yesPrice} basis points)`);
    console.log(`  Final NO: ${prices.noCents}¢ (${prices.noPrice} basis points)`);
    console.log(`  Sum: ${prices.sum}¢`);
    console.log(`  Valid range: ${prices.isValid ? '✅ YES' : '❌ NO'}`);
    
    // Verify prices never hit extremes
    const minPrice = Math.min(prices.yesPrice, prices.noPrice);
    const maxPrice = Math.max(prices.yesPrice, prices.noPrice);
    
    if (minPrice < 100) {
        console.log(`  ❌ FAIL: Minimum price (${minPrice}) is below 100 (1%)`);
        return;
    }
    if (maxPrice > 9900) {
        console.log(`  ❌ FAIL: Maximum price (${maxPrice}) is above 9900 (99%)`);
        return;
    }
    if (Math.abs(parseFloat(prices.sum) - 100.0) > 0.01) {
        console.log("  ❌ FAIL: Prices don't sum to 100%");
        return;
    }
    
    console.log(`  ✅ PASS: Prices clamped correctly (${(minPrice/100).toFixed(2)}¢ - ${(maxPrice/100).toFixed(2)}¢)\n`);

    // Test 6: Try to buy at extreme prices
    console.log("📋 Test 6: Trading at Extreme Prices");
    console.log(`  Attempting to buy YES at ${prices.yesCents}¢ (very low price)...`);
    
    try {
        const buyAmount = ethers.utils.parseEther("0.01");
        const tx = await predictionMarket.connect(buyer1).buyShares(marketId, true, { value: buyAmount });
        await tx.wait();
        
        const newPrices = await getPrices();
        console.log(`  ✅ SUCCESS: Could buy YES even at low price`);
        console.log(`  New prices: YES ${newPrices.yesCents}¢ | NO ${newPrices.noCents}¢ | Sum: ${newPrices.sum}¢`);
        console.log(`  Valid range: ${newPrices.isValid ? '✅ YES' : '❌ NO'}`);
        
        if (!newPrices.isValid) {
            console.log("  ❌ FAIL: Price went outside valid range");
            return;
        }
    } catch (error) {
        console.log(`  ❌ FAIL: Could not trade at extreme: ${error.message}`);
        return;
    }

    console.log(`\n🎉 ALL TESTS PASSED!`);
    console.log(`\n✅ Summary:`);
    console.log(`  - Prices never hit 0% or 100%`);
    console.log(`  - Prices always sum to exactly 100%`);
    console.log(`  - Trading works at all price levels`);
    console.log(`  - Price clamping is functioning correctly`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });

