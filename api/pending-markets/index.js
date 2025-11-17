const prisma = require('../../lib/prismaClient');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      // Submit a new pending market
      const {
        question,
        description,
        category,
        imageUrl,
        endTime,
        resolutionTime,
        rules,
        creator,
        feeTxHash,
        feeAmountWei
      } = req.body;

      // Validation – fee fields are optional, core market fields are required
      if (!question || !category || !endTime || !resolutionTime || !creator) {
        return res.status(400).json({
          error: 'Missing required fields: question, category, endTime, resolutionTime, creator'
        });
      }

      // Create pending market
      const pendingMarket = await prisma.pendingMarket.create({
        data: {
          question,
          description: description || null,
          category,
          imageUrl: imageUrl || null,
          endTime: new Date(endTime),
          resolutionTime: new Date(resolutionTime),
          rules: rules ? JSON.stringify(rules) : null,
          creator,
          status: 'PENDING',
          feeTxHash: feeTxHash || null,
          feeAmountWei: feeAmountWei || null
        }
      });

      // Serialize BigInt values and parse rules
      const serializedMarket = serializeBigInt(pendingMarket);
      if (serializedMarket.rules) {
        serializedMarket.rules = JSON.parse(serializedMarket.rules);
      } else {
        serializedMarket.rules = [];
      }

      return res.status(201).json({
        success: true,
        pendingMarket: serializedMarket
      });
    }

    if (req.method === 'GET') {
      const { status, creator } = req.query;

      // Build filter
      const where = {};
      if (status) {
        where.status = status.toUpperCase();
      }
      if (creator) {
        where.creator = creator.toLowerCase();
      }

      // Fetch pending markets
      const pendingMarkets = await prisma.pendingMarket.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      // Serialize BigInt values and parse rules for each market
      const serializedMarkets = pendingMarkets.map(pm => {
        const serialized = serializeBigInt(pm);
        if (serialized.rules) {
          serialized.rules = JSON.parse(serialized.rules);
        } else {
          serialized.rules = [];
        }
        return serialized;
      });

      return res.status(200).json({
        success: true,
        pendingMarkets: serializedMarkets
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in pending-markets API:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Return more detailed error info for debugging
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      code: error.code || 'UNKNOWN',
      name: error.name || 'Error'
    });
  }
};

