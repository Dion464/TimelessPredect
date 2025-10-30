const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🗳️  Simulating Optimistic Oracle Voting Process\n");
    console.log("=" .repeat(60));

    const [deployer, voter1, voter2] = await ethers.getSigners();
    
    console.log("\n📋 Accounts:");
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Voter 1:  ${voter1.address}`);
    console.log(`   Voter 2:  ${voter2.address}\n`);

    // Try to find contract address
    const configPath = path.join(__dirname, '../../frontend/src/contracts/config.js');
    let PREDICTION_MARKET_ADDRESS = null;
    
    // Try common Hardhat addresses first (most likely)
    const possibleAddresses = [
        "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Default Hardhat #1
        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"  // Default Hardhat #2
    ];
    
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const PREDICTION_MARKET_ADDRESS_MATCH = configContent.match(/PREDICTION_MARKET_ADDRESS": "(0x[a-fA-F0-9]{40})"/);
        if (PREDICTION_MARKET_ADDRESS_MATCH) {
            possibleAddresses.unshift(PREDICTION_MARKET_ADDRESS_MATCH[1]); // Put config address first
        }
    }

    const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
    let predictionMarket = null;
    
    // Try each address until one works
    for (const address of possibleAddresses) {
        try {
            const testContract = ETHPredictionMarket.attach(address);
            await testContract.marketCreationFee(); // Test if contract exists
            PREDICTION_MARKET_ADDRESS = address;
            predictionMarket = testContract;
            console.log(`✅ Using contract at: ${address}\n`);
            break;
        } catch (error) {
            continue; // Try next address
        }
    }
    
    // If no address worked, deploy new contract
    if (!predictionMarket) {
        console.log("⚠️  No existing contract found, deploying new one...\n");
        const marketCreationFee = ethers.utils.parseEther("0.01");
        const platformFeePercent = 200;
        const deployed = await ETHPredictionMarket.deploy(marketCreationFee, platformFeePercent);
        await deployed.deployed();
        PREDICTION_MARKET_ADDRESS = deployed.address;
        predictionMarket = deployed;
        console.log(`✅ Deployed new contract at: ${PREDICTION_MARKET_ADDRESS}\n`);
    }

    // Get current block time (refresh to ensure we have latest)
    let currentBlock = await ethers.provider.getBlock('latest');
    let currentTime = currentBlock.timestamp;
    
    // Ensure we're using fresh block time
    await ethers.provider.send("evm_mine", []); // Mine a new block
    currentBlock = await ethers.provider.getBlock('latest');
    currentTime = currentBlock.timestamp;
    
    console.log(`\n⏰ Current Blockchain Time: ${new Date(currentTime * 1000).toLocaleString()}`);
    console.log(`   Timestamp: ${currentTime}\n`);

    // ========================================
    // STEP 1: CREATE MARKET (Closes in 1 minute)
    // ========================================
    console.log("📝 STEP 1: Creating Market that closes in 1 minute...\n");
    
    const marketCreationFee = await predictionMarket.marketCreationFee();
    console.log(`   Market Creation Fee: ${ethers.utils.formatEther(marketCreationFee)} ETH`);
    
    // Add buffer to ensure end time is definitely in future
    const endTime = currentTime + 120; // 2 minutes from now (buffer for transaction processing)
    const resolutionTime = currentTime + 180; // 3 minutes from now (can propose after 3 min)
    
    console.log(`   End Time: ${new Date(endTime * 1000).toLocaleString()} (${endTime})`);
    console.log(`   Resolution Time: ${new Date(resolutionTime * 1000).toLocaleString()} (${resolutionTime})`);
    console.log(`   Market will close in: ~2 minutes`);
    console.log(`   Can vote/resolve after: ~3 minutes\n`);
    
    const createTx = await predictionMarket.connect(deployer).createMarket(
        "Quick Test: Will this market resolve correctly?",
        "This is a test market to simulate the voting process. It closes in 1 minute.",
        "Test",
        endTime,
        resolutionTime,
        { value: marketCreationFee }
    );
    
    console.log("   ⏳ Transaction sent...");
    const createReceipt = await createTx.wait();
    console.log(`   ✅ Market created! Transaction: ${createReceipt.transactionHash}`);
    
    const activeMarketIds = await predictionMarket.getActiveMarkets();
    const marketId = activeMarketIds[activeMarketIds.length - 1];
    console.log(`   📋 Market ID: ${marketId.toString()}\n`);

    // Get market info
    const market = await predictionMarket.markets(marketId);
    console.log("   📊 Market Info:");
    console.log(`      Question: "${market.question}"`);
    console.log(`      Active: ${market.active}`);
    console.log(`      Resolved: ${market.resolved}`);
    console.log(`      End Time: ${new Date(market.endTime.toNumber() * 1000).toLocaleString()}`);
    console.log(`      Resolution Time: ${new Date(market.resolutionTime.toNumber() * 1000).toLocaleString()}\n`);

    // ========================================
    // STEP 2: WAIT FOR MARKET TO CLOSE
    // ========================================
    console.log("⏳ STEP 2: Waiting for market to close (fast-forwarding 2 minutes)...\n");
    
    await ethers.provider.send("evm_increaseTime", [120]); // Fast-forward 2 minutes
    await ethers.provider.send("evm_mine", []); // Mine a block
    
    const newBlock = await ethers.provider.getBlock('latest');
    console.log(`   ✅ Time fast-forwarded to: ${new Date(newBlock.timestamp * 1000).toLocaleString()}`);
    console.log(`   📅 Market is now closed (no more trading)\n`);

    // ========================================
    // STEP 3: WAIT FOR RESOLUTION WINDOW
    // ========================================
    console.log("⏳ STEP 3: Waiting for resolution window (fast-forwarding 1 more minute)...\n");
    
    await ethers.provider.send("evm_increaseTime", [60]); // Fast-forward 1 more minute
    await ethers.provider.send("evm_mine", []); // Mine a block
    
    const finalBlock = await ethers.provider.getBlock('latest');
    console.log(`   ✅ Time fast-forwarded to: ${new Date(finalBlock.timestamp * 1000).toLocaleString()}`);
    console.log(`   🗳️  Resolution window is NOW OPEN (can vote!)\n`);

    // ========================================
    // STEP 4: VOTER 1 PROPOSES YES
    // ========================================
    console.log("🗳️  STEP 4: Voter 1 Proposes Resolution (YES)...\n");
    
    const proposerBond = await predictionMarket.proposerBondAmount();
    console.log(`   Proposer Bond Required: ${ethers.utils.formatEther(proposerBond)} ETH`);
    
    const voter1Balance = await voter1.getBalance();
    console.log(`   Voter 1 Balance: ${ethers.utils.formatEther(voter1Balance)} ETH\n`);
    
    try {
        const proposeTx = await predictionMarket.connect(voter1).proposeResolution(
            marketId,
            1, // YES = outcome 1
            { value: proposerBond }
        );
        
        console.log("   ⏳ Proposing resolution (YES)...");
        await proposeTx.wait();
        console.log(`   ✅ Resolution proposed! Transaction: ${proposeTx.hash}\n`);
        
        // Get proposal details
        const proposal = await predictionMarket.getResolutionProposal(marketId);
        const proposedOutcomeNum = typeof proposal.proposedOutcome === 'object' ? proposal.proposedOutcome.toNumber() : proposal.proposedOutcome;
        const proposalTimeNum = typeof proposal.proposalTime === 'object' ? proposal.proposalTime.toNumber() : proposal.proposalTime;
        const proposerBondNum = typeof proposal.proposerBond === 'object' ? proposal.proposerBond : proposal.proposerBond;
        const timeUntilFinalizableNum = typeof proposal.timeUntilFinalizable === 'object' ? proposal.timeUntilFinalizable.toNumber() : proposal.timeUntilFinalizable;
        
        console.log("   📋 Proposal Details:");
        console.log(`      Proposed Outcome: ${proposedOutcomeNum === 1 ? 'YES ✅' : proposedOutcomeNum === 2 ? 'NO ❌' : 'INVALID ⚠️'}`);
        console.log(`      Proposer: ${proposal.proposer}`);
        console.log(`      Proposal Time: ${new Date(proposalTimeNum * 1000).toLocaleString()}`);
        console.log(`      Bond: ${ethers.utils.formatEther(proposerBondNum)} ETH`);
        console.log(`      Disputed: ${proposal.disputed ? 'Yes' : 'No'}`);
        console.log(`      Finalized: ${proposal.finalized ? 'Yes' : 'No'}`);
        
        const disputePeriod = await predictionMarket.disputePeriod();
        const disputePeriodNum = typeof disputePeriod === 'object' ? disputePeriod.toNumber() : disputePeriod;
        console.log(`      Time Until Finalizable: ${Math.ceil(timeUntilFinalizableNum / 3600)} hours (${timeUntilFinalizableNum} seconds)`);
        console.log(`      Dispute Period: ${disputePeriodNum / 86400} days\n`);
        
    } catch (error) {
        console.log(`   ❌ Error proposing: ${error.message}\n`);
        return;
    }

    // ========================================
    // STEP 5: CHECK IF ANYONE WANTS TO DISPUTE
    // ========================================
    console.log("⚔️  STEP 5: Dispute Window (24 hours)...\n");
    console.log("   💡 For this demo, we'll skip the dispute period.");
    console.log("   💡 In real scenario, anyone could dispute within 24 hours.\n");
    
    const proposal = await predictionMarket.getResolutionProposal(marketId);
    const disputePeriod = await predictionMarket.disputePeriod();
    const disputePeriodNum = typeof disputePeriod === 'object' ? disputePeriod.toNumber() : disputePeriod;
    
    console.log(`   ⏳ Fast-forwarding dispute period (${disputePeriodNum / 86400} days)...\n`);
    
    await ethers.provider.send("evm_increaseTime", [disputePeriod.toNumber() + 60]); // Fast-forward dispute period + 1 minute
    await ethers.provider.send("evm_mine", []);
    
    const afterDisputeBlock = await ethers.provider.getBlock('latest');
    console.log(`   ✅ Time fast-forwarded to: ${new Date(afterDisputeBlock.timestamp * 1000).toLocaleString()}`);
    console.log(`   ✅ Dispute period has expired - proposal can be finalized!\n`);

    // ========================================
    // STEP 6: FINALIZE RESOLUTION
    // ========================================
    console.log("✅ STEP 6: Finalizing Resolution...\n");
    
    try {
        // Anyone can finalize (free action)
        const finalizeTx = await predictionMarket.connect(voter2).finalizeResolution(marketId);
        
        console.log("   ⏳ Finalizing resolution...");
        await finalizeTx.wait();
        console.log(`   ✅ Resolution finalized! Transaction: ${finalizeTx.hash}\n`);
        
        // Get final market state
        const finalMarket = await predictionMarket.markets(marketId);
        const finalOutcomeNum = typeof finalMarket.outcome === 'object' ? finalMarket.outcome.toNumber() : finalMarket.outcome;
        
        console.log("   🏆 Final Market State:");
        console.log(`      Resolved: ${finalMarket.resolved ? 'Yes ✅' : 'No'}`);
        console.log(`      Outcome: ${finalOutcomeNum === 1 ? 'YES ✅' : finalOutcomeNum === 2 ? 'NO ❌' : 'INVALID ⚠️'}`);
        console.log(`      Active: ${finalMarket.active ? 'Yes' : 'No (closed)'}`);
        
        const finalProposal = await predictionMarket.getResolutionProposal(marketId);
        console.log(`      Proposal Finalized: ${finalProposal.finalized ? 'Yes ✅' : 'No'}\n`);
        
        console.log("   🎉 WINNER ANNOUNCED!");
        console.log(`      ${finalOutcomeNum === 1 ? 'YES won! ✅' : finalOutcomeNum === 2 ? 'NO won! ❌' : 'INVALID market ⚠️'}\n`);
        
    } catch (error) {
        console.log(`   ❌ Error finalizing: ${error.message}\n`);
        return;
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log("=" .repeat(60));
    console.log("\n📊 SIMULATION COMPLETE!\n");
    console.log("Summary of what happened:");
    console.log("  1. ✅ Created market that closes in 1 minute");
    console.log("  2. ✅ Fast-forwarded time to resolution window");
    console.log("  3. ✅ Voter 1 proposed: YES (outcome = 1)");
    console.log("  4. ✅ Fast-forwarded dispute period (24 hours)");
    console.log("  5. ✅ Voter 2 finalized resolution");
    const finalMarketCheck = await predictionMarket.markets(marketId);
    const finalOutcomeCheck = typeof finalMarketCheck.outcome === 'object' ? finalMarketCheck.outcome.toNumber() : finalMarketCheck.outcome;
    console.log(`  6. ✅ Winner: ${finalOutcomeCheck === 1 ? 'YES ✅' : finalOutcomeCheck === 2 ? 'NO ❌' : 'INVALID ⚠️'}\n`);
    
    console.log("💡 Next Steps:");
    console.log("   - Users with YES shares can now call claimWinnings()");
    console.log("   - Users with NO shares get nothing");
    console.log("   - Proposer got their bond back as reward\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Simulation failed:", error);
        process.exit(1);
    });

