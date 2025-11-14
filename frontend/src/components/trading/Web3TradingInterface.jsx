import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { centsToTCENT } from '../../utils/priceFormatter';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { showGlassToast, showTransactionToast } from '../../utils/toastUtils.jsx';
import { 
  createOrderWithDefaults, 
  signOrder, 
  validateOrder, 
  centsToTicks,
  ticksToCents
} from '../../utils/eip712';
import '../../pages/market/MarketDetailGlass.css';

const INCENTIV_EXCHANGE_ADDRESS = '0x8cF17Ff1Abe81B5c74f78edb62b0AeF31936642C';
const EXCHANGE_CONTRACT = import.meta.env.VITE_EXCHANGE_CONTRACT_ADDRESS || INCENTIV_EXCHANGE_ADDRESS;
const resolveApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  const isLocal8080 = envBase && /localhost:8080|127\.0\.0\.1:8080/i.test(envBase);
  if (envBase && !isLocal8080) {
    return envBase;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};
const API_BASE = resolveApiBase();

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
  const clashFont = "'Clash Grotesk Variable', 'Clash Grotesk', sans-serif";
  const getOutcomeButtonStyle = (isActive, width) => ({
    width,
    height: '40px',
    borderRadius: '8px',
    border: isActive ? '1px solid #FFE600' : '1px solid rgba(255,255,255,0.08)',
    background: isActive ? 'rgba(255,255,255,0.04)' : 'rgba(17,17,17,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease'
  });

  const getOffsetButtonStyle = (variant, isActive) => {
    const base = {
      height: '32px',
      borderRadius: '999px',
      border: isActive ? '1px solid #FFE600' : '1px solid rgba(255,255,255,0.08)',
      background: isActive ? 'rgba(255,255,255,0.06)' : 'rgba(15,15,15,0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: clashFont,
      fontWeight: 300,
      fontSize: '14px',
      lineHeight: '20px',
      color: '#FFFFFF',
      transition: 'all 0.2s ease'
    };

    if (variant === 'market') {
      return {
        ...base,
        width: '128px',
        border: isActive ? '1px solid #FFE600' : '1px solid rgba(255,255,255,0.12)',
        background: isActive ? 'rgba(255,255,255,0.06)' : 'rgba(20,20,20,0.68)'
      };
    }

    return {
      ...base,
      width: '72px'
    };
  };

  const [activeTab, setActiveTab] = useState('buy');
  const [tradeAmount, setTradeAmount] = useState('0.1');
  const [tradeSide, setTradeSide] = useState('yes');
  const [orderType, setOrderType] = useState('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [activeLimitButton, setActiveLimitButton] = useState('market'); // 'minus5', 'market', 'plus5'
  const [position, setPosition] = useState({ yesShares: '0', noShares: '0', totalInvested: '0' });
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [estimatedShares, setEstimatedShares] = useState('0');
  const [openOrders, setOpenOrders] = useState([]);

  const amountInputStyle = orderType === 'market'
    ? {
        width: '350px',
        height: '68px',
        padding: '0 24px',
        background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(32px)'
      }
    : {
        width: '350px',
        height: '48px',
        padding: '0 18px',
        background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(32px)'
      };

  const amountInputTextStyle = orderType === 'market'
    ? { fontFamily: clashFont, fontWeight: 600, fontSize: '28px', lineHeight: '32px', color: '#FFFFFF', letterSpacing: '-0.3px' }
    : { fontFamily: clashFont, fontWeight: 400, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' };

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

  // Real-time price updates
  useEffect(() => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    const updatePrices = async () => {
      try {
        const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
        const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
        
        const yesPriceCents = parseFloat(yesPrice.toString()) / 100;
        const noPriceCents = parseFloat(noPrice.toString()) / 100;
        
        setMarketData(prev => {
          if (prev?.yesPrice === yesPriceCents && prev?.noPrice === noPriceCents) {
            return prev;
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

    const interval = setInterval(updatePrices, 30000);
    updatePrices();

    return () => clearInterval(interval);
  }, [isConnected, contracts.predictionMarket, marketId]);

  const normalizeDecimal = (value) => {
    if (value === null || value === undefined) return '0';
    if (typeof value === 'number') return value.toString();
    const trimmed = value.toString().trim();
    if (!trimmed) return '0';
    return trimmed.replace(/,/g, '.');
  };

  // Calculate estimated shares using AMM logic
  const calculateEstimatedShares = useCallback(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setEstimatedShares('0');
      return;
    }

    try {
      const fallbackYesPrice = marketData?.yesPrice || market?.yesPrice || 50;
      const fallbackNoPrice = marketData?.noPrice || market?.noPrice || 50;
      const investmentAmount = parseFloat(tradeAmount);
      let estimatedShares;

      if (activeTab === 'buy') {
        const currentPrice = tradeSide === 'yes' ? parseFloat(fallbackYesPrice) : parseFloat(fallbackNoPrice);
        const priceDecimal = currentPrice / 100;
        if (priceDecimal > 0 && priceDecimal <= 1) {
          estimatedShares = (investmentAmount / priceDecimal) * 0.98;
        } else {
          estimatedShares = investmentAmount;
        }
      } else {
        const currentPrice = tradeSide === 'yes' ? parseFloat(fallbackYesPrice) : parseFloat(fallbackNoPrice);
        const priceDecimal = currentPrice / 100;
        if (priceDecimal > 0 && priceDecimal <= 1) {
          estimatedShares = investmentAmount * priceDecimal * 0.98;
        } else {
          estimatedShares = investmentAmount;
        }
      }

      if (!Number.isFinite(estimatedShares) || estimatedShares <= 0) {
        estimatedShares = investmentAmount;
      }

      if (estimatedShares < 0.0001) {
        estimatedShares = 0.0001;
      }

      setEstimatedShares(estimatedShares.toFixed(4));
    } catch (err) {
      console.error('Failed to calculate shares:', err);
      setEstimatedShares(parseFloat(tradeAmount).toFixed(4));
    }
  }, [tradeAmount, tradeSide, activeTab, marketData, market]);

  // Fetch market data and user position
  useEffect(() => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    fetchData();
    
    const interval = setInterval(() => {
      if (isConnected && contracts.predictionMarket && marketId) {
        fetchData();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isConnected, contracts.predictionMarket, marketId, fetchData]);

  useEffect(() => {
    if (tradeAmount && parseFloat(tradeAmount) > 0) {
    calculateEstimatedShares();
    }
  }, [tradeAmount, tradeSide, activeTab, orderType, marketData?.yesPrice, marketData?.noPrice]);

  // Fetch open orders
  const fetchOpenOrders = useCallback(async () => {
    if (!isConnected || !getUserLimitOrders || !marketId) return;
    try {
      const orders = await getUserLimitOrders(marketId);
      setOpenOrders(orders || []);
    } catch (err) {
      setOpenOrders([]);
    }
  }, [isConnected, getUserLimitOrders, marketId]);

  useEffect(() => {
    fetchOpenOrders();
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

        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(parseFloat(limitPrice)).toString(),
          size: ethers.utils.parseUnits(normalizeDecimal(tradeAmount), 18).toString(),
          side: true
        };

        const order = createOrderWithDefaults(orderData);

        const validation = validateOrder(order);
        if (!validation.valid) {
          toast.error(validation.error);
          setLoading(false);
          return;
        }

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

        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

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

        if (result.status === 'matched' || result.status === 'partially_filled') {
          const orderType = tradeSide === 'yes' ? 'YES' : 'NO';
          const priceInfo = result.matches && result.matches.length > 0 
            ? `@ ${centsToTCENT(ticksToCents(parseInt(result.matches[0].fillPrice)))} TCENT`
            : `@ ${centsToTCENT(limitPrice)} TCENT`;
          const fillAmount = result.matches && result.matches.length > 0
            ? result.matches.reduce((sum, m) => sum + parseFloat(ethers.utils.formatEther(m.fillSize)), 0)
            : parseFloat(tradeAmount);
          
          showGlassToast({
            icon: '💰',
            title: `${orderType} shares ${result.status === 'matched' ? 'filled' : 'partially filled'}`,
            description: `${fillAmount.toFixed(4)} ${currencySymbol} ${priceInfo}. ${result.status === 'matched' ? 'Settlement executing on-chain.' : 'Remaining amount stays on the book.'}`,
            duration: 5200
          });
          
          setTimeout(() => {
            fetchOpenOrders();
            fetchData();
          }, 5000);
        } else {
          showGlassToast({
            icon: '📥',
            title: 'Limit buy order placed',
            description: `Queued at ${centsToTCENT(limitPrice)} TCENT. We’ll settle it once matched.`,
            duration: 4800
          });
          setTimeout(() => {
            fetchOpenOrders();
          }, 2000);
        }
        
        setTradeAmount('');
        setLimitPrice('');
        
        setTimeout(() => {
          fetchData();
        }, 3000);
      } else {
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

        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(currentPrice).toString(),
          size: ethers.utils.parseUnits(normalizeDecimal(tradeAmount), 18).toString(),
          side: true
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

        if (result.status === 'matched' || result.status === 'partially_filled') {
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
          
          showGlassToast({
            icon: '💰',
            title: `${orderType} shares ${result.status === 'matched' ? 'filled' : 'partially filled'}`,
            description: `${totalAmount.toFixed(4)} ${currencySymbol} @ ${centsToTCENT(avgPrice)} TCENT. ${result.status === 'matched' ? 'Settlement executing on-chain.' : 'Remaining amount stays on the book.'}`,
            duration: 5200
          });
        } else if (result.status === 'no_matches') {
          if (!buyShares) {
            throw new Error('Buy function not available. Please reconnect your wallet.');
          }

          showGlassToast({
            icon: '🔄',
            title: 'Routing through AMM',
            description: 'No matching sell orders were found. Executing directly against the prediction market.',
            duration: 4200
          });

          try {
            const receipt = await buyShares(marketId, tradeSide === 'yes', tradeAmount);
            showTransactionToast({
              icon: '✅',
              title: `${tradeSide === 'yes' ? 'YES' : 'NO'} position confirmed`,
              description: `${parseFloat(tradeAmount).toFixed(4)} ${currencySymbol} filled via AMM.`,
              txHash: receipt?.transactionHash
            });
          } catch (ammError) {
            throw new Error(`AMM buy failed: ${ammError.message}`);
          }
        } else {
          console.warn('Unexpected market order result:', result);
          toast.error(`Market order could not be filled. Status: ${result.status || 'unknown'}`);
        }

        setTradeAmount('');
      }
      
      setTimeout(() => {
        fetchData();
        fetchOpenOrders();
      }, 10000);
      
      if (onTradeComplete) {
        setTimeout(() => onTradeComplete(), 5000);
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

        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(parseFloat(limitPrice)).toString(),
          size: ethers.utils.parseUnits(tradeAmount || '0', 18).toString(),
          side: false
        };

        const order = createOrderWithDefaults(orderData);

        const validation = validateOrder(order);
        if (!validation.valid) {
          toast.error(validation.error);
          setLoading(false);
          return;
        }

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

        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

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

        if (result.status === 'matched' || result.status === 'partially_filled') {
          const orderType = tradeSide === 'yes' ? 'YES' : 'NO';
          const priceInfo = result.matches && result.matches.length > 0 
            ? `@ ${centsToTCENT(ticksToCents(parseInt(result.matches[0].fillPrice)))} TCENT`
            : `@ ${centsToTCENT(limitPrice)} TCENT`;
          const fillAmount = result.matches && result.matches.length > 0
            ? result.matches.reduce((sum, m) => sum + parseFloat(ethers.utils.formatEther(m.fillSize)), 0)
            : parseFloat(tradeAmount);
          
          showGlassToast({
            icon: '💸',
            title: `${orderType} shares ${result.status === 'matched' ? 'filled' : 'partially filled'}`,
            description: `${fillAmount.toFixed(4)} ${currencySymbol} ${priceInfo}. ${result.status === 'matched' ? 'Settlement executing on-chain.' : 'Remaining amount stays on the book.'}`,
            duration: 5200
          });
          
          setTimeout(() => {
            fetchOpenOrders();
            fetchData();
          }, 5000);
        } else {
          showGlassToast({
            icon: '📤',
            title: 'Limit sell order placed',
            description: `Queued at ${centsToTCENT(limitPrice)} TCENT. We’ll process it once matched.`,
            duration: 4800
          });
          setTimeout(() => {
            fetchOpenOrders();
          }, 2000);
        }
        
        setTradeAmount('');
        setLimitPrice('');
        
        setTimeout(() => {
          fetchData();
        }, 3000);
      } else {
        if (!signer) {
          toast.error('Please connect your wallet');
          setLoading(false);
          return;
        }

        const outcomeId = tradeSide === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: marketId.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(currentPrice).toString(),
          size: ethers.utils.parseUnits(tradeAmount || '0', 18).toString(),
          side: false
        };

        const order = createOrderWithDefaults(orderData);
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

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

        if (result.status === 'matched' || result.status === 'partially_filled') {
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
          
          showGlassToast({
            icon: '💸',
            title: `${orderType} shares ${result.status === 'matched' ? 'filled' : 'partially filled'}`,
            description: `${totalAmount.toFixed(4)} ${currencySymbol} @ ${centsToTCENT(avgPrice)} TCENT. ${result.status === 'matched' ? 'Settlement executing on-chain.' : 'Remaining amount stays on the book.'}`,
            duration: 5200
          });
        } else if (result.status === 'no_matches') {
          if (!sellShares) {
            throw new Error('Sell function not available. Please reconnect your wallet.');
          }

          showGlassToast({
            icon: '🔄',
            title: 'Routing through AMM',
            description: 'No matching buy orders were found. Executing directly against the prediction market.',
            duration: 4200
          });

          try {
            const receipt = await sellShares(marketId, tradeSide === 'yes', tradeAmount);
            showTransactionToast({
              icon: '✅',
              title: `${tradeSide === 'yes' ? 'YES' : 'NO'} shares sold`,
              description: `${parseFloat(tradeAmount).toFixed(4)} ${currencySymbol} released via AMM.`,
              txHash: receipt?.transactionHash
            });
          } catch (ammError) {
            throw new Error(`AMM sell failed: ${ammError.message}`);
          }
        } else {
          toast.error('Market sell order could not be filled - no matching buy orders');
        }

        setTradeAmount('');
      }
      
      setTimeout(() => {
        fetchData();
        fetchOpenOrders();
      }, 10000);
      
      if (onTradeComplete) {
        setTimeout(() => onTradeComplete(), 5000);
      }
    } catch (err) {
      console.error(orderType === 'limit' ? 'Limit order failed:' : 'Sell failed:', err);
      toast.error(`${orderType === 'limit' ? 'Limit order' : 'Sell'} failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Define prices early
  const yesPrice = marketData?.yesPrice || market?.yesPrice || 50;
  const noPrice = marketData?.noPrice || market?.noPrice || 50;
  const currentPrice = tradeSide === 'yes' ? yesPrice : noPrice;

  if (!isConnected) {
    return (
      <div className="glass-card rounded-[16px] backdrop-blur-[32px] relative w-full max-w-[384px] mx-auto" style={{ background: 'transparent', minHeight: '540px', padding: '17px' }}>
        <div className="w-full min-h-[474px] flex items-center justify-center">
          <button
            className="glass-card rounded-[12px] w-full"
            style={{ 
              height: '48px',
              background: 'transparent',
              border: '1px solid #FFE600',
              backdropFilter: 'blur(32px)',
              fontFamily: clashFont,
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: '24px',
              color: '#FFFFFF'
            }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[16px] backdrop-blur-[32px] relative w-full max-w-[384px] mx-auto" style={{ background: 'transparent', minHeight: '620px', padding: '17px' }}>
      <div className="relative w-full min-h-[560px]">
        
        {/* Buy/Sell + 2x Badge - Row at y:0 */}
        <div className="absolute flex items-center justify-between w-full" style={{ left: 0, top: 0, height: '40px' }}>
          <div className="flex items-center p-1 rounded-[8px]" style={{ border: '0.5px solid rgba(255,255,255,0.72)' }}>
            <button
              onClick={() => setActiveTab('buy')}
              className="px-3 rounded-full transition-all"
              style={{ 
                height: '24px', 
                background: activeTab === 'buy' ? '#171717' : 'transparent',
                fontFamily: clashFont, 
                fontWeight: 300, 
                fontSize: '12px', 
                lineHeight: '16px', 
                color: '#F3F3F3' 
              }}
            >
              Buy
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className="px-3 rounded-full transition-all"
              style={{ 
                height: '24px', 
                background: activeTab === 'sell' ? '#171717' : 'transparent',
                fontFamily: clashFont, 
                fontWeight: 300, 
                fontSize: '12px', 
                lineHeight: '16px', 
                color: '#F3F3F3' 
              }}
            >
              Sell
            </button>
          </div>
     
        </div>

        {/* Separator at y:56 */}
        <div className="absolute" style={{ left: 0, top: '56px', width: '350px', height: '1px', borderTop: '1px solid rgba(255,255,255,0.05)' }}></div>

        {/* Yes/No Toggle at y:73 */}
        <div className="glass-card absolute flex items-center gap-1" style={{ 
          left: 0, 
          top: '73px', 
          width: '350px', 
          height: '48px', 
          padding: '4px',
          background: 'rgba(255,255,255,0.04)', 
          backdropFilter: 'blur(32px)', 
          borderRadius: '12px',
          gap: '6px'
        }}>
          <button
            onClick={() => setTradeSide('yes')}
            className="transition-all"
            style={getOutcomeButtonStyle(tradeSide === 'yes', '169.58px')}
          >
            <span style={{ fontFamily: clashFont, fontWeight: 400, fontSize: '14px', lineHeight: '20px', color: '#F3F3F3' }}>Yes</span>
            <span style={{ fontFamily: clashFont, fontWeight: 400, fontSize: '14px', lineHeight: '20px', color: '#F3F3F3' }}>{Math.round(yesPrice)}%</span>
          </button>
          
          <button
            onClick={() => setTradeSide('no')}
            className="transition-all"
            style={getOutcomeButtonStyle(tradeSide === 'no', '168.42px')}
          >
            <span style={{ fontFamily: clashFont, fontWeight: 400, fontSize: '14px', lineHeight: '20px', color: '#F3F3F3' }}>No</span>
            <span style={{ fontFamily: clashFont, fontWeight: 400, fontSize: '14px', lineHeight: '20px', color: '#F3F3F3' }}>{Math.round(noPrice)}%</span>
          </button>
        </div>

        {/* Market/Limit Tabs at y:137 */}
          <div className="absolute flex items-center" style={{ left: 0, top: '137px', width: '350px', height: '40px', gap: '12px' }}>
          <button
            onClick={() => { setOrderType('market'); setLimitPrice(''); setActiveLimitButton('market'); }}
            className="glass-card flex items-center justify-center rounded-[12px]"
            style={{ 
              width: '170px', 
              height: '40px', 
              background: orderType === 'market' ? 'rgba(255,255,255,0.04)' : 'transparent',
              backdropFilter: orderType === 'market' ? 'blur(32px)' : 'none',
              border: orderType === 'market' ? '1px solid #FFE600' : 'none', 
              fontFamily: clashFont, 
              fontWeight: 300, 
              fontSize: '14px', 
              lineHeight: '20px', 
              color: '#FFFFFF', 
              gap :'6px', 
            }}
          >
            Market
          </button>
          
          <button
            onClick={() => { setOrderType('limit'); setLimitPrice((currentPrice).toFixed(2)); setActiveLimitButton('market'); }}
            className="glass-card flex items-center justify-center rounded-[12px]"
            style={{ 
              width: '162px', 
              height: '40px', 
              background: orderType === 'limit' ? 'rgba(255,255,255,0.04)' : 'transparent',
              backdropFilter: orderType === 'limit' ? 'blur(32px)' : 'none',
              border: orderType === 'limit' ? '1px solid #FFE600' : 'none', 
              fontFamily: clashFont, 
              fontWeight: 300, 
              fontSize: '14px', 
              lineHeight: '20px', 
              color: '#FFFFFF' 
            }}
          >
            Limit
          </button>
        </div>

        {/* LIMIT ORDER ONLY - Limit Price Section at y:186 */}
        {orderType === 'limit' && (
          <>
            <div className="absolute" style={{ left: 0, top: '186px', width: '350px' }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' }}>Limit Price</span>
                <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' }}>Current: {(currentPrice / 100).toFixed(2)}TCENT</span>
              </div>
              
              <div
                className="glass-card flex items-center rounded-[12px]"
                style={{
                  width: '350px',
                  height: '48px',
                  padding: '0 18px',
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(32px)'
                }}
              >
                <input
                  type="text"
                  value={limitPrice || '50:00'}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="50:00"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontFamily: clashFont, fontWeight: 400, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' }}
                />
              </div>
            </div>

            {/* -5% Market +5% Buttons at y:272 */}
            <div className="absolute flex items-center gap-4" style={{ left: 0, top: '272px' }}>
              <button
                onClick={() => { 
                  setLimitPrice((parseFloat(limitPrice || (currentPrice)) * 0.95).toFixed(2));
                  setActiveLimitButton('minus5');
                }}
                className="flex items-center justify-center"
                style={getOffsetButtonStyle('minus', activeLimitButton === 'minus5')}
              >
                -5%
              </button>
              
              <button
                onClick={() => { 
                  setLimitPrice((currentPrice).toFixed(2));
                  setActiveLimitButton('market');
                }}
                className="flex items-center justify-center"
                style={getOffsetButtonStyle('market', activeLimitButton === 'market')}
              >
                Market
              </button>
              
              <button
                onClick={() => { 
                  setLimitPrice((parseFloat(limitPrice || (currentPrice)) * 1.05).toFixed(2));
                  setActiveLimitButton('plus5');
                }}
                className="flex items-center justify-center"
                style={getOffsetButtonStyle('plus', activeLimitButton === 'plus5')}
              >
                +5%
              </button>
            </div>
          </>
        )}

        {/* Amount Section - y:314 for Limit, y:186 for Market */}
        <div className="absolute" style={{ 
          left: 0, 
          top: orderType === 'limit' ? '314px' : '186px', 
          width: '350px'
        }}>
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' }}>Amount</span>
            <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' }}>
              Balance: {activeTab === 'buy' ? `${parseFloat(ethBalance).toFixed(3)} TCENT` : `${parseFloat(tradeSide === 'yes' ? position.yesShares : position.noShares).toFixed(3)} TCENT`}
            </span>
          </div>
          
          <div className="glass-card flex items-center rounded-[12px]" style={amountInputStyle}>
            <input
              type="text"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder="50:00"
              className="flex-1 bg-transparent outline-none"
              style={amountInputTextStyle}
            />
          </div>
        </div>

        {/* Separator + Entry/Liquidation - y:399 for Limit, y:271 for Market */}
        <div className="absolute" style={{ left: 0, top: orderType === 'limit' ? '399px' : '271px', width: '350px' }}>
          <div style={{ width: '100%', height: '1px', borderTop: '1px solid rgba(255,255,255,0.72)', marginBottom: '12px' }}></div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '12px', lineHeight: '16px', color: '#8B8B8B' }}>Entry Price</span>
              <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>${(currentPrice / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '12px', lineHeight: '16px', color: '#8B8B8B' }}>Liquidation Price</span>
              <span style={{ fontFamily: clashFont, fontWeight: 300, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>${((currentPrice / 100) * 0.5).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Place Order Button - y:476 (same for both) */}
        <button
          onClick={activeTab === 'buy' ? handleBuy : handleSell}
          disabled={loading || !tradeAmount || parseFloat(tradeAmount) <= 0}
          className="glass-card rounded-[12px] absolute"
          style={{ 
            left: 0,
            top: '476px',
            width: '350px',
            height: '56px',
            background: 'linear-gradient(180deg, rgba(15,15,15,0.92) 0%, rgba(8,8,8,0.78) 100%)',
            border: '1px solid #FFE600',
            backdropFilter: 'blur(32px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: clashFont, 
            fontWeight: 700,
            fontSize: '17px',
            letterSpacing: '0.2px',
            color: '#FFFFFF',
            opacity: loading || !tradeAmount || parseFloat(tradeAmount) <= 0 ? 0.5 : 1,
            cursor: loading || !tradeAmount || parseFloat(tradeAmount) <= 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : activeTab === 'buy' ? `Place ${orderType === 'market' ? 'Market' : 'Limit'} Order` : `Place ${orderType === 'market' ? 'Market' : 'Limit'} Sell Order`}
        </button>
      </div>
    </div>
  );
};

export default Web3TradingInterface;
