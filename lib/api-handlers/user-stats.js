const { ethers } = require('ethers');
const prisma = require('../prismaClient');

/**
 * GET /api/user-stats/:address - Get user profile statistics
 */
module.exports = async function handleUserStats(req, res) {
  try {
    // Extract address from params (set by consolidated handler) or URL pathname
    let address = req.params?.address;
    
    if (!address && req.url) {
      // Fallback: try to extract from URL
      const pathParts = req.url.split('/').filter(Boolean);
      address = pathParts[pathParts.length - 1]?.split('?')[0];
    }

    console.log('📊 User stats request:', { address, params: req.params, url: req.url });

    if (!address || !ethers.utils.isAddress(address)) {
      console.error('❌ Invalid address:', address);
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const normalizedAddress = ethers.utils.getAddress(address);

    // Fetch user trades
    const trades = await prisma.trade.findMany({
      where: { trader: normalizedAddress },
      orderBy: { blockTime: 'desc' },
      take: 100, // Limit to recent 100 trades
    });

    // Fetch user positions
    const positions = await prisma.position.findMany({
      where: { userAddress: normalizedAddress }
    });

    // Calculate statistics
    let totalVolume = 0n;
    let totalInvested = 0n;
    let totalTrades = trades.length;
    let winCount = 0;
    let lossCount = 0;
    let totalWinnings = 0n;
    let activePositions = 0;

    // Process trades for volume
    for (const trade of trades) {
      const costWei = BigInt(trade.costWei || '0');
      totalVolume += costWei;
    }

    // Process positions
    const positionsWithMarkets = [];
    for (const position of positions) {
      const yesShares = BigInt(position.yesSharesWei || '0');
      const noShares = BigInt(position.noSharesWei || '0');
      const invested = BigInt(position.totalInvestedWei || '0');
      
      totalInvested += invested;
      
      if (yesShares > 0n || noShares > 0n) {
        activePositions++;
      }

      // Fetch market data
      try {
        const market = await prisma.market.findUnique({
          where: { marketId: position.marketId }
        });

        if (market) {
          // Calculate potential winnings if market is resolved
          let potentialWinnings = 0n;
          let isWinner = false;
          
          if (market.resolved && market.outcome !== null) {
            // Market resolved - calculate actual winnings
            if (market.outcome === 1 && yesShares > 0n) {
              // YES won
              const totalYesShares = BigInt(market.totalYesSharesWei || '0');
              const totalNoShares = BigInt(market.totalNoSharesWei || '0');
              const totalPool = totalYesShares + totalNoShares;
              
              if (totalYesShares > 0n) {
                potentialWinnings = (yesShares * totalPool) / totalYesShares;
                isWinner = true;
                winCount++;
              }
            } else if (market.outcome === 2 && noShares > 0n) {
              // NO won
              const totalYesShares = BigInt(market.totalYesSharesWei || '0');
              const totalNoShares = BigInt(market.totalNoSharesWei || '0');
              const totalPool = totalYesShares + totalNoShares;
              
              if (totalNoShares > 0n) {
                potentialWinnings = (noShares * totalPool) / totalNoShares;
                isWinner = true;
                winCount++;
              }
            } else {
              lossCount++;
            }
            
            if (isWinner) {
              totalWinnings += potentialWinnings;
            }
          } else {
            // Market not resolved - calculate potential value based on current prices
            const yesPriceBps = market.lastYesPriceBps || 5000; // Default 50%
            const noPriceBps = market.lastNoPriceBps || 5000;
            
            const yesPrice = BigInt(yesPriceBps);
            const noPrice = BigInt(noPriceBps);
            
            // Potential value = shares * current price
            const yesValue = (yesShares * yesPrice) / 10000n;
            const noValue = (noShares * noPrice) / 10000n;
            potentialWinnings = yesValue + noValue;
          }

          positionsWithMarkets.push({
            ...position,
            market: {
              marketId: market.marketId.toString(),
              question: market.question,
              description: market.description,
              category: market.category,
              resolved: market.resolved,
              outcome: market.outcome,
              endTime: market.endTime,
              resolutionTime: market.resolutionTime,
              yesPriceBps: market.lastYesPriceBps,
              noPriceBps: market.lastNoPriceBps
            },
            yesShares: ethers.utils.formatEther(position.yesSharesWei),
            noShares: ethers.utils.formatEther(position.noSharesWei),
            totalInvested: ethers.utils.formatEther(position.totalInvestedWei),
            potentialWinnings: ethers.utils.formatEther(potentialWinnings.toString())
          });
        }
      } catch (err) {
        console.error(`Error fetching market ${position.marketId}:`, err);
      }
    }

    // Fetch market data for trades
    const tradesWithMarkets = await Promise.all(
      trades.map(async (trade) => {
        try {
          const market = await prisma.market.findUnique({
            where: { marketId: trade.marketId }
          });
          
          return {
            ...trade,
            market: market ? {
              marketId: market.marketId.toString(),
              question: market.question,
              category: market.category
            } : null,
            shares: ethers.utils.formatEther(trade.sharesWei),
            cost: ethers.utils.formatEther(trade.costWei),
            price: (trade.priceBps / 100).toFixed(2),
            blockTime: trade.blockTime.toISOString()
          };
        } catch (err) {
          console.error(`Error fetching market for trade ${trade.id}:`, err);
          return {
            ...trade,
            market: null,
            shares: ethers.utils.formatEther(trade.sharesWei),
            cost: ethers.utils.formatEther(trade.costWei),
            price: (trade.priceBps / 100).toFixed(2),
            blockTime: trade.blockTime.toISOString()
          };
        }
      })
    );

    // Calculate win rate
    const totalResolved = winCount + lossCount;
    const winRate = totalResolved > 0 ? (winCount / totalResolved) * 100 : 0;

    return res.status(200).json({
      address: normalizedAddress,
      stats: {
        totalVolume: ethers.utils.formatEther(totalVolume.toString()),
        totalInvested: ethers.utils.formatEther(totalInvested.toString()),
        totalTrades,
        winCount,
        lossCount,
        winRate: winRate.toFixed(2),
        totalWinnings: ethers.utils.formatEther(totalWinnings.toString()),
        activePositions,
        totalMarkets: positions.length
      },
      trades: tradesWithMarkets,
      positions: positionsWithMarkets
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: error.message });
  }
};
