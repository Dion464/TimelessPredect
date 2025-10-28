const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing market data retrieval...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d");

    try {
        // Test getActiveMarkets
        console.log("📊 Testing getActiveMarkets...");
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets count:", activeMarkets.length);
        console.log("Active market IDs:", activeMarkets.map(id => id.toString()));

        if (activeMarkets.length > 0) {
            // Test getMarket for first market
            console.log("📊 Testing getMarket for market 1...");
            const market = await contract.getMarket(1);
            console.log("Market 1 data:", {
                id: market.id.toString(),
                question: market.question,
                category: market.category,
                active: market.active
            });

            // Test PricingAMM
            console.log("📊 Testing PricingAMM...");
            const pricingAMMAddress = await contract.pricingAMM();
            console.log("PricingAMM address:", pricingAMMAddress);

            // Test getCurrentPrice
            console.log("📊 Testing getCurrentPrice...");
            const yesPrice = await contract.getCurrentPrice(1, true);
            const noPrice = await contract.getCurrentPrice(1, false);
            console.log("Market 1 prices - YES:", yesPrice.toString(), "NO:", noPrice.toString());
        }

    } catch (error) {
        console.error("❌ Error testing markets:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

