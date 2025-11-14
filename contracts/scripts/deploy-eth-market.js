const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying ETH Prediction Market Contract...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

    // Deploy ETH Prediction Market
    console.log("\n📊 Deploying ETH Prediction Market...");
    
    // Constructor parameters
    const marketCreationFeeAmount = ethers.utils.parseEther("0.01"); // 0.01 ETH
    const platformFeePercentAmount = 200; // 2% (200 basis points)
    
    console.log("Market Creation Fee:", ethers.utils.formatEther(marketCreationFeeAmount), "ETH");
    console.log("Platform Fee:", platformFeePercentAmount, "basis points (", platformFeePercentAmount / 100, "%)");
    
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const ethPredictionMarket = await ETHPredictionMarket.deploy(marketCreationFeeAmount, platformFeePercentAmount);
    await ethPredictionMarket.deployed();

    console.log("✅ ETH Prediction Market deployed to:", ethPredictionMarket.address);

    // Get contract info
    const marketCreationFee = await ethPredictionMarket.marketCreationFee();
    const platformFeePercent = await ethPredictionMarket.platformFeePercent();

    console.log("\n📋 Contract Configuration:");
    console.log("Market Creation Fee:", ethers.utils.formatEther(marketCreationFee), "ETH");
    console.log("Platform Fee:", platformFeePercent.toString(), "basis points (", platformFeePercent.toNumber() / 100, "%)");

    // Save deployment info
    const deploymentInfo = {
        network: "hardhat",
        chainId: 1337,
        contracts: {
            ETHPredictionMarket: {
                address: ethPredictionMarket.address,
                deployer: deployer.address,
                deploymentBlock: ethPredictionMarket.deployTransaction.blockNumber,
                transactionHash: ethPredictionMarket.deployTransaction.hash
            }
        },
        config: {
            marketCreationFee: ethers.utils.formatEther(marketCreationFee),
            platformFeePercent: platformFeePercent.toString()
        },
        timestamp: new Date().toISOString()
    };

    console.log("\n💾 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log("\n🎉 Deployment completed successfully!");
    console.log("📝 Update your frontend CONTRACT_ADDRESSES with:");
    console.log(`ETH_PREDICTION_MARKET: "${ethPredictionMarket.address}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
