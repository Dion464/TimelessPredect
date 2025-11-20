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

  // If this is a PATCH request to /api/pending-markets/:id, it should go to [id].js
  // But if it somehow reaches here, return 405
  if (req.method === 'PATCH') {
    console.error('[pending-markets/index] PATCH request reached index.js - should go to [id].js');
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'PATCH requests should go to /api/pending-markets/:id'
    });
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

    if (req.method === 'PATCH') {
      // Update pending market status (approve/reject)
      const marketId = req.url.split('/').pop().split('?')[0]; // Extract ID from URL
      
      if (!marketId || marketId === 'pending-markets') {
        return res.status(400).json({ error: 'Market ID is required' });
      }

      const { status, deployedMarketId, rejectionReason } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      // Validate status
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DEPLOYED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }

      // Build update data
      const updateData = {
        status: status.toUpperCase()
      };

      if (status.toUpperCase() === 'DEPLOYED' && deployedMarketId) {
        updateData.deployedMarketId = BigInt(deployedMarketId);
      }

      if (status.toUpperCase() === 'REJECTED' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      // Update the pending market
      const updatedMarket = await prisma.pendingMarket.update({
        where: { id: BigInt(marketId) },
        data: updateData
      });

      // Serialize BigInt values
      const serializedMarket = serializeBigInt(updatedMarket);
      if (serializedMarket.rules) {
        serializedMarket.rules = JSON.parse(serializedMarket.rules);
      } else {
        serializedMarket.rules = [];
      }

      return res.status(200).json({
        success: true,
        pendingMarket: serializedMarket
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

