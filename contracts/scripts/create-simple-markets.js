const { ethers } = require("hardhat");

async function main() {
    console.log("🏗️  Creating Simple Prediction Markets...");

    const [deployer] = await ethers.getSigners();
    console.log("Creating markets with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");

    const marketCreationFee = await contract.marketCreationFee();
    console.log("Market creation fee:", ethers.utils.formatEther(marketCreationFee), "ETH");

    // Get current timestamp
    const now = Math.floor(Date.now() / 1000);

    // Simple prediction markets
    const simpleMarkets = [
        {
            question: "Will Bitcoin reach $100k by 2025?",
            description: "BTC reaches $100,000 by Dec 31, 2025",
            category: "Crypto",
            endTime: now + (365 * 24 * 60 * 60), // 1 year
            resolutionTime: now + (365 * 24 * 60 * 60) + (7 * 24 * 60 * 60) // 1 week after
        },
        {
            question: "Will ETH reach $10k by 2025?",
            description: "ETH reaches $10,000 by Dec 31, 2025",
            category: "Crypto",
            endTime: now + (365 * 24 * 60 * 60), // 1 year
            resolutionTime: now + (365 * 24 * 60 * 60) + (7 * 24 * 60 * 60)
        },
        {
            question: "Will Lakers win 2025 NBA Championship?",
            description: "Lakers win the 2024-25 NBA Championship",
            category: "Sports",
            endTime: now + (6 * 30 * 24 * 60 * 60), // 6 months
            resolutionTime: now + (7 * 30 * 24 * 60 * 60) // 7 months
        },
        {
            question: "Will OpenAI release GPT-5 in 2025?",
            description: "OpenAI releases GPT-5 in 2025",
            category: "AI",
            endTime: now + (12 * 30 * 24 * 60 * 60), // 12 months
            resolutionTime: now + (13 * 30 * 24 * 60 * 60) // 13 months
        },
        {
            question: "Will Tesla stock hit $500 in 2025?",
            description: "TSLA reaches $500 per share in 2025",
            category: "Stocks",
            endTime: now + (12 * 30 * 24 * 60 * 60), // 12 months
            resolutionTime: now + (13 * 30 * 24 * 60 * 60) // 13 months
        }
    ];

    console.log(`\n📊 Creating ${simpleMarkets.length} simple prediction markets...\n`);

    for (let i = 0; i < simpleMarkets.length; i++) {
        const market = simpleMarkets[i];
        
        try {
            console.log(`${i + 1}. Creating: "${market.question}"`);
            
            const tx = await contract.createMarket(
                market.question,
                market.description,
                market.category,
                market.endTime,
                market.resolutionTime,
                {
                    value: marketCreationFee,
                    gasLimit: 3000000 // Increased gas limit
                }
            );
            
            const receipt = await tx.wait();
            const marketId = receipt.events?.find(e => e.event === 'MarketCreated')?.args?.marketId;
            
            console.log(`   ✅ Created with ID: ${marketId}`);
            
        } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);
        }
    }

    // Get all active markets
    console.log("\n📋 Active markets:");
    const activeMarkets = await contract.getActiveMarkets();
    console.log(`✅ Total: ${activeMarkets.length}`);
    
    for (let i = 0; i < activeMarkets.length; i++) {
        const marketId = activeMarkets[i];
        const market = await contract.getMarket(marketId);
        console.log(`   ${marketId}: ${market.question}`);
    }

    console.log("\n🎉 Markets created! Connect wallet and refresh frontend to trade!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
