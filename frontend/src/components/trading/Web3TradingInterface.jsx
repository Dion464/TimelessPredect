import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { centsToTCENT } from '../../utils/priceFormatter';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { 
  createOrderWithDefaults, 
  signOrder, 
  validateOrder, 
  centsToTicks,
  ticksToCents
} from '../../utils/eip712';

const EXCHANGE_CONTRACT = import.meta.env.VITE_EXCHANGE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const Web3TradingInterface = ({ marketId, market, onTradeComplete }) => {
  // Add error handling for Web3 context
  let web3Context;
  try {
    web3Context = useWeb3();
  } catch (error) {
    console.error('Web3 context error in trading interface:', error);
    web3Context = {
      isConnected: false,
      account: null,
      contracts: {},
      buyShares: null,
      sellShares: null,
      getUserPosition: null,
      getMarketData: null,
      getUserLimitOrders: null,
      signer: null,
      ethBalance: '0',
    };
  }
  
  const {
    isConnected,
    account,
    contracts,
    buyShares,
    sellShares,
    getUserPosition,
    getMarketData,
    getUserLimitOrders,
    signer,
    ethBalance,
    chainId
  } = web3Context;
  
  const currencySymbol = getCurrencySymbol(chainId);

  const [activeTab, setActiveTab] = useState('buy');
  const [tradeAmount, setTradeAmount] = useState('0.1');
  const [tradeSide, setTradeSide] = useState('yes');
  const [orderType, setOrderType] = useState('market'); // 'market' or 'limit'
  const [limitPrice, setLimitPrice] = useState('');
  const [position, setPosition] = useState({ yesShares: '0', noShares: '0', totalInvested: '0' });
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [estimatedShares, setEstimatedShares] = useState('0');
  const [openOrders, setOpenOrders] = useState([]);

  // Fetch market data and user position
  const fetchData = useCallback(async () => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    try {
      const [marketInfo, userPos] = await Promise.all([
        getMarketData(marketId),
        getUserPosition(marketId),
      ]);

      setMarketData(marketInfo);
      setPosition(userPos);
    } catch (err) {
      console.log('Blockchain data not available, using fallback:', err.message);
    }
  }, [isConnected, contracts.predictionMarket, marketId, getMarketData, getUserPosition]);

  // Real-time price updates - only update if price actually changed
  useEffect(() => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    const updatePrices = async () => {
      try {
        const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
        const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
        
        const yesPriceCents = parseFloat(yesPrice.toString()) / 100;
        const noPriceCents = parseFloat(noPrice.toString()) / 100;
        
        // Only update state if prices actually changed
        setMarketData(prev => {
          if (prev?.yesPrice === yesPriceCents && prev?.noPrice === noPriceCents) {
            return prev; // No change, don't update
          }
          return {
            ...prev,
            yesPrice: yesPriceCents,
            noPrice: noPriceCents
          };
        });
      } catch (err) {
        console.log('Failed to update prices:', err.message);
      }
    };

    // Update prices every 30 seconds (reduced from 10 seconds)
    const interval = setInterval(updatePrices, 30000);
    updatePrices(); // Initial update

    return () => clearInterval(interval);
  }, [isConnected, contracts.predictionMarket, marketId]);

  // Calculate estimated shares using AMM logic
  const calculateEstimatedShares = useCallback(async () => {
    if (!contracts.pricingAMM || !contracts.predictionMarket || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setEstimatedShares('0');
      return;
    }

    try {
      // First, sync AMM state with current market state (same as contract does)
      const market = await contracts.predictionMarket.getMarket(marketId);
      const yesShares = market.totalYesShares;
      const noShares = market.totalNoShares;
      
      // Update AMM state before calculating (this syncs the internal state)
      // Note: updateMarketState is not a view function, so we can't call it directly
      // Instead, we'll use the market's current state directly in our calculation
      
      const investmentAmount = parseFloat(tradeAmount);
      let estimatedShares;
      
      if (activeTab === 'buy') {
        // Calculate shares using LMSR pricing from AMM
        try {
          // Get current price from AMM (in basis points: 5000 = 50%)
          const [yesPriceBasis, noPriceBasis] = await contracts.pricingAMM.calculatePrice(marketId);
          const currentPriceBasis = tradeSide === 'yes' ? yesPriceBasis.toNumber() : noPriceBasis.toNumber();
          
          // Convert price from basis points to decimal (5000 -> 0.5)
          const currentPriceDecimal = currentPriceBasis / 10000;
          
          // Calculate shares: investmentAmount / price_in_decimal
          // At 50% (0.5), 0.1 ETH buys 0.1 / 0.5 = 0.2 shares
          if (currentPriceDecimal > 0 && currentPriceDecimal <= 1) {
            estimatedShares = investmentAmount / currentPriceDecimal;
            // Apply 2% fee (same as contract)
            estimatedShares = estimatedShares * 0.98;
          } else {
            // Fallback: use 1:1 if price is invalid
            estimatedShares = investmentAmount;
          }
        } catch (error) {
          console.error('Failed to calculate shares with AMM:', error);
          // Fallback: use price from marketData if available
          const fallbackYesPrice = marketData?.yesPrice || market?.yesPrice || 50;
          const fallbackNoPrice = marketData?.noPrice || market?.noPrice || 50;
          const currentPrice = tradeSide === 'yes' ? parseFloat(fallbackYesPrice) : parseFloat(fallbackNoPrice);
          // Price is in cents, convert to decimal (50 -> 0.5)
          const priceDecimal = currentPrice / 100;
          if (priceDecimal > 0 && priceDecimal <= 1) {
            estimatedShares = investmentAmount / priceDecimal;
            estimatedShares = estimatedShares * 0.98; // Apply 2% fee
          } else {
            estimatedShares = investmentAmount; // 1:1 fallback
          }
        }
      } else {
        // For selling, use current price to calculate payout
        const fallbackYesPrice = marketData?.yesPrice || market?.yesPrice || 50;
        const fallbackNoPrice = marketData?.noPrice || market?.noPrice || 50;
        const currentPrice = tradeSide === 'yes' ? parseFloat(fallbackYesPrice) : parseFloat(fallbackNoPrice);
        const priceDecimal = currentPrice / 100; // Convert cents to decimal
        if (priceDecimal > 0 && priceDecimal <= 1) {
          estimatedShares = parseFloat(tradeAmount) * priceDecimal * 0.98; // Apply 2% fee
        } else {
          estimatedShares = parseFloat(tradeAmount); // 1:1 fallback
        }
      }
      
      // Ensure minimum of 0.0001 shares
      if (estimatedShares < 0.0001) {
        estimatedShares = 0.0001;
      }
      
      setEstimatedShares(estimatedShares.toFixed(4));
    } catch (err) {
      console.error('Failed to calculate shares:', err);
      // Final fallback: very simple calculation
      setEstimatedShares(parseFloat(tradeAmount).toFixed(4));
    }
  }, [contracts.predictionMarket, contracts.pricingAMM, marketId, tradeAmount, tradeSide, activeTab, marketData, market]);

  // Fetch market data and user position - only refresh if data actually changed
  useEffect(() => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    fetchData(); // Initial fetch
    
    // Only refresh data every 60 seconds instead of 30 seconds
    const interval = setInterval(() => {
      if (isConnected && contracts.predictionMarket && marketId) {
        fetchData();
      }
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [isConnected, contracts.predictionMarket, marketId, fetchData]);

  useEffect(() => {
    // Only calculate when tradeAmount or tradeSide changes, not on every calculateEstimatedShares change
    if (tradeAmount && parseFloat(tradeAmount) > 0) {
    calculateEstimatedShares();
    }
  }, [tradeAmount, tradeSide, activeTab, orderType, marketData?.yesPrice, marketData?.noPrice]); // Added price dependencies instead of callback

  // Fetch open orders
  const fetchOpenOrders = useCallback(async () => {
    if (!isConnected || !getUserLimitOrders || !marketId) return;
    try {
      const orders = await getUserLimitOrders(marketId);
      setOpenOrders(orders || []);
    } catch (err) {
      // Silently fail - API might not be running yet
      // Orders will just be empty until API is available
      setOpenOrders([]);
    }
  }, [isConnected, getUserLimitOrders, marketId]);

  useEffect(() => {
    fetchOpenOrders();
    // Refresh orders every 60 seconds (reduced from 30 seconds)
    const interval = setInterval(fetchOpenOrders, 60000);
    return () => clearInterval(interval);
  }, [fetchOpenOrders]);

  const handleBuy = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(tradeAmount) > parseFloat(ethBalance)) {
      toast.error(`Insufficient ${currencySymbol} balance`);
      return;
    }

    setLoading(true);

    try {
      if (orderType === 'limit') {
        // Place limit order using hybrid order system (EIP-712)
        if (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 100) {
          toast.error('Please enter a valid limit price (0.01-1.00 TCENT)');
          setLoading(false);
          return;
        }

        if (!signer) {
          toast.error('Please connect your wallet');
          setLoading(false);
          return;
        }

        // Create order object for EIP-712 signing
        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(parseFloat(limitPrice)).toString(),
          size: ethers.utils.parseUnits(tradeAmount || '0', 18).toString(),
          side: true // true = buy
        };

        const order = createOrderWithDefaults(orderData);

        // Validate order
        const validation = validateOrder(order);
        if (!validation.valid) {
          toast.error(validation.error);
          setLoading(false);
          return;
        }

        // Check if API is available
        try {
          const healthCheck = await fetch(`${API_BASE}/api/orders?marketId=${marketId}&outcomeId=0&depth=1`, {
            method: 'GET'
          });
          if (!healthCheck.ok && healthCheck.status !== 400) {
            throw new Error('API server is not responding. Please ensure the backend API server is running.');
          }
        } catch (err) {
          if (err.message.includes('fetch')) {
            toast.error('Cannot connect to API server. Please start the backend: node api-server.js');
            setLoading(false);
            return;
          }
        }

        // Sign order with EIP-712
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        // Submit to backend
        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order,
            signature,
            isMarketOrder: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to place order' }));
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to place order`);
        }

        const result = await response.json();

        if (result.status === 'matched') {
          // Enhanced toast for matched buy order
          const orderType = tradeSide === 'yes' ? 'YES' : 'NO';
          const priceInfo = result.matches && result.matches.length > 0 
            ? `@ ${centsToTCENT(ticksToCents(parseInt(result.matches[0].fillPrice)))} TCENT`
            : `@ ${centsToTCENT(limitPrice)} TCENT`;
          const fillAmount = result.matches && result.matches.length > 0
            ? result.matches.reduce((sum, m) => sum + parseFloat(ethers.utils.formatEther(m.fillSize)), 0)
            : parseFloat(tradeAmount);
          
          toast.success(
            `✅ ${orderType} shares BOUGHT! ${fillAmount.toFixed(4)} ${currencySymbol} ${priceInfo}`,
            { 
              icon: '💰',
              duration: 5000,
              style: {
                background: '#10b981',
                color: '#fff',
                fontWeight: '600'
              }
            }
          );
          toast('Settling trade on-chain...', { icon: '⏳', duration: 3000 });
          
          // Refresh orders once after a delay
          setTimeout(() => {
            fetchOpenOrders();
            fetchData();
          }, 5000);
        } else {
          toast.success(`✅ Limit buy order placed at ${centsToTCENT(limitPrice)} TCENT!`);
          // Refresh orders once
          setTimeout(() => {
            fetchOpenOrders();
          }, 2000);
        }
        
        setTradeAmount('');
        setLimitPrice('');
        
        // Refresh data once after order placement
        setTimeout(() => {
          fetchData();
        }, 3000);
      } else {
        // Market order (execute immediately from order book, fallback to AMM if no matches)
        if (!signer) {
          toast.error('Please connect your wallet');
          setLoading(false);
          return;
        }

        if (!buyShares) {
          toast.error('Buy function not available. Please reconnect your wallet.');
          setLoading(false);
          return;
        }

        // Create order object for EIP-712 signing (market order)
        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(currentPrice).toString(), // Use current market price
          size: ethers.utils.parseUnits(tradeAmount || '0', 18).toString(),
          side: true // true = buy
        };

        const order = createOrderWithDefaults(orderData);
        
        console.log('🔍 Signing order with:', {
          chainId: chainId,
          exchangeContract: EXCHANGE_CONTRACT,
          order: order,
          orderMaker: order.maker,
          account: account
        });
        
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);
        
        console.log('✅ Order signed:', {
          signature: signature.substring(0, 20) + '...',
          orderPrice: order.price,
          orderSize: order.size
        });

        // Submit market order to backend
        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order,
            signature,
            isMarketOrder: true
          })
        });

        console.log('Market order response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to place market order' }));
          console.error('Market order API error:', errorData);
          throw new Error(errorData.error || errorData.suggestion || `HTTP ${response.status}: Failed to place market order`);
        }

        const result = await response.json();
        console.log('Market order result:', result);

        if (result.status === 'matched') {
          // Enhanced toast for matched market buy order
          const orderType = tradeSide === 'yes' ? 'YES' : 'NO';
          const fillCount = result.fills?.length || result.matches?.length || 1;
          const avgPrice = result.fills && result.fills.length > 0
            ? result.fills.reduce((sum, f) => sum + ticksToCents(parseInt(f.fillPrice)), 0) / result.fills.length
            : result.matches && result.matches.length > 0
            ? ticksToCents(parseInt(result.matches[0].fillPrice))
            : currentPrice;
          const totalAmount = result.fills && result.fills.length > 0
            ? result.fills.reduce((sum, f) => sum + parseFloat(ethers.utils.formatEther(f.fillSize)), 0)
            : parseFloat(tradeAmount);
          
          toast.success(
            `✅ ${orderType} shares BOUGHT! ${totalAmount.toFixed(4)} ${currencySymbol} @ ${centsToTCENT(avgPrice)} TCENT`,
            { 
              icon: '💰',
              duration: 5000,
              style: {
                background: '#10b981',
                color: '#fff',
                fontWeight: '600'
              }
            }
          );
          // Trigger settlement if fills exist
          if (result.fills && result.fills.length > 0) {
            toast('Settling trade on-chain...', { icon: '⏳', duration: 3000 });
          }
        } else if (result.status === 'no_matches' || result.useAMM) {
          // No matches in order book - fallback to AMM
          console.log('No matches in order book, using AMM fallback');
          
          if (!buyShares) {
            throw new Error('Buy function not available. Please reconnect your wallet.');
          }
          
          toast('No matching orders - executing via AMM...', { icon: '🔄' });
          try {
            console.log(`Calling buyShares: marketId=${marketId}, isYes=${tradeSide === 'yes'}, amount=${tradeAmount}`);
            await buyShares(marketId, tradeSide === 'yes', tradeAmount);
            toast.success('✅ Shares purchased successfully via AMM!');
          } catch (ammError) {
            console.error('AMM buy failed:', ammError);
            throw new Error(`AMM buy failed: ${ammError.message}`);
          }
        } else {
          console.warn('Unexpected market order result:', result);
          toast.error(`Market order could not be filled. Status: ${result.status || 'unknown'}`);
        }

        setTradeAmount('');
      }
      
      // Refresh data once after order placement (no immediate refresh)
      // Only refresh if trade was successful
      setTimeout(() => {
        fetchData();
        fetchOpenOrders();
      }, 10000); // Increased to 10 seconds to give blockchain time to update
      
      // Call the refresh callback to update chart and all data
      if (onTradeComplete) {
        setTimeout(() => onTradeComplete(), 5000); // Reduced from 3 seconds
      }
    } catch (err) {
      console.error(orderType === 'limit' ? 'Limit order failed:' : 'Buy failed:', err);
      toast.error(`${orderType === 'limit' ? 'Limit order' : 'Buy'} failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const availableShares = tradeSide === 'yes' ? position.yesShares : position.noShares;
    if (parseFloat(tradeAmount) > parseFloat(availableShares)) {
      toast.error(`Insufficient ${tradeSide.toUpperCase()} shares`);
      return;
    }

    setLoading(true);

    try {
      if (orderType === 'limit') {
        // Place limit sell order using hybrid order system (EIP-712)
        if (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 100) {
          toast.error('Please enter a valid limit price (0.01-1.00 TCENT)');
          setLoading(false);
          return;
        }

        if (!signer) {
          toast.error('Please connect your wallet');
          setLoading(false);
          return;
        }

        // Create order object for EIP-712 signing
        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(parseFloat(limitPrice)).toString(),
          size: ethers.utils.parseUnits(tradeAmount || '0', 18).toString(),
          side: false // false = sell
        };

        const order = createOrderWithDefaults(orderData);

        // Validate order
        const validation = validateOrder(order);
        if (!validation.valid) {
          toast.error(validation.error);
          setLoading(false);
          return;
        }

        // Check if API is available
        try {
          const healthCheck = await fetch(`${API_BASE}/api/orders?marketId=${marketId}&outcomeId=${outcomeId}&depth=1`, {
            method: 'GET'
          });
          if (!healthCheck.ok && healthCheck.status !== 400) {
            throw new Error('API server is not responding. Please ensure the backend API server is running.');
          }
        } catch (err) {
          if (err.message.includes('fetch')) {
            toast.error('Cannot connect to API server. Please start the backend: node api-server.js');
            setLoading(false);
            return;
          }
        }

        // Sign order with EIP-712
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        // Submit to backend
        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order,
            signature,
            isMarketOrder: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to place order' }));
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to place order`);
        }

        const result = await response.json();

        if (result.status === 'matched') {
          // Enhanced toast for matched sell order
          const orderType = tradeSide === 'yes' ? 'YES' : 'NO';
          const priceInfo = result.matches && result.matches.length > 0 
            ? `@ ${centsToTCENT(ticksToCents(parseInt(result.matches[0].fillPrice)))} TCENT`
            : `@ ${centsToTCENT(limitPrice)} TCENT`;
          const fillAmount = result.matches && result.matches.length > 0
            ? result.matches.reduce((sum, m) => sum + parseFloat(ethers.utils.formatEther(m.fillSize)), 0)
            : parseFloat(tradeAmount);
          
          toast.success(
            `✅ ${orderType} shares SOLD! ${fillAmount.toFixed(4)} ${currencySymbol} ${priceInfo}`,
            { 
              icon: '💸',
              duration: 5000,
              style: {
                background: '#ef4444',
                color: '#fff',
                fontWeight: '600'
              }
            }
          );
          toast('Settling trade on-chain...', { icon: '⏳', duration: 3000 });
          
          // Refresh orders once after a delay
          setTimeout(() => {
            fetchOpenOrders();
            fetchData();
          }, 5000);
        } else {
          toast.success(`✅ Limit sell order placed at ${centsToTCENT(limitPrice)} TCENT!`);
          // Refresh orders once
          setTimeout(() => {
            fetchOpenOrders();
          }, 2000);
        }
        
        setTradeAmount('');
        setLimitPrice('');
        
        // Refresh data once after order placement
        setTimeout(() => {
          fetchData();
        }, 3000);
      } else {
        // Market sell order (execute immediately from order book only)
        if (!signer) {
          toast.error('Please connect your wallet');
          setLoading(false);
          return;
        }

        // Create order object for EIP-712 signing (market sell)
        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(currentPrice).toString(), // Use current market price
          size: ethers.utils.parseUnits(tradeAmount || '0', 18).toString(),
          side: false // false = sell
        };

        const order = createOrderWithDefaults(orderData);
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        // Submit market order to backend
        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order,
            signature,
            isMarketOrder: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to place market order' }));
          throw new Error(errorData.error || errorData.suggestion || `HTTP ${response.status}: Failed to place market order`);
        }

        const result = await response.json();

        if (result.status === 'matched') {
          // Enhanced toast for matched market sell order
          const orderType = tradeSide === 'yes' ? 'YES' : 'NO';
          const fillCount = result.fills?.length || result.matches?.length || 1;
          const avgPrice = result.fills && result.fills.length > 0
            ? result.fills.reduce((sum, f) => sum + ticksToCents(parseInt(f.fillPrice)), 0) / result.fills.length
            : result.matches && result.matches.length > 0
            ? ticksToCents(parseInt(result.matches[0].fillPrice))
            : currentPrice;
          const totalAmount = result.fills && result.fills.length > 0
            ? result.fills.reduce((sum, f) => sum + parseFloat(ethers.utils.formatEther(f.fillSize)), 0)
            : parseFloat(tradeAmount);
          
          toast.success(
            `✅ ${orderType} shares SOLD! ${totalAmount.toFixed(4)} ${currencySymbol} @ ${centsToTCENT(avgPrice)} TCENT`,
            { 
              icon: '💸',
              duration: 5000,
              style: {
                background: '#ef4444',
                color: '#fff',
                fontWeight: '600'
              }
            }
          );
          // Trigger settlement if fills exist
          if (result.fills && result.fills.length > 0) {
            toast('Settling trade on-chain...', { icon: '⏳', duration: 3000 });
          }
        } else if (result.status === 'no_matches' || result.useAMM) {
          // No matches in order book - fallback to AMM
          console.log('No matches in order book, using AMM fallback');
          
          if (!sellShares) {
            throw new Error('Sell function not available. Please reconnect your wallet.');
          }
          
          toast('No matching orders - executing via AMM...', { icon: '🔄' });
          try {
            await sellShares(marketId, tradeSide === 'yes', tradeAmount);
            toast.success('✅ Shares sold successfully via AMM!');
          } catch (ammError) {
            console.error('AMM sell failed:', ammError);
            throw new Error(`AMM sell failed: ${ammError.message}`);
          }
        } else {
          toast.error('Market sell order could not be filled - no matching buy orders');
        }

        setTradeAmount('');
      }
      
      // Refresh data once after order placement (no immediate refresh)
      // Only refresh if trade was successful
      setTimeout(() => {
        fetchData();
        fetchOpenOrders();
      }, 10000); // Increased to 10 seconds to give blockchain time to update
      
      // Call the refresh callback to update chart and all data
      if (onTradeComplete) {
        setTimeout(() => onTradeComplete(), 5000); // Reduced from 3 seconds
      }
    } catch (err) {
      console.error(orderType === 'limit' ? 'Limit order failed:' : 'Sell failed:', err);
      toast.error(`${orderType === 'limit' ? 'Limit order' : 'Sell'} failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Wallet to Trade</h3>
          <p className="text-gray-600">Connect your MetaMask wallet to buy and sell shares.</p>
        </div>
      </div>
    );
  }

  // Define prices early to avoid initialization issues
  // Prioritize marketData over market prop, with fallback to 50 (represents 0.50 TCENT)
  const yesPrice = marketData?.yesPrice || market?.yesPrice || 50; // Default to 50 (0.50 TCENT)
  const noPrice = marketData?.noPrice || market?.noPrice || 50; // Default to 50 (0.50 TCENT)
  const currentPrice = tradeSide === 'yes' ? yesPrice : noPrice;
  
  // Debug logging
  console.log('Web3TradingInterface Debug:', {
    tradeAmount,
    tradeAmountType: typeof tradeAmount,
    tradeAmountParsed: parseFloat(tradeAmount),
    loading,
    isConnected,
    yesPrice,
    noPrice,
    currentPrice,
    market: market ? {
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      id: market.id
    } : null,
    marketData: marketData ? {
      yesPrice: marketData.yesPrice,
      noPrice: marketData.noPrice,
      id: marketData.id
    } : null
  });

  // Calculate estimated values for display (Dribbble style)
  const estimatedAveragePrice = parseFloat(tradeAmount) > 0 && parseFloat(estimatedShares) > 0
    ? (parseFloat(tradeAmount) / parseFloat(estimatedShares)).toFixed(2)
    : '0.00';
  
  const estimatedProfit = activeTab === 'buy' && parseFloat(tradeAmount) > 0
    ? (parseFloat(estimatedShares) * (currentPrice / 100) - parseFloat(tradeAmount)).toFixed(2)
    : '0.00';
  
  const estimatedFees = parseFloat(tradeAmount) > 0
    ? (parseFloat(tradeAmount) * 0.02).toFixed(2) // 2% fee
    : '0.00';
  
  const maxROI = activeTab === 'buy' && parseFloat(tradeAmount) > 0
    ? ((parseFloat(estimatedShares) * 1.0 - parseFloat(tradeAmount)) / parseFloat(tradeAmount) * 100).toFixed(2)
    : '0.00';

  const ratePerShare = parseFloat(tradeAmount) > 0 && parseFloat(estimatedShares) > 0
    ? (parseFloat(tradeAmount) / parseFloat(estimatedShares)).toFixed(2)
    : (currentPrice / 100).toFixed(2);

  return (
    <div className="bg-white/[0.08] rounded-[24px] border border-white/20 overflow-hidden backdrop-blur-xl shadow-lg">
      {/* Buy/Sell Tabs - Worm Style */}
      <div className="flex gap-2 p-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-2 px-3 font-space-grotesk font-normal rounded-full transition-colors ${
            activeTab === 'buy'
              ? 'bg-white/10 text-white backdrop-blur-md'
              : 'bg-transparent text-gray-400 hover:bg-white/5 hover:text-gray-300'
          }`}
          style={{ fontSize: '12px' }}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-2 px-3 font-space-grotesk font-normal rounded-full transition-colors ${
            activeTab === 'sell'
              ? 'bg-white/10 text-white backdrop-blur-md'
              : 'bg-transparent text-gray-400 hover:bg-white/5 hover:text-gray-300'
          }`}
          style={{ fontSize: '12px' }}
        >
          Sell
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Current Market Prices - Worm Style (Clickable) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTradeSide('yes')}
            className={`p-4 rounded-xl text-left transition-all backdrop-blur-md ${
              tradeSide === 'yes' 
                ? 'bg-green-500/20 border-2 border-green-500/50' 
                : 'bg-white/5 hover:bg-white/10 border-2 border-white/10'
            }`}
          >
            <div className="text-xs text-gray-400 mb-1 font-space-grotesk">Yes</div>
            <div className="text-xl font-bold text-green-400 font-space-grotesk">
              {centsToTCENT(yesPrice)} TCENT
            </div>
          </button>
          <button
            onClick={() => setTradeSide('no')}
            className={`p-4 rounded-xl text-left transition-all backdrop-blur-md ${
              tradeSide === 'no' 
                ? 'bg-red-500/20 border-2 border-red-500/50' 
                : 'bg-white/5 hover:bg-white/10 border-2 border-white/10'
            }`}
          >
            <div className="text-xs text-gray-400 mb-1 font-space-grotesk">No</div>
            <div className="text-xl font-bold text-red-400 font-space-grotesk">
              {centsToTCENT(noPrice)} TCENT
            </div>
          </button>
        </div>

        {/* Side Selection - Hidden, controlled by clicking price boxes */}
        <div className="hidden">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose Side
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTradeSide('yes')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                tradeSide === 'yes'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-medium">YES</div>
            </button>
            <button
              onClick={() => setTradeSide('no')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                tradeSide === 'no'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-medium">NO</div>
            </button>
          </div>
        </div>

        {/* Order Type Selection */}
        {(activeTab === 'buy' || activeTab === 'sell') && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 font-space-grotesk">Order Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOrderType('market');
                  setLimitPrice('');
                }}
                className={`flex-1 py-2 px-4 rounded-full font-space-grotesk font-normal transition-all backdrop-blur-md ${
                  orderType === 'market'
                    ? 'bg-white/10 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                }`}
                style={{ fontSize: '12px' }}
              >
                Market
              </button>
              <button
                onClick={() => {
                  setOrderType('limit');
                  // Always set limit price to current market price when switching to limit
                  setLimitPrice(currentPrice.toFixed(2));
                }}
                className={`flex-1 py-2 px-4 rounded-full font-space-grotesk font-normal transition-all backdrop-blur-md ${
                  orderType === 'limit'
                    ? 'bg-white/10 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                }`}
                style={{ fontSize: '12px' }}
              >
                Limit
              </button>
            </div>
          </div>
        )}

        {/* Limit Price Input */}
        {orderType === 'limit' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300 font-space-grotesk">Limit Price (TCENT)</label>
              <span className="text-sm text-gray-400 font-space-grotesk">
                Current: <span className="font-bold text-white">{centsToTCENT(currentPrice)} TCENT</span>
              </span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={currentPrice.toFixed(2)}
              className="w-full px-4 py-3.5 bg-white/5 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-white/20 focus:border-white/20 font-space-grotesk font-medium text-lg text-white placeholder-gray-500"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setLimitPrice((currentPrice * 0.95).toFixed(2))}
                className="text-sm px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 font-space-grotesk font-medium backdrop-blur-md"
              >
                -5%
              </button>
              <button
                onClick={() => setLimitPrice(currentPrice.toFixed(2))}
                className="text-sm px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 font-space-grotesk font-medium backdrop-blur-md"
              >
                Market
              </button>
              <button
                onClick={() => setLimitPrice((currentPrice * 1.05).toFixed(2))}
                className="text-sm px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 font-space-grotesk font-medium backdrop-blur-md"
              >
                +5%
              </button>
            </div>
            {limitPrice && parseFloat(limitPrice) < currentPrice && (
              <div className="mt-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 p-3 rounded-xl font-space-grotesk backdrop-blur-md">
                ✓ Your order will execute if price drops to {centsToTCENT(limitPrice)} TCENT or below
              </div>
            )}
            {limitPrice && parseFloat(limitPrice) > currentPrice && (
              <div className="mt-2 text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl font-space-grotesk backdrop-blur-md">
                ⚠ Your order will execute if price rises to {centsToTCENT(limitPrice)} TCENT or above
              </div>
            )}
          </div>
        )}

        {/* Market Order Info */}
        {orderType === 'market' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 backdrop-blur-md">
            <div className="text-sm text-blue-300 font-semibold mb-1 font-space-grotesk">Market Order</div>
            <div className="text-sm text-blue-200 font-space-grotesk">
              {activeTab === 'buy' 
                ? `Will execute immediately against best available sell orders (~${centsToTCENT(currentPrice)} TCENT)`
                : `Will execute immediately if there's a matching buy order (~${centsToTCENT(currentPrice)} TCENT)`
              }
            </div>
            <div className="text-xs text-blue-300 mt-2">
              💡 Want to set a specific price? Switch to <strong>Limit</strong> order
            </div>
          </div>
        )}

        {/* Amount Input - Worm Style */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-300 font-space-grotesk">Amount</label>
            <span className="text-sm text-gray-400 font-space-grotesk">
              Balance: <span className="font-bold text-white">
                {activeTab === 'buy' ? `${parseFloat(ethBalance).toFixed(4)} ${currencySymbol}` : `${parseFloat(tradeSide === 'yes' ? position.yesShares : position.noShares).toFixed(2)} shares`}
              </span>
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-green-400 font-bold font-space-grotesk">{currencySymbol}</span>
            </div>
            <input
              type="number"
              step="0.001"
              min="0"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder="0.1"
              className="w-full pl-14 pr-16 py-3.5 bg-white/5 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-white/20 focus:border-white/20 font-space-grotesk font-medium text-lg text-white placeholder-gray-500"
            />
            <button
              onClick={() => {
                if (activeTab === 'buy') {
                  setTradeAmount(parseFloat(ethBalance).toFixed(4));
                } else {
                  const available = tradeSide === 'yes' ? position.yesShares : position.noShares;
                  setTradeAmount(parseFloat(available).toFixed(2));
                }
              }}
              className="absolute top-4 right-4 text-blue-400 hover:text-blue-300 font-medium text-sm font-space-grotesk"
            >
              Max
            </button>
          </div>
          {activeTab === 'buy' && parseFloat(tradeAmount) > 0 && orderType === 'market' && (
            <div className="mt-2 text-sm text-gray-400 font-space-grotesk">
              Rate: <span className="font-semibold text-white">{ratePerShare} {currencySymbol} = 1 Share</span>
            </div>
          )}
          {activeTab === 'buy' && parseFloat(tradeAmount) > 0 && orderType === 'limit' && limitPrice && (
            <div className="mt-2 text-sm text-gray-400 font-space-grotesk">
              Will buy at: <span className="font-semibold text-white">{centsToTCENT(limitPrice)} TCENT</span>
              {parseFloat(limitPrice) < currentPrice && (
                <span className="text-green-400 ml-2">(Below market - will execute if price drops)</span>
              )}
              {parseFloat(limitPrice) > currentPrice && (
                <span className="text-orange-400 ml-2">(Above market - will execute if price rises)</span>
              )}
            </div>
          )}
        </div>

        {/* Estimated Trade Details - Worm Style */}
        {activeTab === 'buy' && parseFloat(tradeAmount) > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-space-grotesk">Average Price</span>
              <span className="font-bold text-white font-space-grotesk">{estimatedAveragePrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-space-grotesk">Estimated Shares</span>
              <span className="font-bold text-white font-space-grotesk">{parseFloat(estimatedShares).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-space-grotesk">Estimated Profit</span>
              <span className="font-bold text-white font-space-grotesk">{estimatedProfit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-space-grotesk">Estimated Fees</span>
              <span className="font-bold text-white font-space-grotesk">{estimatedFees}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-space-grotesk">Max Return on Investment</span>
              <span className="font-bold text-white font-space-grotesk">{maxROI}%</span>
            </div>
          </div>
        )}

        {/* Buy/Sell Button - Worm Style */}
        <button
          onClick={activeTab === 'buy' ? handleBuy : handleSell}
          disabled={
            loading || 
            !tradeAmount || 
            parseFloat(tradeAmount) <= 0 ||
            (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 100))
          }
          className={`w-full py-3 px-6 rounded-full font-space-grotesk font-bold text-white transition-all duration-200 backdrop-blur-md ${
            loading || 
            !tradeAmount || 
            parseFloat(tradeAmount) <= 0 ||
            (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 100))
              ? 'bg-white/10 cursor-not-allowed opacity-50'
              : 'bg-white/10 hover:bg-white/20 border border-white/20'
          }`}
          style={{ fontSize: '16px' }}
        >
          {loading ? (
            <div className="flex items-center justify-center font-space-grotesk">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              Processing...
            </div>
          ) : (
            activeTab === 'buy' 
              ? (orderType === 'limit' ? `Place Limit Order at ${centsToTCENT(limitPrice || 0)} TCENT` : 'Buy')
              : 'Sell'
          )}
        </button>

        {/* Open Orders */}
        {activeTab === 'buy' && openOrders.length > 0 && (
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Open Orders</h3>
            <div className="space-y-2">
              {openOrders.map((order) => (
                <div
                  key={order.orderId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        order.isYes ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {order.isYes ? 'YES' : 'NO'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{centsToTCENT(order.price)} TCENT</span>
                      <span className="text-xs text-gray-500">× {order.amount.toFixed(4)} {currencySymbol}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(order.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Signals - Dribbble Style */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">My Signals</h3>
          <p className="text-sm text-gray-500">You have no available forecast.</p>
        </div>

        {/* Join Community - Dribbble Style */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Join Community</h3>
              <p className="text-xs text-gray-500">Be part of a great community</p>
            </div>
          </div>
          <button className="w-full mt-3 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Join
          </button>
        </div>
      </div>
    </div>
  );
};

export default Web3TradingInterface;