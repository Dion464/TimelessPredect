const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying SocialPredict contracts...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // Deploy Mock USDC for testing (on testnets)
  let usdcAddress;
  if (network.chainId === 1337 || network.chainId === 5) { // localhost or goerli
    console.log("\n📄 Deploying Mock USDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();
    usdcAddress = mockUSDC.address;
    console.log("Mock USDC deployed to:", usdcAddress);
  } else {
    // Use real USDC addresses for mainnets
    const usdcAddresses = {
      1: "0xA0b86a33E6441b8435b662c6c6C8e6c8B6B8b8b8", // Mainnet USDC
      137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Polygon USDC
      42161: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // Arbitrum USDC
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
    };
    usdcAddress = usdcAddresses[network.chainId];
    if (!usdcAddress) {
      throw new Error(`USDC address not configured for chain ID ${network.chainId}`);
    }
    console.log("Using USDC at:", usdcAddress);
  }

  // Deploy PredictionMarket contract
  console.log("\n📄 Deploying PredictionMarket...");
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy(usdcAddress);
  await predictionMarket.deployed();
  console.log("PredictionMarket deployed to:", predictionMarket.address);

  // Deploy PredictionOracle contract
  console.log("\n📄 Deploying PredictionOracle...");
  const PredictionOracle = await ethers.getContractFactory("PredictionOracle");
  const predictionOracle = await PredictionOracle.deploy(predictionMarket.address);
  await predictionOracle.deployed();
  console.log("PredictionOracle deployed to:", predictionOracle.address);

  // Set up initial configuration
  console.log("\n⚙️ Setting up initial configuration...");
  
  // Set oracle as authorized in the prediction market
  await predictionMarket.setAuthorizedOracle(predictionOracle.address, true);
  console.log("✅ Oracle authorized in PredictionMarket");

  // Set deployer as authorized resolver in oracle
  await predictionOracle.setAuthorizedResolver(deployer.address, true);
  console.log("✅ Deployer set as authorized resolver");

  // Create deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PredictionMarket: {
        address: predictionMarket.address,
        constructorArgs: [usdcAddress],
      },
      PredictionOracle: {
        address: predictionOracle.address,
        constructorArgs: [predictionMarket.address],
      },
      USDC: {
        address: usdcAddress,
        isMock: network.chainId === 1337 || network.chainId === 5,
      },
    },
    configuration: {
      platformFee: "200", // 2%
      resolutionBond: ethers.utils.parseEther("100").toString(),
      disputeBond: ethers.utils.parseEther("200").toString(),
      disputePeriod: "86400", // 24 hours
    },
  };

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network.name}-${network.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("📁 Deployment info saved to:", deploymentFile);

  // Generate frontend config
  const frontendConfig = {
    PREDICTION_MARKET_ADDRESS: predictionMarket.address,
    PREDICTION_ORACLE_ADDRESS: predictionOracle.address,
    USDC_ADDRESS: usdcAddress,
    CHAIN_ID: network.chainId,
    NETWORK_NAME: network.name,
  };

  const frontendConfigFile = path.join(__dirname, "../../frontend/src/contracts/config.js");
  const frontendConfigDir = path.dirname(frontendConfigFile);
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  const configContent = `// Auto-generated contract configuration
// Generated on: ${new Date().toISOString()}

export const CONTRACT_CONFIG = ${JSON.stringify(frontendConfig, null, 2)};

export const PREDICTION_MARKET_ADDRESS = "${predictionMarket.address}";
export const PREDICTION_ORACLE_ADDRESS = "${predictionOracle.address}";
export const USDC_ADDRESS = "${usdcAddress}";
export const CHAIN_ID = ${network.chainId};
export const NETWORK_NAME = "${network.name}";
`;

  fs.writeFileSync(frontendConfigFile, configContent);
  console.log("📁 Frontend config generated at:", frontendConfigFile);

  // Create sample markets for testing
  if (network.chainId === 1337) { // Only on localhost
    console.log("\n🎯 Creating sample markets for testing...");
    
    const sampleMarkets = [
      {
        questionTitle: "Will Bitcoin reach $100,000 by end of 2024?",
        description: "This market resolves to YES if Bitcoin (BTC) reaches or exceeds $100,000 USD on any major exchange by December 31, 2024, 11:59 PM UTC.",
        resolutionTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
        finalResolutionTime: Math.floor(Date.now() / 1000) + (37 * 24 * 60 * 60), // 37 days from now
        creatorFee: 100, // 1%
        category: "Crypto",
        oracle: predictionOracle.address,
      },
      {
        questionTitle: "Will the Lakers win the 2024 NBA Championship?",
        description: "This market resolves to YES if the Los Angeles Lakers win the 2024 NBA Championship.",
        resolutionTime: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60), // 60 days from now
        finalResolutionTime: Math.floor(Date.now() / 1000) + (67 * 24 * 60 * 60), // 67 days from now
        creatorFee: 50, // 0.5%
        category: "Sports",
        oracle: predictionOracle.address,
      },
    ];

    for (let i = 0; i < sampleMarkets.length; i++) {
      const market = sampleMarkets[i];
      const tx = await predictionMarket.createMarket(
        market.questionTitle,
        market.description,
        market.resolutionTime,
        market.finalResolutionTime,
        market.creatorFee,
        market.category,
        market.oracle
      );
      await tx.wait();
      console.log(`✅ Created sample market ${i + 1}: "${market.questionTitle}"`);
    }
  }

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Summary:");
  console.log("- PredictionMarket:", predictionMarket.address);
  console.log("- PredictionOracle:", predictionOracle.address);
  console.log("- USDC Token:", usdcAddress);
  console.log("- Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("- Deployer:", deployer.address);
  
  if (network.chainId !== 1337) {
    console.log("\n🔍 Verify contracts with:");
    console.log(`npx hardhat verify --network ${network.name} ${predictionMarket.address} ${usdcAddress}`);
    console.log(`npx hardhat verify --network ${network.name} ${predictionOracle.address} ${predictionMarket.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
