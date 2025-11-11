export const config = { runtime: 'nodejs' };

import 'dotenv/config';
import prisma from '../lib/prismaClient.js';

const TIMEFRAMES = {
  '1h': 1,
  '6h': 6,
  '1d': 24,
  '1w': 24 * 7,
  '1m': 24 * 30,
  'all': 365 * 24 // Show all data (1 year)
};

const serializeSnapshot = (row) => ({
  intervalStart: row.intervalStart.toISOString(),
  yesPriceBps: row.yesPriceBps,
  noPriceBps: row.noPriceBps,
  yesPrice: row.yesPriceBps / 10000,
  noPrice: row.noPriceBps / 10000,
  tradeCount: row.tradeCount,
  totalVolumeWei: row.totalVolumeWei
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET required' });
    return;
  }

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    res.status(500).json({ error: 'DATABASE_URL or POSTGRES_URL not set' });
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const marketIdParam = url.searchParams.get('marketId');
    if (!marketIdParam) {
      res.status(400).json({ error: 'marketId required' });
      return;
    }

    let marketId;
    try {
      marketId = BigInt(marketIdParam);
    } catch (err) {
      res.status(400).json({ error: 'Invalid marketId' });
      return;
    }

    const timeframeParam = (url.searchParams.get('timeframe') || '24h').toLowerCase();
    const hours = TIMEFRAMES[timeframeParam] ?? TIMEFRAMES['24h'];
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshots = await prisma.priceSnapshot.findMany({
      where: {
        marketId,
        intervalStart: {
          gte: fromDate
        }
      },
      orderBy: { intervalStart: 'asc' }
    });

    res.status(200).json({
      marketId: marketId.toString(),
      timeframe: timeframeParam,
      intervals: snapshots.map(serializeSnapshot)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
