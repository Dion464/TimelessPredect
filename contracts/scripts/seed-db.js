const { ethers } = require("hardhat");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [{ address: deployerAddr }, traderA, traderB] = await ethers.getSigners();
  console.log("🚀 Seeding database with simulated trades");
  console.log("Deployer:", deployerAddr);

  const marketCreationFee = ethers.utils.parseEther("0.01");
  const platformFeePercent = 200; // 2%

  const ETHPredictionMarket = await ethers.getContractFactory("ETHPredictionMarket");
  const predictionMarket = await ETHPredictionMarket.deploy(marketCreationFee, platformFeePercent);
  await predictionMarket.deployed();

  console.log("Prediction market deployed at:", predictionMarket.address);

  const block = await ethers.provider.getBlock('latest');
  const now = block.timestamp;
  const marketTx = await predictionMarket.createMarket(
    "Test market: ETH above $5k by year end?",
    "Market used for local database seeding",
    "Testing",
    now + 7 * 24 * 60 * 60,
    now + 8 * 24 * 60 * 60,
    { value: marketCreationFee }
  );
  await marketTx.wait();

  const marketId = 1;
  console.log("Created market", marketId);

  const { processTradeEvent } = await import("../../lib/processTradeEvent.js");
  const { upsertMarketMetadata } = await import("../../lib/processMarketEvent.js");
  const { disconnectPrisma } = await import("../../lib/prismaClient.js");

  const marketStruct = await predictionMarket.markets(marketId);
  const endTimeSeconds = marketStruct.endTime.toNumber();
  const resolutionSeconds = marketStruct.resolutionTime.toNumber();

  await upsertMarketMetadata({
    marketId: marketId.toString(),
    question: "Test market: ETH above $5k by year end?",
    description: "Market used for local database seeding",
    category: "Testing",
    endTime: endTimeSeconds ? new Date(endTimeSeconds * 1000) : null,
    resolutionTime: resolutionSeconds ? new Date(resolutionSeconds * 1000) : null,
    creator: deployerAddr,
    totalYesShares: marketStruct.totalYesShares.toString(),
    totalNoShares: marketStruct.totalNoShares.toString(),
    totalVolume: marketStruct.totalVolume.toString(),
    blockTime: new Date(block.timestamp * 1000)
  });

  async function recordFromReceipt(receipt) {
    const interfaces = await Promise.all(
      (receipt.events || []).map(async (evt) => {
        if (!evt?.event || (evt.event !== 'SharesPurchased' && evt.event !== 'SharesSold')) {
          return null;
        }
        const blockInfo = await evt.getBlock();
        const args = evt.args;
        const payload = {
          event: evt.event,
          txHash: evt.transactionHash,
          logIndex: evt.logIndex,
          marketId: args.marketId.toString(),
          trader: (evt.event === 'SharesPurchased' ? args.buyer : args.seller),
          isYes: Boolean(args.isYes),
          sharesWei: args.shares.toString(),
          priceBps: Number(args.newPrice.toString()),
          costWei: (evt.event === 'SharesPurchased' ? args.cost : args.payout).toString(),
          blockNumber: evt.blockNumber,
          blockTime: new Date(blockInfo.timestamp * 1000)
        };
        await processTradeEvent(payload);
        return payload;
      })
    );

    const recorded = interfaces.filter(Boolean);
    recorded.forEach((evt) => {
      console.log(`  ↳ Stored ${evt.event} tx=${evt.txHash} logIndex=${evt.logIndex}`);
    });
  }

  // Trader A buys YES with 0.5 ETH
  const buyYesTx = await predictionMarket.connect(traderA).buyShares(marketId, true, {
    value: ethers.utils.parseEther("0.5")
  });
  const buyYesReceipt = await buyYesTx.wait();
  console.log("Trader A bought YES shares");
  await recordFromReceipt(buyYesReceipt);

  // Trader B buys NO with 0.3 ETH
  const buyNoTx = await predictionMarket.connect(traderB).buyShares(marketId, false, {
    value: ethers.utils.parseEther("0.3")
  });
  const buyNoReceipt = await buyNoTx.wait();
  console.log("Trader B bought NO shares");
  await recordFromReceipt(buyNoReceipt);

  // Trader A sells half of their YES shares
  const positionA = await predictionMarket.getUserPosition(marketId, traderA.address);
  const halfYes = positionA.yesShares.div(2);
  if (halfYes.gt(0)) {
    const sellYesTx = await predictionMarket.connect(traderA).sellShares(marketId, true, halfYes);
    const sellYesReceipt = await sellYesTx.wait();
    console.log("Trader A sold some YES shares");
    await recordFromReceipt(sellYesReceipt);
  }

  // Trader B sells a portion of NO shares
  const positionB = await predictionMarket.getUserPosition(marketId, traderB.address);
  const sellNoAmount = positionB.noShares.div(3);
  if (sellNoAmount.gt(0)) {
    const sellNoTx = await predictionMarket.connect(traderB).sellShares(marketId, false, sellNoAmount);
    const sellNoReceipt = await sellNoTx.wait();
    console.log("Trader B sold some NO shares");
    await recordFromReceipt(sellNoReceipt);
  }

  await disconnectPrisma();
  console.log("✅ Database seeding complete");
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("❌ Failed to seed trades:", error);
    try {
      const { disconnectPrisma } = await import("../../lib/prismaClient.js");
      await disconnectPrisma();
    } catch (err) {
      console.error("Error during Prisma disconnect", err);
    }
    process.exit(1);
  });
