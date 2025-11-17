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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get notifications for a recipient
      const { recipient } = req.query;

      if (!recipient) {
        return res.status(400).json({ error: 'recipient address is required' });
      }

      const notifications = await prisma.notification.findMany({
        where: {
          recipient: recipient.toLowerCase()
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50 // Limit to last 50 notifications
      });

      return res.status(200).json({
        success: true,
        notifications: serializeBigInt(notifications)
      });
    }

    if (req.method === 'PATCH') {
      // Mark notifications as read
      const { recipient, notificationIds } = req.body;

      if (!recipient) {
        return res.status(400).json({ error: 'recipient address is required' });
      }

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ error: 'notificationIds array is required' });
      }

      await prisma.notification.updateMany({
        where: {
          recipient: recipient.toLowerCase(),
          id: {
            in: notificationIds.map(id => BigInt(id))
          }
        },
        data: {
          read: true,
          updatedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Notifications marked as read'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in notifications API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

