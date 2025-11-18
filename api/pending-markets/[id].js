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

  if (!id) {
    return res.status(400).json({ error: 'Market ID is required' });
  }

  try {
    if (req.method === 'GET') {
      // Get specific pending market
      const pendingMarket = await prisma.pendingMarket.findUnique({
        where: { id: BigInt(id) }
      });

      if (!pendingMarket) {
        return res.status(404).json({ error: 'Pending market not found' });
      }

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
      // Update pending market status (approve/reject)
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
        where: { id: BigInt(id) },
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

    if (req.method === 'DELETE') {
      // Delete pending market
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
