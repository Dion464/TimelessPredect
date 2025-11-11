export const config = { runtime: 'nodejs' };

import 'dotenv/config';
import prisma from '../lib/prismaClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST required' });
    return;
  }

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    res.status(500).json({ error: 'DATABASE_URL or POSTGRES_URL not set' });
    return;
  }

  try {
    const { marketId, yesPriceBps, noPriceBps } = req.body;

    if (!marketId || yesPriceBps === undefined || noPriceBps === undefined) {
      res.status(400).json({ error: 'marketId, yesPriceBps, and noPriceBps are required' });
      return;
    }

    const marketIdBigInt = BigInt(marketId);
    let yesPriceBpsInt = Math.round(Number(yesPriceBps));
    let noPriceBpsInt = Math.round(Number(noPriceBps));

    // Validate prices - ensure they're reasonable (between 10 bps = 0.1% and 9990 bps = 99.9%)
    // Prices outside this range are likely errors and should not be stored
    if (yesPriceBpsInt < 10 || yesPriceBpsInt > 9990 || noPriceBpsInt < 10 || noPriceBpsInt > 9990) {
      console.warn('⚠️  Invalid prices detected, rejecting price snapshot:', {
        marketId: marketId,
        yesPriceBps: yesPriceBpsInt,
        noPriceBps: noPriceBpsInt,
        yesPricePercent: (yesPriceBpsInt / 100).toFixed(2),
        noPricePercent: (noPriceBpsInt / 100).toFixed(2)
      });
      return res.status(400).json({ 
        error: 'Invalid prices - prices must be between 0.1% and 99.9%',
        yesPriceBps: yesPriceBpsInt,
        noPriceBps: noPriceBpsInt
      });
    }

    // Ensure YES + NO = 10000 (within rounding tolerance)
    const total = yesPriceBpsInt + noPriceBpsInt;
    if (Math.abs(total - 10000) > 100) { // Allow 1% tolerance for rounding
      console.warn('⚠️  Price sum mismatch, normalizing:', {
        yesPriceBps: yesPriceBpsInt,
        noPriceBps: noPriceBpsInt,
        total: total
      });
      // Normalize to ensure they sum to 10000
      const scale = 10000 / total;
      yesPriceBpsInt = Math.round(yesPriceBpsInt * scale);
      noPriceBpsInt = 10000 - yesPriceBpsInt;
    }

    console.log('📊 Recording price snapshot:', {
      marketId: marketId,
      yesPriceBps: yesPriceBpsInt,
      noPriceBps: noPriceBpsInt,
      yesPriceCents: (yesPriceBpsInt / 100).toFixed(2),
      noPriceCents: (noPriceBpsInt / 100).toFixed(2)
    });

    // Ensure Market record exists (required for foreign key constraint)
    try {
      const existingMarket = await prisma.market.findUnique({
        where: { marketId: marketIdBigInt }
      });

      if (!existingMarket) {
        console.log(`📝 Creating Market record for marketId ${marketId} (required for price snapshot)`);
        await prisma.market.create({
          data: {
            marketId: marketIdBigInt,
            question: `Market ${marketId}`,
            description: null,
            category: null,
            resolved: false,
            totalYesSharesWei: '0',
            totalNoSharesWei: '0',
            totalVolumeWei: '0',
            createdAt: new Date()
          }
        });
        console.log(`✅ Market record created for marketId ${marketId}`);
      }
    } catch (marketError) {
      // If market creation fails, check if it's because it already exists (race condition)
      if (marketError.code !== 'P2002') {
        console.error('⚠️  Failed to ensure Market record exists:', marketError);
        // Continue anyway - might already exist from concurrent request
      }
    }

    // Use millisecond-precision timestamp to ensure each price snapshot is unique
    // This allows every trade to create a distinct price point on the chart
    const now = new Date();
    // Add a small offset (microseconds simulated via Date manipulation) to ensure uniqueness
    // If a record already exists for this exact millisecond, add 1ms to make it unique
    let intervalStart = new Date(now);
    
    // Try to create with current timestamp, but handle conflicts by incrementing
    const snapshot = await (async () => {
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loops
      
      while (attempts < maxAttempts) {
        try {
          return await prisma.priceSnapshot.create({
            data: {
              marketId: marketIdBigInt,
              intervalStart: intervalStart,
              yesPriceBps: yesPriceBpsInt,
              noPriceBps: noPriceBpsInt,
              tradeCount: 0,
              totalVolumeWei: '0'
            }
          });
        } catch (err) {
          if (err.code === 'P2002') { // Unique constraint violation
            attempts++;
            // Increment by 1ms to create a unique timestamp
            intervalStart = new Date(intervalStart.getTime() + 1);
            continue;
          }
          throw err;
        }
      }
      
      // If all attempts failed, update the existing record
      return await prisma.priceSnapshot.update({
        where: {
          marketId_intervalStart: {
            marketId: marketIdBigInt,
            intervalStart: intervalStart
          }
        },
        data: {
          yesPriceBps: yesPriceBpsInt,
          noPriceBps: noPriceBpsInt,
          updatedAt: now
        }
      });
    })();

    console.log('✅ Price snapshot saved to DB:', {
      marketId: snapshot.marketId.toString(),
      intervalStart: snapshot.intervalStart.toISOString(),
      yesPriceBps: snapshot.yesPriceBps,
      noPriceBps: snapshot.noPriceBps
    });

    res.status(200).json({ 
      success: true,
      snapshot: {
        marketId: snapshot.marketId.toString(),
        intervalStart: snapshot.intervalStart.toISOString(),
        yesPriceBps: snapshot.yesPriceBps,
        noPriceBps: snapshot.noPriceBps,
        yesPriceCents: (snapshot.yesPriceBps / 100).toFixed(2),
        noPriceCents: (snapshot.noPriceBps / 100).toFixed(2)
      }
    });
  } catch (err) {
    console.error('Error recording price snapshot:', err);
    res.status(500).json({ error: err.message });
  }
}

