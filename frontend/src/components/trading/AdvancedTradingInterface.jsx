import React, { useState, useEffect } from 'react';
import useWallet from '../../hooks/useWallet';
import useAMM from '../../hooks/useAMM';
import { calculateTradingFee, calculateAMMPrice, getVolumeRebate } from '../../utils/feeCalculator';

const AdvancedTradingInterface = ({ marketId, market }) => {
  const [activeTab, setActiveTab] = useState('trade');
  const [tradeType, setTradeType] = useState('market'); // market, limit
  const [selectedSide, setSelectedSide] = useState('yes');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [lpAmount, setLpAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);

  const { 
    account, 
    balance, 
    isConnected, 
    connectWallet 
  } = useWallet();

  const {
    liquidityPools,
    userPositions,
    addLiquidity,
    removeLiquidity,
    executeTrade,
    getCurrentPrice,
    getUserLPStats,
    loading: ammLoading,
    error: ammError
  } = useAMM(marketId);

  // Mock user volume for fee calculation
  const [userVolume, setUserVolume] = useState(25000); // $25k volume for demo

  const pool = liquidityPools[marketId];
  const currentPrice = getCurrentPrice(marketId, selectedSide);
  const userLPStats = getUserLPStats(account, marketId);
  const volumeRebate = getVolumeRebate(userVolume);

  // Calculate trade preview
  const getTradePreview = () => {
    if (!amount || !pool) return null;

    const tradeAmount = parseFloat(amount);
    if (isNaN(tradeAmount) || tradeAmount <= 0) return null;

    let price;
    if (tradeType === 'market') {
      const priceInfo = calculateAMMPrice(
        pool.yesShares,
        pool.noShares,
        tradeAmount,
        selectedSide.toUpperCase()
      );
      price = priceInfo.price;
    } else {
      price = parseFloat(limitPrice) || 0.5;
    }

    const feeInfo = calculateTradingFee(tradeAmount, price, selectedSide, userVolume, false);
    const sharesReceived = tradeAmount / price;

    return {
      sharesReceived,
      totalCost: feeInfo.tradeValue + feeInfo.feeAmount,
      fee: feeInfo.feeAmount,
      feeRate: feeInfo.feeRateBps / 100,
      rebate: feeInfo.rebateApplied / 100,
      price: price,
      priceImpact: tradeType === 'market' ? 
        Math.abs(price - 0.5) / 0.5 * 100 : 0
    };
  };

  const tradePreview = getTradePreview();

  // Handle trade execution
  const handleTrade = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!tradePreview) return;

    setIsTrading(true);
    try {
      const result = await executeTrade(
        marketId,
        selectedSide.toUpperCase(),
        parseFloat(amount),
        account,
        userVolume
      );

      if (result.success) {
        setAmount('');
        // Show success message
        console.log('Trade executed successfully:', result);
      } else {
        console.error('Trade failed:', result.error);
      }
    } catch (error) {
      console.error('Trade error:', error);
    } finally {
      setIsTrading(false);
    }
  };

  // Handle liquidity provision
  const handleAddLiquidity = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    const lpAmountNum = parseFloat(lpAmount);
    if (isNaN(lpAmountNum) || lpAmountNum <= 0) return;

    setIsTrading(true);
    try {
      // Add equal amounts of YES and NO liquidity
      const result = await addLiquidity(
        marketId,
        lpAmountNum / 2,
        lpAmountNum / 2,
        account
      );

      if (result.success) {
        setLpAmount('');
        console.log('Liquidity added successfully:', result);
      } else {
        console.error('Add liquidity failed:', result.error);
      }
    } catch (error) {
      console.error('Add liquidity error:', error);
    } finally {
      setIsTrading(false);
    }
  };

  const yesPrice = currentPrice?.yesPrice || market?.currentProbability || 0.5;
  const noPrice = currentPrice?.noPrice || (1 - (market?.currentProbability || 0.5));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
        {[
          { id: 'trade', label: 'Trade' },
          { id: 'liquidity', label: 'Liquidity' },
          { id: 'positions', label: 'Positions' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trading Tab */}
      {activeTab === 'trade' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trade Shares</h3>
          
          {/* Trade Type Selection */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setTradeType('market')}
              className={`py-2 px-4 rounded-lg border text-sm font-medium ${
                tradeType === 'market'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Market Order
            </button>
            <button
              onClick={() => setTradeType('limit')}
              className={`py-2 px-4 rounded-lg border text-sm font-medium ${
                tradeType === 'limit'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Limit Order
            </button>
          </div>

          {/* Side Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedSide('yes')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedSide === 'yes'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(yesPrice * 100).toFixed(1)}¢
                </div>
                <div className="text-sm text-gray-600">{market?.yesLabel || 'Yes'}</div>
              </div>
            </button>
            
            <button
              onClick={() => setSelectedSide('no')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedSide === 'no'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {(noPrice * 100).toFixed(1)}¢
                </div>
                <div className="text-sm text-gray-600">{market?.noLabel || 'No'}</div>
              </div>
            </button>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Limit Price Input */}
          {tradeType === 'limit' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limit Price (¢)
              </label>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="50"
                min="1"
                max="99"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Trade Preview */}
          {tradePreview && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Trade Preview</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Shares to receive:</span>
                  <span className="font-medium">{tradePreview.sharesReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price per share:</span>
                  <span className="font-medium">{(tradePreview.price * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between">
                  <span>Trading fee ({tradePreview.feeRate.toFixed(2)}%):</span>
                  <span className="font-medium">${tradePreview.fee.toFixed(2)}</span>
                </div>
                {volumeRebate > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Volume rebate ({tradePreview.rebate.toFixed(2)}%):</span>
                    <span className="font-medium">-${(tradePreview.fee * tradePreview.rebate / tradePreview.feeRate).toFixed(2)}</span>
                  </div>
                )}
                {tradePreview.priceImpact > 0 && (
                  <div className="flex justify-between">
                    <span>Price impact:</span>
                    <span className="font-medium">{tradePreview.priceImpact.toFixed(2)}%</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-gray-900 border-t pt-1">
                  <span>Total cost:</span>
                  <span>${tradePreview.totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* User Volume & Rebate Info */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Your 30-day volume:</span>
                <span className="font-medium">${userVolume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Current rebate:</span>
                <span className="font-medium">{(volumeRebate / 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Trade Button */}
          <button
            onClick={handleTrade}
            disabled={isTrading || !tradePreview || ammLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              selectedSide === 'yes'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isTrading ? (
              'Processing...'
            ) : !isConnected ? (
              'Connect Wallet'
            ) : (
              `Buy ${selectedSide === 'yes' ? 'Yes' : 'No'} ${amount ? `for $${amount}` : ''}`
            )}
          </button>
        </div>
      )}

      {/* Liquidity Tab */}
      {activeTab === 'liquidity' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Provide Liquidity</h3>
          
          {/* Current Pool Stats */}
          {pool && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Pool Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Total Liquidity</div>
                  <div className="font-medium">${pool.totalLiquidity.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-600">24h Volume</div>
                  <div className="font-medium">${pool.volume24h.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-600">Total Fees Earned</div>
                  <div className="font-medium">${pool.totalFees.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Current APR</div>
                  <div className="font-medium text-green-600">
                    {userLPStats ? userLPStats.apr.toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Liquidity */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Liquidity Amount ($)
            </label>
            <input
              type="number"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              Equal amounts of YES and NO shares will be provided
            </div>
          </div>

          {/* LP Preview */}
          {lpAmount && parseFloat(lpAmount) > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Liquidity Preview</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>YES shares:</span>
                  <span className="font-medium">{(parseFloat(lpAmount) / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>NO shares:</span>
                  <span className="font-medium">{(parseFloat(lpAmount) / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated LP tokens:</span>
                  <span className="font-medium">{parseFloat(lpAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* User LP Position */}
          {userLPStats && (
            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Your LP Position</h4>
              <div className="text-sm text-green-800 space-y-1">
                <div className="flex justify-between">
                  <span>LP Tokens:</span>
                  <span className="font-medium">{userLPStats.lpTokens.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Share of Pool:</span>
                  <span className="font-medium">{(userLPStats.shareOfPool * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Rewards:</span>
                  <span className="font-medium">${userLPStats.estimatedRewards.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current APR:</span>
                  <span className="font-medium">{userLPStats.apr.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleAddLiquidity}
            disabled={isTrading || !lpAmount || ammLoading}
            className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTrading ? 'Processing...' : 'Add Liquidity'}
          </button>
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Positions</h3>
          
          {userPositions[account]?.[marketId] ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Share Holdings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">YES Shares</div>
                    <div className="text-lg font-medium text-green-600">
                      {userPositions[account][marketId].yesShares?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">NO Shares</div>
                    <div className="text-lg font-medium text-red-600">
                      {userPositions[account][marketId].noShares?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              {userLPStats && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Liquidity Position</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div className="flex justify-between">
                      <span>LP Tokens:</span>
                      <span className="font-medium">{userLPStats.lpTokens.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Rewards:</span>
                      <span className="font-medium">${userLPStats.totalRewards.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No positions in this market</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {ammError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{ammError}</p>
        </div>
      )}
    </div>
  );
};

export default AdvancedTradingInterface;

