const { ethers } = require("hardhat");

async function main() {
    console.log("🔄 Resetting Markets...");

    const [deployer] = await ethers.getSigners();
    console.log("Resetting with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x07882Ae1ecB7429a84f1D53048d35c4bB2056877");

    try {
        // Get PricingAMM address
        const pricingAMMAddress = await contract.pricingAMM();
        console.log("PricingAMM address:", pricingAMMAddress);

        const PricingAMM = await ethers.getContractFactory("PricingAMM");
        const pricingAMMContract = await PricingAMM.attach(pricingAMMAddress);

        // Get active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log("Active markets:", activeMarkets.map(id => id.toString()));

        // We need to redeploy with fresh markets since we can't reset the AMM state
        console.log("\n📋 To fix this issue, we need to:");
        console.log("1. Deploy fresh contracts");
        console.log("2. Create new markets");
        console.log("3. Update frontend contract addresses");
        
        console.log("\n🔧 Current issue:");
        console.log("- Markets 4 & 5 have some YES shares from testing");
        console.log("- This causes YES price to be 99¢ instead of 50¢");
        console.log("- The markets should start with 0 shares and 50¢/50¢ prices");
        
        console.log("\n✅ Solution:");
        console.log("- Redeploy contracts with fresh state");
        console.log("- Create new markets without any initial trading");
        
    } catch (error) {
        console.log("❌ Error during reset:", error.message);
        console.log("Error details:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
