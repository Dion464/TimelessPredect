const prisma = require('../../lib/prismaClient');

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

      return res.status(201).json({
        success: true,
        pendingMarket: {
          ...pendingMarket,
          rules: pendingMarket.rules ? JSON.parse(pendingMarket.rules) : []
        }
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

      return res.status(200).json({
        success: true,
        pendingMarkets: pendingMarkets.map(pm => ({
          ...pm,
          rules: pm.rules ? JSON.parse(pm.rules) : []
        }))
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

