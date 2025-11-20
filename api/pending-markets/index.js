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
  // Handle OPTIONS preflight FIRST - before any other logic
  // This is critical for CORS to work from localhost
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(200).end();
  }

  // Set CORS headers for all other requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Check if URL contains an ID (e.g., /api/pending-markets/30)
  // Extract ID from URL path - works for both Vercel and Express
  // On Vercel, req.url might be just "/29" or "/api/pending-markets/29" or "/pending-markets/29"
  let id = req.query?.id;
  
  // Try multiple patterns to extract ID
  if (!id && req.url) {
    // Try full path pattern: /api/pending-markets/29
    let match = req.url.match(/\/pending-markets\/(\d+)/);
    if (match) {
      id = match[1];
    } else {
      // Try just the number at the end: /29
      match = req.url.match(/\/(\d+)(?:\?|$)/);
      if (match) {
        id = match[1];
      }
    }
  }
  
  // Also check if Vercel puts it in a different query param
  if (!id && req.query) {
    // Check all query params for a numeric ID
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'id' || /^\d+$/.test(String(value))) {
        const numValue = String(value);
        if (/^\d+$/.test(numValue)) {
          id = numValue;
          break;
        }
      }
    }
  }

  console.log(`[pending-markets/index] ${req.method} request - URL: ${req.url}, ID: ${id}, Query:`, req.query, 'Headers:', req.headers);

  // If there's an ID in the URL OR if method is PATCH/DELETE (likely has ID), handle single market operations
  // This handles cases where Vercel routes /api/pending-markets/30 to index.js
  if (id || (req.method === 'PATCH' || req.method === 'DELETE')) {
    // If we don't have ID yet but method suggests we should, try harder to extract it
    if (!id && req.url) {
      // Try full path: /api/pending-markets/29
      let match = req.url.match(/\/pending-markets\/(\d+)/);
      if (match) {
        id = match[1];
      } else {
        // Try just the number at the end: /29
        match = req.url.match(/\/(\d+)(?:\?|$)/);
        if (match) {
          id = match[1];
        }
      }
      if (id) {
        console.log(`[pending-markets/index] Extracted ID ${id} from ${req.method} request`);
      }
    }
    
    // Only proceed if we have an ID and the method matches
    if (id && (req.method === 'GET' || req.method === 'PATCH' || req.method === 'DELETE')) {
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
        console.log(`[pending-markets/index] PATCH request for id: ${id}, body:`, req.body);
        
        // Update pending market status (approve/reject)
        const { status, deployedMarketId, rejectionReason } = req.body;

        if (!status) {
          console.error('[pending-markets/index] Missing status in PATCH body');
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

        console.log(`[pending-markets/index] Updating market ${id} with:`, updateData);

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

        console.log(`[pending-markets/index] Successfully updated market ${id}`);

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
      
      // If we got here, method didn't match - shouldn't happen, but return 405
      return res.status(405).json({ 
        error: 'Method not allowed for this operation',
        message: `Method ${req.method} with ID requires GET, PATCH, or DELETE`
      });
    } catch (error) {
      console.error(`[pending-markets/index] Error handling ${req.method} for id ${id}:`, error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
    } // Close inner if (id && (req.method === 'GET' || ...))
    
    // If we reached here, we have PATCH/DELETE but couldn't extract ID
    if (!id && (req.method === 'PATCH' || req.method === 'DELETE')) {
      console.error(`[pending-markets/index] ${req.method} request but no ID found in URL: ${req.url}`);
      return res.status(400).json({ error: 'Market ID is required for this operation' });
    }
    // If ID exists but method doesn't match (e.g., POST with ID), continue to collection handlers below
  } // Close outer if (id || (req.method === 'PATCH' || req.method === 'DELETE'))

  // No ID in URL (or POST/GET without ID) - handle collection operations (GET list, POST create)
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

    // Only GET and POST are allowed without an ID
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `Method ${req.method} requires an ID in the URL path (e.g., /api/pending-markets/30)`
    });
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

