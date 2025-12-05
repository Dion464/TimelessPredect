const prisma = require('../prismaClient');

// Helper to convert BigInt values to strings for JSON serialization
function serializeBigInt(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const serialized = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  
  return obj;
}

// Convert Wei string to a number for sorting
function weiToNumber(weiStr) {
  if (!weiStr || weiStr === '0') return 0;
  // Handle very large numbers by dividing by 1e18 (Wei to ETH)
  const wei = BigInt(weiStr);
  // Return as number (may lose precision for very large values, but ok for sorting)
  return Number(wei / BigInt(1e12)) / 1e6; // Convert to readable number
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { marketId, limit = '5' } = req.query;

      if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
      }

      const limitNum = parseInt(limit, 10) || 5;

      // Get all positions for this market (users who have shares)
      const positions = await prisma.position.findMany({
        where: {
          marketId: BigInt(marketId),
          OR: [
            { yesSharesWei: { not: '0' } },
            { noSharesWei: { not: '0' } }
          ]
        },
        select: {
          userAddress: true,
          yesSharesWei: true,
          noSharesWei: true,
          totalInvestedWei: true,
          updatedAt: true
        }
      });

      // Calculate total holdings and sort by largest holder
      const holders = positions.map(pos => {
        const yesShares = weiToNumber(pos.yesSharesWei);
        const noShares = weiToNumber(pos.noSharesWei);
        const totalInvested = weiToNumber(pos.totalInvestedWei);
        const totalShares = yesShares + noShares;
        
        return {
          address: pos.userAddress.toLowerCase(),
          yesShares: pos.yesSharesWei,
          noShares: pos.noSharesWei,
          totalInvested: pos.totalInvestedWei,
          yesSharesNum: yesShares,
          noSharesNum: noShares,
          totalSharesNum: totalShares,
          totalInvestedNum: totalInvested,
          updatedAt: pos.updatedAt,
          // Determine if they're mostly YES or NO holder
          position: yesShares > noShares ? 'yes' : (noShares > yesShares ? 'no' : 'both')
        };
      });

      // Sort by total shares (largest first) and take top N
      holders.sort((a, b) => b.totalSharesNum - a.totalSharesNum);
      const topHolders = holders.slice(0, limitNum);

      // Calculate total for percentage
      const totalAllShares = holders.reduce((sum, h) => sum + h.totalSharesNum, 0);

      // Add percentage ownership
      const holdersWithPercentage = topHolders.map((holder, index) => ({
        rank: index + 1,
        address: holder.address,
        yesShares: holder.yesSharesNum.toFixed(4),
        noShares: holder.noSharesNum.toFixed(4),
        totalShares: holder.totalSharesNum.toFixed(4),
        totalInvested: holder.totalInvestedNum.toFixed(4),
        position: holder.position,
        percentage: totalAllShares > 0 ? ((holder.totalSharesNum / totalAllShares) * 100).toFixed(1) : '0',
        updatedAt: holder.updatedAt
      }));

      return res.status(200).json({
        success: true,
        marketId: marketId,
        totalHolders: holders.length,
        topHolders: holdersWithPercentage
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in top holders API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

