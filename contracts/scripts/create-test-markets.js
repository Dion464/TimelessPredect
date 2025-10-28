const { ethers } = require("hardhat");

async function main() {
    console.log("📊 Creating test markets...");

    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

    const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const contract = await ETHPredictionMarket.attach(CONTRACT_ADDRESS);

    try {
        // Get market creation fee
        const marketCreationFee = await contract.marketCreationFee();
        console.log("Market creation fee:", ethers.utils.formatEther(marketCreationFee), "ETH");

        // Calculate timestamps
        const now = Math.floor(Date.now() / 1000);
        const endTime = now + (7 * 24 * 60 * 60); // 7 days from now
        const resolutionTime = now + (10 * 24 * 60 * 60); // 10 days from now

        const markets = [
            {
                question: "Will Bitcoin reach $100k by end of 2024?",
                description: "Bitcoin price prediction for end of year",
                category: "crypto",
                endTime,
                resolutionTime
            },
            {
                question: "Will the US presidential election be decided by Jan 1, 2025?",
                description: "US presidential election outcome",
                category: "politics",
                endTime,
                resolutionTime
            },
            {
                question: "Will AI pass the Turing test in 2024?",
                description: "AI development milestone",
                category: "technology",
                endTime,
                resolutionTime
            }
        ];

        for (let i = 0; i < markets.length; i++) {
            console.log(`\n📊 Creating market ${i + 1}: "${markets[i].question}"`);
            
            try {
                const tx = await contract.createMarket(
                    markets[i].question,
                    markets[i].description,
                    markets[i].category,
                    markets[i].endTime,
                    markets[i].resolutionTime,
                    { value: marketCreationFee }
                );
                
                console.log(`  Transaction hash: ${tx.hash}`);
                const receipt = await tx.wait();
                console.log(`  ✅ Market created in block ${receipt.blockNumber}`);
            } catch (error) {
                console.error(`  ❌ Error creating market:`, error.message);
            }
        }

        // Check active markets
        const activeMarkets = await contract.getActiveMarkets();
        console.log(`\n✅ Total active markets: ${activeMarkets.length}`);
        
        if (activeMarkets.length > 0) {
            console.log("Active market IDs:", activeMarkets.map(id => id.toString()));
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

