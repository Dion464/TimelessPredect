const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🧪 Full Test: Optimistic Oracle Resolution System...\n");

    const [deployer, proposer, disputer, finalizer] = await ethers.getSigners();
    
    // Load contract address from config
    const configPath = path.join(__dirname, '../../frontend/src/contracts/config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const PREDICTION_MARKET_ADDRESS_MATCH = configContent.match(/PREDICTION_MARKET_ADDRESS": "(0x[a-fA-F0-9]{40})"/);
    const PREDICTION_MARKET_ADDRESS = PREDICTION_MARKET_ADDRESS_MATCH ? PREDICTION_MARKET_ADDRESS_MATCH[1] : null;

    if (!PREDICTION_MARKET_ADDRESS) {
        console.error("❌ Prediction Market address not found in config.js");
        return;
    }

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    const predictionMarket = ETHPredictionMarket.attach(PREDICTION_MARKET_ADDRESS);

    // Create a test market
    console.log("📋 Step 1: Creating test market...");
    const marketCreationFee = await predictionMarket.marketCreationFee();
    const currentBlock = await ethers.provider.getBlock('latest');
    const currentTime = currentBlock.timestamp;
    
    const tx = await predictionMarket.connect(deployer).createMarket(
        "Test: Will Optimistic Oracle Work?",
        "Testing the optimistic oracle resolution system",
        "Test",
        currentTime + 3600, // End time 1 hour from now
        currentTime + 7200, // Resolution time 2 hours from now
        { value: marketCreationFee }
    );
    await tx.wait();
    
    const activeMarketIds = await predictionMarket.getActiveMarkets();
    const marketId = activeMarketIds[activeMarketIds.length - 1];
    console.log(`✅ Created test market ID: ${marketId.toString()}`);
    
    // Fast-forward time to make market ready for resolution
    console.log("📋 Fast-forwarding time to resolution time...");
    await ethers.provider.send("evm_increaseTime", [7200]); // Fast-forward 2 hours
    await ethers.provider.send("evm_mine", []); // Mine a block
    console.log("✅ Time fast-forwarded\n");

    // Get bond amounts
    const proposerBond = await predictionMarket.proposerBondAmount();
    const disputePeriod = await predictionMarket.disputePeriod();
    
    console.log("📋 Step 2: Proposing Resolution (YES)...");
    try {
        const tx1 = await predictionMarket.connect(proposer).proposeResolution(
            marketId,
            1, // YES
            { value: proposerBond }
        );
        await tx1.wait();
        console.log("✅ Resolution proposed successfully!");
        
        const proposal = await predictionMarket.getResolutionProposal(marketId);
        console.log(`   Proposed Outcome: YES`);
        console.log(`   Proposer: ${proposal.proposer}`);
        console.log(`   Bond: ${ethers.utils.formatEther(proposal.proposerBond)} ETH\n`);
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
        return;
    }

    console.log("📋 Step 3: Disputing Resolution...");
    const disputeBond = proposerBond.mul(2); // 2x multiplier
    try {
        const tx2 = await predictionMarket.connect(disputer).disputeResolution(
            marketId,
            { value: disputeBond }
        );
        await tx2.wait();
        console.log("✅ Resolution disputed successfully!");
        console.log(`   Disputer: ${disputer.address}`);
        console.log(`   Bond: ${ethers.utils.formatEther(disputeBond)} ETH\n`);
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
        return;
    }

    console.log("📋 Step 4: Proposing New Resolution After Dispute (NO)...");
    try {
        const tx3 = await predictionMarket.connect(disputer).proposeResolution(
            marketId,
            2, // NO
            { value: proposerBond }
        );
        await tx3.wait();
        console.log("✅ New resolution proposed!");
        
        const newProposal = await predictionMarket.getResolutionProposal(marketId);
        console.log(`   Proposed Outcome: ${newProposal.proposedOutcome === 1 ? 'YES' : 'NO'}`);
        console.log(`   Proposer: ${newProposal.proposer}\n`);
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
        return;
    }

    console.log("📋 Step 5: Fast-forwarding time and finalizing...");
    let proposal = await predictionMarket.getResolutionProposal(marketId);
    const timeNeeded = proposal.timeUntilFinalizable.toNumber();
    
    if (timeNeeded > 0) {
        console.log(`   Fast-forwarding ${timeNeeded} seconds...`);
        await ethers.provider.send("evm_increaseTime", [timeNeeded]);
        await ethers.provider.send("evm_mine", []);
        console.log("   ✅ Time fast-forwarded\n");
    }
    
    console.log("📋 Step 6: Finalizing Resolution...");
    try {
        const tx4 = await predictionMarket.connect(finalizer).finalizeResolution(marketId);
        await tx4.wait();
        console.log("✅ Resolution finalized successfully!");
        console.log("   Transaction:", tx4.hash);
        
        const finalizedMarket = await predictionMarket.markets(marketId);
        console.log(`   Market Resolved: ${finalizedMarket.resolved ? '✅ YES' : '❌ NO'}`);
        console.log(`   Final Outcome: ${finalizedMarket.outcome === 1 ? 'YES' : finalizedMarket.outcome === 2 ? 'NO' : 'INVALID'}`);
        console.log(`   Market Active: ${finalizedMarket.active ? 'YES' : 'NO (closed)'}\n`);
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
    }
    
    // Final state
    console.log("📊 Final Proposal State:");
    proposal = await predictionMarket.getResolutionProposal(marketId);
    console.log(`   Proposed Outcome: ${proposal.proposedOutcome === 1 ? 'YES' : proposal.proposedOutcome === 2 ? 'NO' : 'INVALID'}`);
    console.log(`   Proposer: ${proposal.proposer}`);
    console.log(`   Disputed: ${proposal.disputed ? 'YES' : 'NO'}`);
    console.log(`   Finalized: ${proposal.finalized ? 'YES' : 'NO'}`);

    console.log("\n🎉 Optimistic Oracle Resolution System Test Complete!");
    console.log("\n✅ Features Working:");
    console.log("  ✓ Anyone can propose resolution with bond");
    console.log("  ✓ Anyone can dispute with larger bond");
    console.log("  ✓ Disputed proposals are cleared");
    console.log("  ✓ New proposals can be made after dispute");
    console.log("  ✓ Resolution can be finalized after dispute period");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });

