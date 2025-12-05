const prisma = require('../prismaClient');

/**
 * API handler to update user positions after a trade
 * Called from frontend after successful on-chain trades
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      marketId,
      userAddress,
      isYes,
      isBuy, // true for buy, false for sell
      sharesWei,
      costWei,
      txHash,
      blockNumber
    } = req.body;

    if (!marketId || !userAddress || isYes === undefined || isBuy === undefined || !sharesWei) {
      return res.status(400).json({ 
        error: 'Missing required fields: marketId, userAddress, isYes, isBuy, sharesWei' 
      });
    }

    const marketIdBigInt = BigInt(marketId);
    const normalizedAddress = userAddress.toLowerCase();
    const sharesBigInt = BigInt(sharesWei);
    const costBigInt = BigInt(costWei || '0');

    console.log(`Updating position: market=${marketId}, user=${normalizedAddress}, isYes=${isYes}, isBuy=${isBuy}, shares=${sharesWei}`);

    // Get current position
    const existingPosition = await prisma.position.findUnique({
      where: {
        userAddress_marketId: {
          userAddress: normalizedAddress,
          marketId: marketIdBigInt
        }
      }
    });

    let newYesShares = BigInt(existingPosition?.yesSharesWei || '0');
    let newNoShares = BigInt(existingPosition?.noSharesWei || '0');
    let newTotalInvested = BigInt(existingPosition?.totalInvestedWei || '0');

    if (isBuy) {
      // Buying shares - increase position
      if (isYes) {
        newYesShares = newYesShares + sharesBigInt;
      } else {
        newNoShares = newNoShares + sharesBigInt;
      }
      newTotalInvested = newTotalInvested + costBigInt;
    } else {
      // Selling shares - decrease position
      if (isYes) {
        newYesShares = newYesShares > sharesBigInt ? newYesShares - sharesBigInt : BigInt(0);
      } else {
        newNoShares = newNoShares > sharesBigInt ? newNoShares - sharesBigInt : BigInt(0);
      }
    }

    // Upsert the position
    const position = await prisma.position.upsert({
      where: {
        userAddress_marketId: {
          userAddress: normalizedAddress,
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
        userAddress: normalizedAddress,
        marketId: marketIdBigInt,
        yesSharesWei: newYesShares.toString(),
        noSharesWei: newNoShares.toString(),
        totalInvestedWei: newTotalInvested.toString()
      }
    });

    console.log(`✅ Position updated: ${normalizedAddress.slice(0, 8)}... now has YES=${newYesShares}, NO=${newNoShares}`);

    return res.status(200).json({
      success: true,
      position: {
        userAddress: position.userAddress,
        marketId: position.marketId.toString(),
        yesSharesWei: position.yesSharesWei,
        noSharesWei: position.noSharesWei,
        totalInvestedWei: position.totalInvestedWei
      }
    });
  } catch (error) {
    console.error('Error updating position:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

