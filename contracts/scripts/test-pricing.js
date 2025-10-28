const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing PricingAMM...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d");

    try {
        // Get PricingAMM address
        const pricingAMMAddress = await contract.pricingAMM();
        console.log("PricingAMM address:", pricingAMMAddress);

        // Get PricingAMM contract
        const PricingAMM = await ethers.getContractFactory("PricingAMM");
        const pricingAMM = PricingAMM.attach(pricingAMMAddress);

        // Test getMarketState for market 1
        console.log("📊 Testing getMarketState for market 1...");
        const marketState = await pricingAMM.getMarketState(1);
        console.log("Market 1 state:", {
            yesShares: marketState.yesShares.toString(),
            noShares: marketState.noShares.toString(),
            liquidity: marketState.liquidity.toString(),
            yesPrice: marketState.yesPrice.toString(),
            noPrice: marketState.noPrice.toString()
        });

        // Test calculatePrice for market 1
        console.log("📊 Testing calculatePrice for market 1...");
        const [yesPrice, noPrice] = await pricingAMM.calculatePrice(1);
        console.log("Market 1 prices:", {
            yesPrice: yesPrice.toString(),
            noPrice: noPrice.toString()
        });

        // Test calculateSharesToGive for market 1
        console.log("📊 Testing calculateSharesToGive for market 1...");
        const sharesToGive = await pricingAMM.calculateSharesToGive(1, true, ethers.utils.parseEther("1"));
        console.log("Shares to give for 1 ETH YES:", ethers.utils.formatEther(sharesToGive));

    } catch (error) {
        console.error("❌ Error testing PricingAMM:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

