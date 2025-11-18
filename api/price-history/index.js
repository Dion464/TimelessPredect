const prisma = require('../../lib/prismaClient');

// Helper to serialize BigInt values
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
  
  if (typeof obj === 'object') {
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
    const { marketId, timeframe = '24h' } = req.query;

    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    const marketIdBigInt = BigInt(marketId);

    // Calculate cutoff time based on timeframe
    const now = new Date();
    let cutoffTime;
    
    switch (timeframe) {
      case '1h':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
      case '1d':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
      case '1w':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
      case '1m':
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        cutoffTime = null; // No cutoff
        break;
      default:
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
    }

    // Build query
    const where = {
      marketId: marketIdBigInt
    };

    if (cutoffTime) {
      where.timestamp = {
        gte: cutoffTime
      };
    }

    // Fetch price snapshots
    const snapshots = await prisma.priceSnapshot.findMany({
      where,
      orderBy: {
        timestamp: 'asc'
      },
      take: 10000 // Limit to prevent huge responses
    });

    // Format data for chart
    const yesPriceHistory = snapshots.map(snapshot => ({
      price: snapshot.yesPriceBps / 10000, // Convert basis points to decimal (5000 -> 0.5)
      timestamp: snapshot.timestamp.toISOString()
    }));

    const noPriceHistory = snapshots.map(snapshot => ({
      price: snapshot.noPriceBps / 10000, // Convert basis points to decimal
      timestamp: snapshot.timestamp.toISOString()
    }));

    // Combined price history (for general charts)
    const priceHistory = snapshots.map(snapshot => ({
      price: snapshot.yesPriceBps / 10000,
      timestamp: snapshot.timestamp.toISOString()
    }));

    return res.status(200).json({
      success: true,
      data: {
        priceHistory,
        yesPriceHistory,
        noPriceHistory,
        count: snapshots.length
      }
    });

  } catch (error) {
    console.error('Error fetching price history:', error);
    return res.status(500).json({
      error: 'Failed to fetch price history',
      details: error.message
    });
  }
};

