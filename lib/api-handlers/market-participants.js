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
      const { marketId } = req.query;

      if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
      }

      // Get all positions for this market (users who have traded)
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
          noSharesWei: true
        }
      });

      const participants = positions.map(pos => ({
        userAddress: pos.userAddress.toLowerCase(),
        yesShares: pos.yesSharesWei,
        noShares: pos.noSharesWei
      }));

      return res.status(200).json({
        success: true,
        participants: serializeBigInt(participants)
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in market participants API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

