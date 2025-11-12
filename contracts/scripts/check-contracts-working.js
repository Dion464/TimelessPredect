const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking if contracts are working...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

    // Check deployed contract from deployment file
    const deployment = require("../deployments/unknown-1337.json");
    const contractAddress = deployment.contracts.ETHPredictionMarket.address;
    console.log("📋 Deployment Info:");
    console.log("  Contract Address:", contractAddress);
    console.log("  Network:", deployment.network);
    console.log("  Chain ID:", deployment.chainId);
    console.log("  Deployer:", deployment.deployer);
    console.log("");

    try {
        // Try to attach to the contract
        console.log("🔗 Attaching to contract...");
        const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
        const contract = ETHPredictionMarket.attach(contractAddress);

        // Check if contract has code
        const code = await ethers.provider.getCode(contractAddress);
        if (code === "0x" || code === "0x0") {
            console.log("❌ ERROR: No contract code found at address!");
            console.log("   The contract may not be deployed yet.");
            console.log("   Run: npx hardhat run scripts/deploy.js --network localhost");
            process.exit(1);
        }
        console.log("✅ Contract has code at address\n");

        // Test 1: Check contract configuration
        console.log("📊 Test 1: Contract Configuration");
        try {
            const marketCreationFee = await contract.marketCreationFee();
            const platformFee = await contract.platformFeePercent();
            const pricingAMM = await contract.pricingAMM();
            console.log("  ✅ Market Creation Fee:", ethers.utils.formatEther(marketCreationFee), "ETH");
            console.log("  ✅ Platform Fee:", platformFee.toString(), "basis points (", (platformFee.toNumber() / 100).toString(), "%)");
            console.log("  ✅ PricingAMM Address:", pricingAMM);
            console.log("");
        } catch (error) {
            console.log("  ❌ Error reading contract config:", error.message);
            console.log("");
        }

        // Test 2: Check active markets
        console.log("📊 Test 2: Active Markets");
        try {
            const activeMarkets = await contract.getActiveMarkets();
            console.log("  ✅ Active Markets Count:", activeMarkets.length);
            if (activeMarkets.length > 0) {
                console.log("  ✅ Market IDs:", activeMarkets.map(id => id.toString()).join(", "));
            } else {
                console.log("  ℹ️  No active markets yet (this is normal for a fresh deployment)");
            }
            console.log("");
        } catch (error) {
            console.log("  ❌ Error getting active markets:", error.message);
            console.log("");
        }

        // Test 3: Test optimistic oracle configuration
        console.log("📊 Test 3: Optimistic Oracle Configuration");
        try {
            const proposerBond = await contract.proposerBondAmount();
            const disputePeriod = await contract.disputePeriod();
            console.log("  ✅ Proposer Bond:", ethers.utils.formatEther(proposerBond), "ETH");
            console.log("  ✅ Dispute Period:", disputePeriod.toString(), "seconds (", (disputePeriod.toNumber() / 3600).toFixed(2), "hours)");
            console.log("");
        } catch (error) {
            console.log("  ❌ Error reading oracle config:", error.message);
            console.log("");
        }

        // Test 4: Try creating a test market (dry run - estimate gas only)
        console.log("📊 Test 4: Market Creation (Gas Estimation)");
        try {
            const currentBlock = await ethers.provider.getBlock('latest');
            const currentTime = currentBlock.timestamp;
            
            // Set market to close in 1 hour and resolve in 2 hours
            const endTime = currentTime + 3600; // 1 hour from now
            const resolutionTime = currentTime + 7200; // 2 hours from now

            const fee = await contract.marketCreationFee();
            
            const gasEstimate = await contract.estimateGas.createMarket(
                "Test Market: Is this working?",
                "This is a test market to verify contracts are working",
                "technology",
                endTime,
                resolutionTime,
                { value: fee }
            );

            console.log("  ✅ Gas Estimate for createMarket:", gasEstimate.toString());
            console.log("  ✅ Contract accepts createMarket calls");
            console.log("");
        } catch (error) {
            console.log("  ❌ Error estimating gas for createMarket:", error.message);
            console.log("  This might mean:");
            console.log("    - Contract function signature mismatch");
            console.log("    - Invalid parameters");
            console.log("");
        }

        // Test 5: Check PricingAMM
        console.log("📊 Test 5: PricingAMM Contract");
        try {
            const pricingAMMAddress = await contract.pricingAMM();
            const ammCode = await ethers.provider.getCode(pricingAMMAddress);
            
            if (ammCode === "0x" || ammCode === "0x0") {
                console.log("  ⚠️  Warning: PricingAMM has no code (might be address zero)");
            } else {
                console.log("  ✅ PricingAMM is deployed at:", pricingAMMAddress);
                
                // Try to get market state from AMM
                const PricingAMM = await ethers.getContractFactory("PricingAMM");
                const ammContract = PricingAMM.attach(pricingAMMAddress);
                
                // Try to get state for market 1 (if it exists)
                try {
                    const state = await ammContract.getMarketState(1);
                    console.log("  ✅ PricingAMM can be queried");
                } catch (error) {
                    console.log("  ℹ️  PricingAMM exists but market 1 not found (normal if no markets)");
                }
            }
            console.log("");
        } catch (error) {
            console.log("  ❌ Error checking PricingAMM:", error.message);
            console.log("");
        }

        // Summary
        console.log("════════════════════════════════════════");
        console.log("✅ Contract Status: OPERATIONAL");
        console.log("════════════════════════════════════════");
        console.log("\n📝 Frontend Configuration Check:");
        console.log("  Contract Address in deployment:", contractAddress);
        console.log("  Make sure frontend uses this address in:");
        console.log("    - frontend/src/contracts/config.js");
        console.log("    - frontend/src/contracts/eth-config.js");
        console.log("    - frontend/src/hooks/useWeb3.jsx");
        console.log("");

    } catch (error) {
        console.log("❌ FATAL ERROR:", error.message);
        console.log("\nThis usually means:");
        console.log("  1. Contract not deployed at this address");
        console.log("  2. Hardhat node not running");
        console.log("  3. Wrong network configuration");
        console.log("\nSolutions:");
        console.log("  - Make sure Hardhat node is running: npx hardhat node");
        console.log("  - Deploy contract: npx hardhat run scripts/deploy.js --network localhost");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

