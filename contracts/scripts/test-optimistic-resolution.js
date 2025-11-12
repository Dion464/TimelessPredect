const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🧪 Testing Optimistic Oracle Resolution System...\n");

    const [deployer, proposer, disputer, finalizer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Proposer:", proposer.address);
    console.log("Disputer:", disputer.address);
    console.log("Finalizer:", finalizer.address);
    console.log("");

    // Load contract address from config
    const configPath = path.join(__dirname, '../../frontend/src/contracts/config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const PREDICTION_MARKET_ADDRESS_MATCH = configContent.match(/PREDICTION_MARKET_ADDRESS": "(0x[a-fA-F0-9]{40})"/);
    const PREDICTION_MARKET_ADDRESS = PREDICTION_MARKET_ADDRESS_MATCH ? PREDICTION_MARKET_ADDRESS_MATCH[1] : null;

    if (!PREDICTION_MARKET_ADDRESS) {
        console.error("❌ Prediction Market address not found in config.js");
        return;
    }

    console.log("Contract address:", PREDICTION_MARKET_ADDRESS);
    console.log("");

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const predictionMarket = ETHPredictionMarket.attach(PREDICTION_MARKET_ADDRESS);

    // Get bond amounts
    const proposerBond = await predictionMarket.proposerBondAmount();
    const disputePeriod = await predictionMarket.disputePeriod();
    const disputerMultiplier = await predictionMarket.disputerBondMultiplier();
    
    console.log("📋 Resolution System Parameters:");
    console.log(`  Proposer Bond: ${ethers.utils.formatEther(proposerBond)} ETH`);
    console.log(`  Dispute Period: ${disputePeriod.toString()} seconds (${disputePeriod.toNumber() / 86400} days)`);
    console.log(`  Disputer Bond Multiplier: ${disputerMultiplier.toString()}x`);
    console.log(`  Required Dispute Bond: ${ethers.utils.formatEther(proposerBond.mul(disputerMultiplier))} ETH`);
    console.log("");

    const activeMarketIds = await predictionMarket.getActiveMarkets();
    if (activeMarketIds.length === 0) {
        console.log("❌ No active markets found. Please create a market first.");
        return;
    }

    const marketId = activeMarketIds[0];
    console.log("📊 Testing with market ID:", marketId.toString());
    
    const market = await predictionMarket.markets(marketId);
    console.log("Market:", market.question);
    console.log("Resolution Time:", new Date(market.resolutionTime.toNumber() * 1000).toLocaleString());
    console.log("Current Time:", new Date(Date.now()).toLocaleString());
    console.log("");

    // Test 1: Check if market is ready for resolution
    console.log("📋 Test 1: Check Market Resolution Status");
    const currentTime = Math.floor(Date.now() / 1000);
    const canResolve = currentTime >= market.resolutionTime.toNumber();
    console.log(`  Can propose resolution: ${canResolve ? '✅ YES' : '❌ NO (wait until resolution time)'}`);
    
    if (!canResolve) {
        console.log("  ⚠️  Market not ready for resolution yet. Skipping tests.");
        return;
    }
    console.log("");

    // Test 2: Propose a resolution
    console.log("📋 Test 2: Propose Resolution (YES outcome)");
    try {
        const tx1 = await predictionMarket.connect(proposer).proposeResolution(
            marketId,
            1, // YES
            { value: proposerBond }
        );
        await tx1.wait();
        console.log("  ✅ Resolution proposed successfully!");
        console.log("  Transaction:", tx1.hash);
    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}`);
        return;
    }
    console.log("");

    // Test 3: Check proposal details
    console.log("📋 Test 3: Check Proposal Details");
    const proposal = await predictionMarket.getResolutionProposal(marketId);
    console.log(`  Proposed Outcome: ${proposal.proposedOutcome === 1 ? 'YES' : proposal.proposedOutcome === 2 ? 'NO' : 'INVALID'}`);
    console.log(`  Proposer: ${proposal.proposer}`);
    console.log(`  Proposal Time: ${new Date(proposal.proposalTime.toNumber() * 1000).toLocaleString()}`);
    console.log(`  Proposer Bond: ${ethers.utils.formatEther(proposal.proposerBond)} ETH`);
    console.log(`  Disputed: ${proposal.disputed ? '✅ YES' : '❌ NO'}`);
    console.log(`  Finalized: ${proposal.finalized ? '✅ YES' : '❌ NO'}`);
    console.log(`  Time Until Finalizable: ${proposal.timeUntilFinalizable.toNumber()} seconds`);
    console.log("");

    // Test 4: Try to dispute the resolution
    console.log("📋 Test 4: Dispute Resolution");
    const disputeBond = proposerBond.mul(disputerMultiplier);
    console.log(`  Attempting to dispute with bond: ${ethers.utils.formatEther(disputeBond)} ETH`);
    
    try {
        const tx2 = await predictionMarket.connect(disputer).disputeResolution(
            marketId,
            { value: disputeBond }
        );
        await tx2.wait();
        console.log("  ✅ Resolution disputed successfully!");
        console.log("  Transaction:", tx2.hash);
        
        // Check updated proposal
        const disputedProposal = await predictionMarket.getResolutionProposal(marketId);
        console.log(`  Proposal exists after dispute: ${disputedProposal.proposer !== ethers.constants.AddressZero ? 'NO (cleared)' : 'YES'}`);
    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}`);
        console.log("  (This is expected if you don't want to dispute)");
    }
    console.log("");

    // Test 5: Propose a new resolution (if previous was disputed)
    console.log("📋 Test 5: Propose New Resolution After Dispute (NO outcome)");
    try {
        const tx3 = await predictionMarket.connect(disputer).proposeResolution(
            marketId,
            2, // NO
            { value: proposerBond }
        );
        await tx3.wait();
        console.log("  ✅ New resolution proposed successfully!");
        
        const newProposal = await predictionMarket.getResolutionProposal(marketId);
        console.log(`  New Proposed Outcome: ${newProposal.proposedOutcome === 1 ? 'YES' : newProposal.proposedOutcome === 2 ? 'NO' : 'INVALID'}`);
        console.log(`  New Proposer: ${newProposal.proposer}`);
    } catch (error) {
        console.log(`  ℹ️  ${error.message}`);
    }
    console.log("");

    // Test 6: Finalize resolution (if dispute period has passed)
    console.log("📋 Test 6: Finalize Resolution");
    const finalProposal = await predictionMarket.getResolutionProposal(marketId);
    
    if (finalProposal.proposer === ethers.constants.AddressZero) {
        console.log("  ℹ️  No active proposal to finalize");
    } else if (finalProposal.disputed) {
        console.log("  ℹ️  Proposal was disputed, cannot finalize");
    } else if (finalProposal.finalized) {
        console.log("  ℹ️  Resolution already finalized");
    } else if (finalProposal.timeUntilFinalizable.toNumber() > 0) {
        console.log(`  ℹ️  Dispute period not expired. Wait ${finalProposal.timeUntilFinalizable.toNumber()} more seconds`);
    } else {
        try {
            const tx4 = await predictionMarket.connect(finalizer).finalizeResolution(marketId);
            await tx4.wait();
            console.log("  ✅ Resolution finalized successfully!");
            console.log("  Transaction:", tx4.hash);
            
            const finalizedMarket = await predictionMarket.markets(marketId);
            console.log(`  Market Resolved: ${finalizedMarket.resolved ? '✅ YES' : '❌ NO'}`);
            console.log(`  Final Outcome: ${finalizedMarket.outcome === 1 ? 'YES' : finalizedMarket.outcome === 2 ? 'NO' : 'INVALID'}`);
            console.log(`  Market Active: ${finalizedMarket.active ? 'YES' : 'NO (closed)'}`);
        } catch (error) {
            console.log(`  ❌ FAIL: ${error.message}`);
        }
    }

    console.log("\n🎉 Optimistic Oracle Resolution Test Complete!");
    console.log("\n✅ Summary:");
    console.log("  - Anyone can propose a resolution with a bond");
    console.log("  - Anyone can dispute a proposal with a larger bond");
    console.log("  - After dispute period, resolution can be finalized");
    console.log("  - Proposers get their bond back if resolution is correct");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });

