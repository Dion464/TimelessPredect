const prisma = require('../../lib/prismaClient.js');

const allowedMethods = ['GET', 'POST'];

module.exports = async function handler(req, res) {
  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }

    return await handleGet(req, res);
  } catch (error) {
    console.error('Market images API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

async function handlePost(req, res) {
  const { marketId, imageUrl, question, description, category } = req.body || {};

  if (!marketId || !imageUrl) {
    return res.status(400).json({ error: 'marketId and imageUrl are required' });
  }

  const normalizedMarketId = BigInt(marketId);

  const market = await prisma.market.upsert({
    where: { marketId: normalizedMarketId },
    update: {
      imageUrl,
      question: question ?? undefined,
      description: description ?? undefined,
      category: category ?? undefined,
    },
    create: {
      marketId: normalizedMarketId,
      imageUrl,
      question: question ?? null,
      description: description ?? null,
      category: category ?? null,
    },
  });

  return res.status(200).json({
    marketId: market.marketId.toString(),
    imageUrl: market.imageUrl,
  });
}

async function handleGet(req, res) {
  const baseUrl = `http://${req.headers.host || 'localhost'}`;
  const url = new URL(req.url, baseUrl);

  const marketId = url.searchParams.get('marketId');

  if (marketId) {
    const record = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      select: {
        marketId: true,
        imageUrl: true,
        question: true,
        description: true,
        category: true,
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Market image not found' });
    }

    return res.status(200).json({
      marketId: record.marketId.toString(),
      imageUrl: record.imageUrl,
      question: record.question,
      description: record.description,
      category: record.category,
    });
  }

  const records = await prisma.market.findMany({
    where: {
      imageUrl: {
        not: null,
      },
    },
    select: {
      marketId: true,
      imageUrl: true,
      question: true,
      description: true,
      category: true,
    },
  });

  const payload = records.map((record) => ({
    marketId: record.marketId.toString(),
    imageUrl: record.imageUrl,
    question: record.question,
    description: record.description,
    category: record.category,
  }));

  return res.status(200).json({ images: payload });
}

