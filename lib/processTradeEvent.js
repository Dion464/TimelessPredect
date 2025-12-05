const prisma = require('./prismaClient');

/**
 * Process a trade event from the blockchain and update database
 * - Records the trade in trades table
 * - Updates the user's position
 * - Updates the market stats
 */
async function processTradeEvent({
  event,
  txHash,
  logIndex,
  marketId,
  trader,
  isYes,
  sharesWei,
  priceBps,
  costWei,
  blockNumber,
  blockTime
}) {
  const marketIdBigInt = BigInt(marketId);
  const blockNumberBigInt = BigInt(blockNumber);
  const isSell = event === 'SharesSold';
  
  console.log(`Processing ${event}: market=${marketId}, trader=${trader}, isYes=${isYes}, shares=${sharesWei}`);

  try {
    // 1. Record the trade
    await prisma.trade.upsert({
      where: {
        txHash_logIndex: {
          txHash,
          logIndex
        }
      },
      update: {},
      create: {
        txHash,
        logIndex,
        marketId: marketIdBigInt,
        trader: trader.toLowerCase(),
        isYes,
        sharesWei,
        priceBps,
        costWei,
        tradeType: isSell ? 'SELL' : 'BUY',
        blockNumber: blockNumberBigInt,
        blockTime: blockTime instanceof Date ? blockTime : new Date(blockTime)
      }
    });

    // 2. Update user position
    const userAddress = trader.toLowerCase();
    
    // Get current position or create default
    const existingPosition = await prisma.position.findUnique({
      where: {
        userAddress_marketId: {
          userAddress,
          marketId: marketIdBigInt
        }
      }
    });

    let newYesShares = BigInt(existingPosition?.yesSharesWei || '0');
    let newNoShares = BigInt(existingPosition?.noSharesWei || '0');
    let newTotalInvested = BigInt(existingPosition?.totalInvestedWei || '0');
    const sharesBigInt = BigInt(sharesWei);
    const costBigInt = BigInt(costWei);

    if (isSell) {
      // Selling shares - decrease position
      if (isYes) {
        newYesShares = newYesShares > sharesBigInt ? newYesShares - sharesBigInt : BigInt(0);
      } else {
        newNoShares = newNoShares > sharesBigInt ? newNoShares - sharesBigInt : BigInt(0);
      }
      // Don't decrease total invested on sell (it represents what they put in)
    } else {
      // Buying shares - increase position
      if (isYes) {
        newYesShares = newYesShares + sharesBigInt;
      } else {
        newNoShares = newNoShares + sharesBigInt;
      }
      newTotalInvested = newTotalInvested + costBigInt;
    }

    // Upsert the position
    await prisma.position.upsert({
      where: {
        userAddress_marketId: {
          userAddress,
          marketId: marketIdBigInt
        }
      },
      update: {
        yesSharesWei: newYesShares.toString(),
        noSharesWei: newNoShares.toString(),
        totalInvestedWei: newTotalInvested.toString(),
        updatedAt: new Date()
      },
      create: {
        userAddress,
        marketId: marketIdBigInt,
        yesSharesWei: newYesShares.toString(),
        noSharesWei: newNoShares.toString(),
        totalInvestedWei: newTotalInvested.toString()
      }
    });

    // 3. Update market stats
    const market = await prisma.market.findUnique({
      where: { marketId: marketIdBigInt }
    });

    if (market) {
      let totalYes = BigInt(market.totalYesSharesWei || '0');
      let totalNo = BigInt(market.totalNoSharesWei || '0');
      let totalVolume = BigInt(market.totalVolumeWei || '0');

      if (isSell) {
        if (isYes) {
          totalYes = totalYes > sharesBigInt ? totalYes - sharesBigInt : BigInt(0);
        } else {
          totalNo = totalNo > sharesBigInt ? totalNo - sharesBigInt : BigInt(0);
        }
      } else {
        if (isYes) {
          totalYes = totalYes + sharesBigInt;
        } else {
          totalNo = totalNo + sharesBigInt;
        }
      }
      totalVolume = totalVolume + costBigInt;

      await prisma.market.update({
        where: { marketId: marketIdBigInt },
        data: {
          totalYesSharesWei: totalYes.toString(),
          totalNoSharesWei: totalNo.toString(),
          totalVolumeWei: totalVolume.toString(),
          lastYesPriceBps: isYes ? priceBps : undefined,
          lastNoPriceBps: !isYes ? priceBps : undefined,
          lastTradeBlock: blockNumberBigInt,
          lastTradeTxHash: txHash
        }
      });
    }

    console.log(`✅ Trade processed: ${trader.slice(0, 8)}... ${isSell ? 'sold' : 'bought'} ${isYes ? 'YES' : 'NO'} shares`);
    
    return { success: true };
  } catch (error) {
    console.error('Error processing trade event:', error);
    throw error;
  }
}

module.exports = processTradeEvent;

