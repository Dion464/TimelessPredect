import { useState, useEffect, useCallback } from 'react';
import { calculateAMMPrice, calculateTradingFee, calculateLPRewards } from '../utils/feeCalculator';

/**
 * Automated Market Maker Hook
 * Implements constant product market maker (x * y = k) with fees and liquidity rewards
 */
const useAMM = (marketId) => {
  const [liquidityPools, setLiquidityPools] = useState({});
  const [userPositions, setUserPositions] = useState({});
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize liquidity pool for a market
  const initializeLiquidityPool = useCallback((marketId, initialLiquidity = 10000) => {
    setLiquidityPools(prev => ({
      ...prev,
      [marketId]: {
        yesShares: initialLiquidity,
        noShares: initialLiquidity,
        totalLiquidity: initialLiquidity * 2,
        k: initialLiquidity * initialLiquidity, // Constant product
        lpTokens: initialLiquidity * 2,
        providers: {},
        totalFees: 0,
        volume24h: 0,
        trades: [],
        createdAt: Date.now()
      }
    }));
  }, []);

  // Add liquidity to a market
  const addLiquidity = useCallback(async (marketId, yesAmount, noAmount, userAddress) => {
    setLoading(true);
    setError(null);

    try {
      const pool = liquidityPools[marketId];
      if (!pool) {
        throw new Error('Pool not found');
      }

      // Calculate LP tokens to mint
      const totalSupply = pool.lpTokens;
      const yesReserve = pool.yesShares;
      const noReserve = pool.noShares;

      let lpTokensToMint;
      if (totalSupply === 0) {
        lpTokensToMint = Math.sqrt(yesAmount * noAmount);
      } else {
        const yesRatio = yesAmount / yesReserve;
        const noRatio = noAmount / noReserve;
        const ratio = Math.min(yesRatio, noRatio);
        lpTokensToMint = totalSupply * ratio;
      }

      // Update pool
      const newPool = {
        ...pool,
        yesShares: pool.yesShares + yesAmount,
        noShares: pool.noShares + noAmount,
        totalLiquidity: pool.totalLiquidity + yesAmount + noAmount,
        k: (pool.yesShares + yesAmount) * (pool.noShares + noAmount),
        lpTokens: pool.lpTokens + lpTokensToMint,
        providers: {
          ...pool.providers,
          [userAddress]: {
            lpTokens: (pool.providers[userAddress]?.lpTokens || 0) + lpTokensToMint,
            yesProvided: (pool.providers[userAddress]?.yesProvided || 0) + yesAmount,
            noProvided: (pool.providers[userAddress]?.noProvided || 0) + noAmount,
            providedAt: Date.now(),
            totalRewards: pool.providers[userAddress]?.totalRewards || 0
          }
        }
      };

      setLiquidityPools(prev => ({
        ...prev,
        [marketId]: newPool
      }));

      // Update user positions
      setUserPositions(prev => ({
        ...prev,
        [userAddress]: {
          ...prev[userAddress],
          [marketId]: {
            lpTokens: (prev[userAddress]?.[marketId]?.lpTokens || 0) + lpTokensToMint,
            yesShares: (prev[userAddress]?.[marketId]?.yesShares || 0),
            noShares: (prev[userAddress]?.[marketId]?.noShares || 0)
          }
        }
      }));

      return {
        success: true,
        lpTokensReceived: lpTokensToMint,
        newPoolState: newPool
      };

    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [liquidityPools]);

  // Remove liquidity from a market
  const removeLiquidity = useCallback(async (marketId, lpTokensToRemove, userAddress) => {
    setLoading(true);
    setError(null);

    try {
      const pool = liquidityPools[marketId];
      const userProvider = pool?.providers[userAddress];

      if (!pool || !userProvider) {
        throw new Error('Pool or user position not found');
      }

      if (userProvider.lpTokens < lpTokensToRemove) {
        throw new Error('Insufficient LP tokens');
      }

      // Calculate share of pool to remove
      const shareToRemove = lpTokensToRemove / pool.lpTokens;
      const yesToRemove = pool.yesShares * shareToRemove;
      const noToRemove = pool.noShares * shareToRemove;

      // Calculate rewards earned
      const timeProvided = (Date.now() - userProvider.providedAt) / 1000;
      const userLiquidity = (userProvider.yesProvided + userProvider.noProvided);
      const rewardInfo = calculateLPRewards(
        pool.totalFees,
        userLiquidity,
        pool.totalLiquidity,
        timeProvided
      );

      // Update pool
      const newPool = {
        ...pool,
        yesShares: pool.yesShares - yesToRemove,
        noShares: pool.noShares - noToRemove,
        totalLiquidity: pool.totalLiquidity - yesToRemove - noToRemove,
        k: (pool.yesShares - yesToRemove) * (pool.noShares - noToRemove),
        lpTokens: pool.lpTokens - lpTokensToRemove,
        providers: {
          ...pool.providers,
          [userAddress]: {
            ...userProvider,
            lpTokens: userProvider.lpTokens - lpTokensToRemove,
            totalRewards: userProvider.totalRewards + rewardInfo.timeWeightedReward
          }
        }
      };

      setLiquidityPools(prev => ({
        ...prev,
        [marketId]: newPool
      }));

      return {
        success: true,
        yesReceived: yesToRemove,
        noReceived: noToRemove,
        rewardsEarned: rewardInfo.timeWeightedReward,
        newPoolState: newPool
      };

    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [liquidityPools]);

  // Execute a trade through the AMM
  const executeTrade = useCallback(async (marketId, side, amount, userAddress, userVolume = 0) => {
    setLoading(true);
    setError(null);

    try {
      const pool = liquidityPools[marketId];
      if (!pool) {
        throw new Error('Pool not found');
      }

      // Calculate AMM price and impact
      const priceInfo = calculateAMMPrice(
        pool.yesShares,
        pool.noShares,
        amount,
        side
      );

      // Calculate trading fees
      const feeInfo = calculateTradingFee(
        amount,
        priceInfo.price,
        side,
        userVolume,
        false // Assume taker for AMM trades
      );

      const totalCost = feeInfo.tradeValue + feeInfo.feeAmount;
      const sharesReceived = amount / priceInfo.price;

      // Update pool state
      const newPool = {
        ...pool,
        yesShares: priceInfo.newYesShares,
        noShares: priceInfo.newNoShares,
        k: priceInfo.newYesShares * priceInfo.newNoShares,
        totalFees: pool.totalFees + feeInfo.feeAmount,
        volume24h: pool.volume24h + feeInfo.tradeValue,
        trades: [
          ...pool.trades.slice(-99), // Keep last 100 trades
          {
            id: Date.now(),
            user: userAddress,
            side: side,
            amount: amount,
            price: priceInfo.price,
            fee: feeInfo.feeAmount,
            timestamp: Date.now(),
            sharesReceived: sharesReceived
          }
        ]
      };

      setLiquidityPools(prev => ({
        ...prev,
        [marketId]: newPool
      }));

      // Update user positions
      setUserPositions(prev => ({
        ...prev,
        [userAddress]: {
          ...prev[userAddress],
          [marketId]: {
            ...prev[userAddress]?.[marketId],
            yesShares: (prev[userAddress]?.[marketId]?.yesShares || 0) + 
                      (side === 'YES' ? sharesReceived : 0),
            noShares: (prev[userAddress]?.[marketId]?.noShares || 0) + 
                     (side === 'NO' ? sharesReceived : 0)
          }
        }
      }));

      // Update global stats
      setTotalVolume(prev => prev + feeInfo.tradeValue);
      setTotalFees(prev => prev + feeInfo.feeAmount);

      return {
        success: true,
        sharesReceived: sharesReceived,
        totalCost: totalCost,
        feeInfo: feeInfo,
        priceInfo: priceInfo,
        newPoolState: newPool
      };

    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [liquidityPools]);

  // Get current market price from AMM
  const getCurrentPrice = useCallback((marketId, side = 'YES') => {
    const pool = liquidityPools[marketId];
    if (!pool) return null;

    // Calculate price for small trade to get current market price
    const smallTradeAmount = 1;
    const priceInfo = calculateAMMPrice(
      pool.yesShares,
      pool.noShares,
      smallTradeAmount,
      side
    );

    return {
      yesPrice: side === 'YES' ? priceInfo.price : 1 - priceInfo.price,
      noPrice: side === 'NO' ? priceInfo.price : 1 - priceInfo.price,
      spread: Math.abs(priceInfo.price - 0.5) * 2,
      liquidity: pool.totalLiquidity,
      volume24h: pool.volume24h
    };
  }, [liquidityPools]);

  // Get user's liquidity provider stats
  const getUserLPStats = useCallback((userAddress, marketId) => {
    const pool = liquidityPools[marketId];
    const userProvider = pool?.providers[userAddress];

    if (!pool || !userProvider) {
      return null;
    }

    const timeProvided = (Date.now() - userProvider.providedAt) / 1000;
    const userLiquidity = userProvider.yesProvided + userProvider.noProvided;
    const shareOfPool = userLiquidity / pool.totalLiquidity;

    const rewardInfo = calculateLPRewards(
      pool.totalFees,
      userLiquidity,
      pool.totalLiquidity,
      timeProvided
    );

    return {
      lpTokens: userProvider.lpTokens,
      shareOfPool: shareOfPool,
      liquidityProvided: userLiquidity,
      timeProvided: timeProvided,
      estimatedRewards: rewardInfo.timeWeightedReward,
      totalRewards: userProvider.totalRewards,
      apr: calculateAPR(rewardInfo.timeWeightedReward, userLiquidity, timeProvided)
    };
  }, [liquidityPools]);

  // Calculate APR for liquidity provision
  const calculateAPR = (rewards, liquidity, timeSeconds) => {
    if (timeSeconds === 0 || liquidity === 0) return 0;
    const annualRewards = rewards * (365 * 24 * 60 * 60) / timeSeconds;
    return (annualRewards / liquidity) * 100;
  };

  // Initialize pools for existing markets
  useEffect(() => {
    // This would typically fetch existing pools from backend
    // For now, we'll initialize with mock data
    if (marketId && !liquidityPools[marketId]) {
      initializeLiquidityPool(marketId);
    }
  }, [marketId, liquidityPools, initializeLiquidityPool]);

  return {
    // State
    liquidityPools,
    userPositions,
    totalVolume,
    totalFees,
    loading,
    error,

    // Actions
    addLiquidity,
    removeLiquidity,
    executeTrade,
    initializeLiquidityPool,

    // Getters
    getCurrentPrice,
    getUserLPStats,

    // Utils
    calculateAPR
  };
};

export default useAMM;

