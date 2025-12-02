const prisma = require('../../lib/prismaClient');

function serializeBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeBigInt(v);
    }
    return out;
  }
  return obj;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(
      parseInt(req.query.limit || '50', 10) || 50,
      200,
    );

    const events = await prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        market: true,
      },
    });

    const mapped = events.map((ev) => {
      const isBuyLike =
        ev.eventType === 'ORDER_PLACED' ||
        ev.eventType === 'ORDER_FILLED' ||
        ev.eventType === 'POSITION_UPDATED';

      const meta = ev.metadata || {};

      const side = meta.side || (isBuyLike ? 'Yes' : 'No');
      const action = meta.action || (isBuyLike ? 'bought' : 'sold');

      const priceCents =
        typeof meta.priceCents === 'number'
          ? meta.priceCents
          : meta.priceBps
          ? Math.round(meta.priceBps / 100)
          : null;

      const notionalUsd =
        typeof meta.notionalUsd === 'number'
          ? meta.notionalUsd
          : null;

      const avatarGradient =
        meta.avatarGradient ||
        (ev.market?.category === 'crypto'
          ? 'from-[#FF9900] to-[#FF5E00]'
          : 'from-[#3B82F6] to-[#06B6D4]');

      const timestampLabel = meta.timestampLabel || 'now';

      return {
        id: Number(ev.id),
        marketTitle:
          ev.market?.question || meta.marketTitle || `Market #${ev.marketId}`,
        avatarGradient,
        user: (ev.userAddress || '').slice(0, 8) || 'Unknown',
        action,
        side,
        sideColor:
          side === 'Yes' || side === 'Up'
            ? '#FFE600'
            : '#E13737',
        priceCents: priceCents ?? 50,
        notionalUsd: notionalUsd ?? 1,
        timestampLabel,
        txUrl: meta.txUrl || (ev.txHash ? `https://basescan.org/tx/${ev.txHash}` : '#'),
      };
    });

    return res.status(200).json({
      success: true,
      activity: serializeBigInt(mapped),
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}


