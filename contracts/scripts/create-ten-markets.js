const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Creating markets with account:", deployer.address);

  // Contract address - update this if redeployed
  const CONTRACT_ADDRESS = "0xC66AB83418C20A65C3f8e83B3d11c8C3a6097b6F";

  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const predictionMarket = await ETHPredictionMarket.attach(CONTRACT_ADDRESS);

  console.log("Connected to ETHPredictionMarket at:", predictionMarket.address);

  // Define 10 market templates (timestamps will be calculated fresh for each market)
  const marketTemplates = [
    {
      question: "A e ban dioni deri n 6 predection marketin?",
      description: "Custom prediction market",
      category: "Custom"
    },
    {
      question: "Will Apple stock reach $200 by end of 2025?",
      description: "Apple (AAPL) stock price prediction",
      category: "Stocks"
    },
    {
      question: "Will there be a recession in 2025?",
      description: "Global economic recession prediction",
      category: "Economics"
    },
    {
      question: "Will SpaceX successfully land on Mars by 2026?",
      description: "First successful Mars landing by SpaceX",
      category: "Space"
    },
    {
      question: "Will Bitcoin dominance exceed 60% in 2025?",
      description: "Bitcoin market dominance prediction",
      category: "Crypto"
    },
    {
      question: "Will Real Madrid win Champions League 2025?",
      description: "UEFA Champions League 2025 winner",
      category: "Sports"
    },
    {
      question: "Will AI surpass human performance on all benchmarks by 2026?",
      description: "Artificial Intelligence benchmark prediction",
      category: "Technology"
    },
    {
      question: "Will Donald Trump win the 2024 US Presidential Election?",
      description: "US Presidential Election 2024",
      category: "Politics"
    },
    {
      question: "Will global temperature rise exceed 1.5°C in 2025?",
      description: "Climate change temperature threshold",
      category: "Climate"
    },
    {
      question: "Will Ethereum 2.0 handle 100k TPS by end of 2025?",
      description: "Ethereum scalability prediction",
      category: "Crypto"
    }
  ];

  console.log("\n📊 Creating 10 new prediction markets...\n");

  for (let i = 0; i < marketTemplates.length; i++) {
    const template = marketTemplates[i];
    
    try {
      // Calculate fresh timestamps for each market (24 hours duration)
      const now = Math.floor(Date.now() / 1000);
      const endTime = now + (24 * 60 * 60); // 24 hours from now
      const resolutionTime = now + (24 * 60 * 60) + (5 * 60); // 24 hours + 5 minutes
      
      console.log(`[${i + 1}/10] Creating: "${template.question}"`);
      console.log(`   Category: ${template.category}`);
      console.log(`   Duration: 24 hours`);
      
      const marketCreationFee = ethers.utils.parseEther("0.01"); // 0.01 ETH fee
      
      const tx = await predictionMarket.createMarket(
        template.question,
        template.description,
        template.category,
        endTime,
        resolutionTime,
        { value: marketCreationFee }
      );
      
      const receipt = await tx.wait();
      console.log(`   ✅ Market created! Transaction: ${receipt.transactionHash}`);
      
      // Extract market ID from event
      const event = receipt.events?.find(e => e.event === "MarketCreated");
      if (event) {
        console.log(`   📋 Market ID: ${event.args.marketId.toString()}`);
      }
      
      console.log("");
    } catch (error) {
      console.error(`   ❌ Failed to create market: ${error.message}`);
      console.log("");
    }
  }

  console.log("🎉 Finished creating markets!");
  console.log("\n📍 Summary:");
  console.log(`   Contract Address: ${CONTRACT_ADDRESS}`);
  
  // Get total active markets
  const activeMarkets = await predictionMarket.getActiveMarkets();
  console.log(`   Total Active Markets: ${activeMarkets.length}`);
  console.log("\n✨ All markets are now available for trading!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

