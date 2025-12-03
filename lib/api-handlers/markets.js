const prisma = require('../prismaClient');

// Helper function to convert BigInt to Number for JSON serialization
function serializeMarket(market) {
  return {
    ...market,
    marketId: market.marketId ? Number(market.marketId) : null,
    lastTradeBlock: market.lastTradeBlock ? Number(market.lastTradeBlock) : null,
    yesPrice: market.lastYesPriceBps ? Math.round(market.lastYesPriceBps / 100) : 50,
    noPrice: market.lastNoPriceBps ? Math.round(market.lastNoPriceBps / 100) : 50,
  };
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 10, sort = 'createdAt', category, resolved } = req.query;

    // Build where clause
    const where = {};
    if (category) {
      where.category = category;
    }
    if (resolved !== undefined) {
      where.resolved = resolved === 'true';
    }

    // Build orderBy clause
    let orderBy = { createdAt: 'desc' };
    if (sort === 'volume') {
      orderBy = { totalVolumeWei: 'desc' };
    } else if (sort === 'endTime') {
      orderBy = { endTime: 'asc' };
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy,
      take: parseInt(limit, 10),
    });

    const serializedMarkets = markets.map(serializeMarket);

    return res.status(200).json({ 
      markets: serializedMarkets,
      count: serializedMarkets.length 
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return res.status(500).json({ error: error.message });
  }
};
