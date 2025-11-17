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
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // Get a single pending market
      const pendingMarket = await prisma.pendingMarket.findUnique({
        where: { id: BigInt(id) }
      });

      if (!pendingMarket) {
        return res.status(404).json({ error: 'Pending market not found' });
      }

      // Serialize BigInt values and parse rules
      const serializedMarket = serializeBigInt(pendingMarket);
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

    if (req.method === 'PATCH') {
      // Approve or reject a pending market
      const { action, approvedBy, rejectionReason, marketId } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
      }

      if (action === 'approve' && !approvedBy) {
        return res.status(400).json({ error: 'approvedBy is required for approval' });
      }

      if (action === 'reject' && !rejectionReason) {
        return res.status(400).json({ error: 'rejectionReason is required for rejection' });
      }

      const updateData = {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        updatedAt: new Date()
      };

      if (action === 'approve') {
        updateData.approvedBy = approvedBy.toLowerCase();
        if (marketId) {
          updateData.marketId = BigInt(marketId);
        }
      } else {
        updateData.rejectionReason = rejectionReason;
      }

      const updatedMarket = await prisma.pendingMarket.update({
        where: { id: BigInt(id) },
        data: updateData
      });

      // Serialize BigInt values and parse rules
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

    if (req.method === 'DELETE') {
      // Delete a pending market (only if pending or rejected)
      const pendingMarket = await prisma.pendingMarket.findUnique({
        where: { id: BigInt(id) }
      });

      if (!pendingMarket) {
        return res.status(404).json({ error: 'Pending market not found' });
      }

      if (pendingMarket.status === 'APPROVED') {
        return res.status(400).json({ error: 'Cannot delete approved markets' });
      }

      await prisma.pendingMarket.delete({
        where: { id: BigInt(id) }
      });

      return res.status(200).json({
        success: true,
        message: 'Pending market deleted'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in pending-markets/[id] API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

