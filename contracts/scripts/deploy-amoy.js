const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying ETH Prediction Market to Polygon Amoy Testnet...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils.formatEther(balance), "POL");
    
    if (balance.lt(ethers.utils.parseEther("0.1"))) {
        console.log("⚠️  Low balance! Get POL from faucet:");
        console.log("🔗 https://faucet.polygon.technology/");
        console.log("🔗 https://www.alchemy.com/faucets/polygon-amoy");
        return;
    }

    // Deploy ETH Prediction Market (will use POL instead of ETH on Polygon)
    console.log("\n📊 Deploying POL Prediction Market...");
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    
    const predictionMarket = await ETHPredictionMarket.deploy({
        gasLimit: 3000000, // Set explicit gas limit
        gasPrice: ethers.utils.parseUnits("30", "gwei") // 30 gwei for Amoy
    });
    
    console.log("⏳ Waiting for deployment...");
    await predictionMarket.deployed();

    console.log("✅ POL Prediction Market deployed to:", predictionMarket.address);
    console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/address/${predictionMarket.address}`);

    // Get contract info
    const marketCreationFee = await predictionMarket.marketCreationFee();
    const platformFeePercent = await predictionMarket.platformFeePercent();

    console.log("\n📋 Contract Configuration:");
    console.log("Market Creation Fee:", ethers.utils.formatEther(marketCreationFee), "POL");
    console.log("Platform Fee:", platformFeePercent.toString(), "basis points (", platformFeePercent.toNumber() / 100, "%)");

    // Save deployment info
    const deploymentInfo = {
        network: "amoy",
        chainId: 80002,
        contracts: {
            ETHPredictionMarket: {
                address: predictionMarket.address,
                deployer: deployer.address,
                deploymentBlock: predictionMarket.deployTransaction.blockNumber,
                transactionHash: predictionMarket.deployTransaction.hash
            }
        },
        config: {
            marketCreationFee: ethers.utils.formatEther(marketCreationFee),
            platformFeePercent: platformFeePercent.toString()
        },
        timestamp: new Date().toISOString(),
        polygonScanUrl: `https://amoy.polygonscan.com/address/${predictionMarket.address}`
    };

    console.log("\n💾 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log("\n🎉 Deployment completed successfully!");
    console.log("📝 Update your frontend CONTRACT_ADDRESSES with:");
    console.log(`ETH_PREDICTION_MARKET: "${predictionMarket.address}"`);
    console.log("\n🌐 Network Info for MetaMask:");
    console.log("Network Name: Polygon Amoy");
    console.log("RPC URL: https://rpc-amoy.polygon.technology/");
    console.log("Chain ID: 80002");
    console.log("Currency Symbol: POL");
    console.log("Block Explorer: https://amoy.polygonscan.com/");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
