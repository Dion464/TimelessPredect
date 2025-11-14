const { cancelOrder } = require('../../../lib/orderBookService.js');

const allowedMethods = ['DELETE'];

module.exports = async function handler(req, res) {
  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required' });
  }

  try {
    const { userAddress } = req.body || {};
    const order = await cancelOrder({ orderId, userAddress });
    return res.status(200).json({ order });
  } catch (error) {
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Not authorized to cancel this order') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Order already filled') {
      return res.status(400).json({ error: error.message });
    }

    console.error('Cancel order error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

