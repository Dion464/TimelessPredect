const { ethers } = require("hardhat");

async function main() {
    console.log("🏗️  Creating Real Prediction Markets with ETH (Future Dates)...");

    const [deployer] = await ethers.getSigners();
    console.log("Creating markets with account:", deployer.address);

    // Get the deployed contract
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach("0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6");

    const marketCreationFee = await contract.marketCreationFee();
    console.log("Market creation fee:", ethers.utils.formatEther(marketCreationFee), "ETH");

    // Get current timestamp
    const now = Math.floor(Date.now() / 1000);
    console.log("Current timestamp:", now, "(" + new Date(now * 1000).toISOString() + ")");

    // Real prediction markets with future dates
    const realMarkets = [
        {
            question: "Will Bitcoin reach $100,000 by end of 2025?",
            description: "This market resolves to YES if Bitcoin (BTC) reaches or exceeds $100,000 USD on any major exchange (Coinbase, Binance, Kraken) by 11:59 PM UTC on December 31, 2025. Price must be sustained for at least 1 hour.",
            category: "Cryptocurrency",
            endTime: now + (365 * 24 * 60 * 60), // 1 year from now
            resolutionTime: now + (365 * 24 * 60 * 60) + (7 * 24 * 60 * 60) // 1 week after end
        },
        {
            question: "Will the Lakers win the 2025-26 NBA Championship?",
            description: "This market resolves to YES if the Los Angeles Lakers win the 2025-26 NBA Championship. The market will resolve based on the official NBA championship results.",
            category: "Sports",
            endTime: now + (18 * 30 * 24 * 60 * 60), // 18 months from now
            resolutionTime: now + (19 * 30 * 24 * 60 * 60) // 19 months from now
        },
        {
            question: "Will OpenAI release GPT-5 by end of 2025?",
            description: "This market resolves to YES if OpenAI officially announces and releases a model called 'GPT-5' by December 31, 2025. The model must be publicly available or announced by OpenAI.",
            category: "Technology",
            endTime: now + (13 * 30 * 24 * 60 * 60), // 13 months from now
            resolutionTime: now + (14 * 30 * 24 * 60 * 60) // 14 months from now
        },
        {
            question: "Will Ethereum reach $10,000 by end of 2025?",
            description: "This market resolves to YES if Ethereum (ETH) reaches or exceeds $10,000 USD on any major exchange by December 31, 2025. Price must be sustained for at least 1 hour.",
            category: "Cryptocurrency",
            endTime: now + (13 * 30 * 24 * 60 * 60), // 13 months from now
            resolutionTime: now + (14 * 30 * 24 * 60 * 60) // 14 months from now
        },
        {
            question: "Will Tesla stock reach $500 by end of 2025?",
            description: "This market resolves to YES if Tesla (TSLA) stock reaches or exceeds $500 per share on NASDAQ by December 31, 2025. Price must be the closing price.",
            category: "Finance",
            endTime: now + (13 * 30 * 24 * 60 * 60), // 13 months from now
            resolutionTime: now + (14 * 30 * 24 * 60 * 60) // 14 months from now
        },
        {
            question: "Will the Golden State Warriors make the NBA playoffs in 2025-26?",
            description: "This market resolves to YES if the Golden State Warriors qualify for the 2025-26 NBA playoffs. This includes any playoff position (1-10 seed in Western Conference).",
            category: "Sports",
            endTime: now + (16 * 30 * 24 * 60 * 60), // 16 months from now
            resolutionTime: now + (17 * 30 * 24 * 60 * 60) // 17 months from now
        },
        {
            question: "Will Apple release a VR headset priced under $2000 in 2025?",
            description: "This market resolves to YES if Apple officially releases a VR/AR headset with a retail price under $2000 USD in 2025.",
            category: "Technology",
            endTime: now + (13 * 30 * 24 * 60 * 60), // 13 months from now
            resolutionTime: now + (14 * 30 * 24 * 60 * 60) // 14 months from now
        },
        {
            question: "Will AI achieve AGI (Artificial General Intelligence) by 2026?",
            description: "This market resolves to YES if a major AI research organization (OpenAI, Google DeepMind, Anthropic, etc.) officially claims to have achieved AGI by December 31, 2026.",
            category: "Technology",
            endTime: now + (24 * 30 * 24 * 60 * 60), // 24 months from now
            resolutionTime: now + (25 * 30 * 24 * 60 * 60) // 25 months from now
        }
    ];

    console.log(`\n📊 Creating ${realMarkets.length} real prediction markets...\n`);

    for (let i = 0; i < realMarkets.length; i++) {
        const market = realMarkets[i];
        
        try {
            console.log(`${i + 1}. Creating: "${market.question}"`);
            console.log(`   Category: ${market.category}`);
            console.log(`   End Time: ${new Date(market.endTime * 1000).toISOString()}`);
            
            const tx = await contract.createMarket(
                market.question,
                market.description,
                market.category,
                market.endTime,
                market.resolutionTime,
                {
                    value: marketCreationFee,
                    gasLimit: 500000
                }
            );
            
            const receipt = await tx.wait();
            const marketId = receipt.events?.find(e => e.event === 'MarketCreated')?.args?.marketId;
            
            console.log(`   ✅ Created with ID: ${marketId}`);
            console.log(`   📝 Transaction: ${tx.hash}\n`);
            
        } catch (error) {
            console.error(`   ❌ Failed to create market: ${error.message}\n`);
        }
    }

    // Get all active markets
    console.log("📋 Fetching all active markets...");
    const activeMarkets = await contract.getActiveMarkets();
    console.log(`✅ Total active markets: ${activeMarkets.length}`);
    
    for (let i = 0; i < activeMarkets.length; i++) {
        const marketId = activeMarkets[i];
        const market = await contract.getMarket(marketId);
        console.log(`   ${marketId}: ${market.question}`);
    }

    console.log("\n🎉 Real prediction markets created successfully!");
    console.log("💡 Users can now trade these markets with real ETH!");
    console.log("🌐 Connect your wallet and refresh the frontend to see the markets!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
