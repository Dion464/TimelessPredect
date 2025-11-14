const {
  createOrderAndMatch,
  getOrderBook,
  getUserOrders,
} = require('../../lib/orderBookService.js');

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
  const baseUrl = `http://${req.headers.host || 'localhost'}`;
  const url = new URL(req.url, baseUrl);

  const marketId = url.searchParams.get('marketId');
  const outcomeId = url.searchParams.get('outcomeId');
  const depth = url.searchParams.get('depth');
  const userAddress = url.searchParams.get('user');

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

