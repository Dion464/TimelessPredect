const {
  createOrderAndMatch,
  getOrderBook,
  getUserOrders,
} = require('../orderBookService');

const allowedMethods = ['GET', 'POST'];

module.exports = async function handler(req, res) {
  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'POST') {
      return await handlePostOrder(req, res);
    }

    return await handleGetOrders(req, res);
  } catch (error) {
    console.error('Order API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

async function handlePostOrder(req, res) {
  const { order, signature, isMarketOrder = false } = req.body || {};

  if (!order || !signature) {
    return res.status(400).json({ error: 'Order and signature are required' });
  }

  const result = await createOrderAndMatch({
    order,
    signature,
    isMarketOrder,
  });

  return res.status(200).json(result);
}
async function handleGetOrders(req, res) {
  // Use req.query which is set by the consolidated handler
  const marketId = req.query?.marketId;
  const outcomeId = req.query?.outcomeId;
  const depth = req.query?.depth;
  const userAddress = req.query?.user;

  if (marketId && outcomeId) {
    const data = await getOrderBook({
      marketId,
      outcomeId,
      depth: depth ? parseInt(depth, 10) : 10,
    });
    return res.status(200).json(data);
  }

  if (userAddress) {
    const orders = await getUserOrders({
      userAddress,
      marketId,
    });
    return res.status(200).json({ orders });
  }

  return res.status(400).json({ error: 'Must provide marketId+outcomeId or user address' });
}

