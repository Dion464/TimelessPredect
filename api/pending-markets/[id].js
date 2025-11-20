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
  // Log all incoming requests for debugging
  console.log(`[pending-markets/[id]] Received ${req.method} request`);
  console.log(`[pending-markets/[id]] URL: ${req.url || 'no url'}`);
  console.log(`[pending-markets/[id]] Query:`, req.query);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // On Vercel, dynamic route params come from req.query
  // The route /api/pending-markets/30 should have req.query.id = '30'
  // But sometimes we need to extract from URL path as fallback
  let { id } = req.query;
  
  // Fallback: extract ID from URL path if not in query
  if (!id && req.url) {
    const match = req.url.match(/\/pending-markets\/(\d+)/);
    if (match) {
      id = match[1];
      console.log(`[pending-markets/[id]] Extracted id from URL: ${id}`);
    }
  }

  console.log(`[pending-markets/[id]] ${req.method} request for id: ${id}`);

  if (!id) {
    console.error('[pending-markets/[id]] Missing id parameter');
    console.error('[pending-markets/[id]] req.query:', req.query);
    console.error('[pending-markets/[id]] req.url:', req.url);
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
      console.log('[pending-markets/[id]] PATCH request body:', JSON.stringify(req.body));
      const { status, deployedMarketId, rejectionReason } = req.body;

      if (!status) {
        console.error('[pending-markets/[id]] Missing status in request body');
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

    // Log unexpected methods
    console.error(`[pending-markets/[id]] Unsupported method: ${req.method} for id: ${id}`);
    return res.status(405).json({ 
      error: 'Method not allowed',
      receivedMethod: req.method,
      supportedMethods: ['GET', 'PATCH', 'DELETE', 'OPTIONS']
    });
  } catch (error) {
    console.error('Error in pending-markets/[id] API:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};
