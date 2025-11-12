import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { CONTRACT_ADDRESS, CHAIN_ID, CONTRACT_ABI, RPC_URL, NETWORK_NAME } from '../contracts/eth-config';

// Debug log to verify import
console.log('📍 Imported CONTRACT_ADDRESS:', CONTRACT_ADDRESS);
console.log('📍 CHAIN_ID:', CHAIN_ID);
console.log('📍 RPC_URL:', RPC_URL);
console.log('📍 NETWORK_NAME:', NETWORK_NAME);

const ETH_PREDICTION_MARKET_ABI = CONTRACT_ABI;

// PricingAMM ABI (simplified for price calculation)
const PRICING_AMM_ABI = [
  "function calculatePrice(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice)",
  "function getMarketState(uint256 marketId) external view returns (uint256 yesShares, uint256 noShares, uint256 liquidity, uint256 yesPrice, uint256 noPrice)",
  "function calculateSharesToGive(uint256 marketId, bool isYes, uint256 amount) external view returns (uint256)"
];

// Contract addresses - dynamically set from environment variables
const CONTRACT_ADDRESSES = {
  [CHAIN_ID]: {
    ETH_PREDICTION_MARKET: CONTRACT_ADDRESS,
    PRICING_AMM: "0x0000000000000000000000000000000000000000", // Will be set dynamically
  }
};

const Web3Context = createContext();

const normalizeMarketId = (rawMarketId) => {
  let marketId;

  try {
    marketId = ethers.BigNumber.isBigNumber(rawMarketId)
      ? rawMarketId
      : ethers.BigNumber.from(rawMarketId);
  } catch (err) {
    throw new Error(`Invalid market id: ${err.message}`);
  }

  if (marketId.lte(0)) {
    throw new Error('Market id must be greater than zero');
  }

  return marketId;
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [contracts, setContracts] = useState({});
  const [ethBalance, setEthBalance] = useState('0');
  
  // Refs to prevent infinite loops
  const connectingRef = useRef(false);
  const autoConnectedRef = useRef(false);

  // Network info - use environment variable
  const getNetworkName = (chainId) => {
    if (chainId === CHAIN_ID) {
      return NETWORK_NAME || `Chain ${chainId}`;
    }
    return `Chain ${chainId}`;
  };
  const networkName = getNetworkName(chainId);

  // Initialize contracts
  const initializeContracts = useCallback(async (web3Signer) => {
    try {
      const network = await web3Signer.provider.getNetwork();
      const chainId = network.chainId;
      console.log('🔗 Network detected:', network.name, 'Chain ID:', chainId);
      console.log('Initializing contracts for chain:', chainId);
      
      const addresses = CONTRACT_ADDRESSES[chainId];
      if (!addresses) {
        console.error(`❌ Unsupported network: ${chainId}`);
        console.log('Expected chain ID:', CHAIN_ID);
        throw new Error(`Unsupported network: ${chainId}. Please switch to ${NETWORK_NAME} (Chain ID: ${CHAIN_ID}).`);
      }

      console.log('Contract addresses for chain', chainId, ':', addresses);
      console.log('🔍 Using PredictionMarket address:', addresses.ETH_PREDICTION_MARKET);

      if (!addresses.ETH_PREDICTION_MARKET) {
        throw new Error(`Prediction market address missing for chain ${chainId}`);
      }

      if (!ethers.utils.isAddress(addresses.ETH_PREDICTION_MARKET) || addresses.ETH_PREDICTION_MARKET === ethers.constants.AddressZero) {
        throw new Error(`Invalid prediction market address for chain ${chainId}: ${addresses.ETH_PREDICTION_MARKET}`);
      }

      if (!Array.isArray(ETH_PREDICTION_MARKET_ABI) || ETH_PREDICTION_MARKET_ABI.length === 0) {
        throw new Error('Prediction market ABI is missing or empty');
      }

      let predictionMarketInterface;
      try {
        predictionMarketInterface = new ethers.utils.Interface(ETH_PREDICTION_MARKET_ABI);
      } catch (abiError) {
        throw new Error(`Invalid prediction market ABI: ${abiError.message}`);
      }

      if (!predictionMarketInterface.functions['getMarket(uint256)']) {
        throw new Error('Prediction market ABI is missing required getMarket(uint256) function');
      }

      const contractCode = await web3Signer.provider.getCode(addresses.ETH_PREDICTION_MARKET);
      if (!contractCode || contractCode === '0x' || contractCode === '0x0') {
        throw new Error(`No contract deployed at ${addresses.ETH_PREDICTION_MARKET} on chain ${chainId}`);
      }

      const predictionMarket = new ethers.Contract(
        addresses.ETH_PREDICTION_MARKET,
        ETH_PREDICTION_MARKET_ABI,
        web3Signer
      );

      // Try to get the PricingAMM address (might not exist in all versions)
      let pricingAMM = null;
      try {
        const pricingAMMAddress = predictionMarketInterface.functions['pricingAMM()']
          ? await predictionMarket.pricingAMM()
          : ethers.constants.AddressZero;

        console.log('PricingAMM address:', pricingAMMAddress);

        if (pricingAMMAddress !== ethers.constants.AddressZero) {
          pricingAMM = new ethers.Contract(
            pricingAMMAddress,
            PRICING_AMM_ABI,
            web3Signer
          );
        }
      } catch (err) {
        console.log('PricingAMM not available, skipping:', err.message);
      }

      console.log('Contracts created successfully');

      setContracts({
        predictionMarket,
        pricingAMM,
      });

      console.log('Contracts set in state');

      return { predictionMarket, pricingAMM };
    } catch (err) {
      console.error('Failed to initialize contracts:', err);
      setError(err.message);
      return {};
    }
  }, []);

  // Get ETH balance with retry logic
  const updateEthBalance = useCallback(async () => {
    if (!provider || !account) {
      console.log('⚠️ Missing provider or account:', { hasProvider: !!provider, account });
      return;
    }

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`💰 Fetching ETH balance (attempt ${attempt}/${maxRetries}) for account:`, account);
        
        // Add delay between retries
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const balance = await provider.getBalance(account);
        
        const formattedBalance = ethers.utils.formatEther(balance);
        console.log('✅ Raw ETH balance:', balance.toString());
        console.log('✅ Formatted ETH balance:', formattedBalance);
        
        setEthBalance(formattedBalance);
        return; // Success, exit retry loop
      } catch (err) {
        lastError = err;
        console.error(`❌ Failed to update ETH balance (attempt ${attempt}):`, err);
        
        // If circuit breaker error, wait longer before retry
        if (err.message && err.message.includes('circuit breaker')) {
          console.log('⏳ Circuit breaker detected, waiting longer...');
          await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        }
        
        // If last attempt, set error
        if (attempt === maxRetries) {
          console.error('❌ Failed to update ETH balance after all retries:', lastError);
          setEthBalance('0');
        }
      }
    }
  }, [provider, account]);

  // Add network to MetaMask if not already added
  const addNetwork = useCallback(async (targetChainId = CHAIN_ID) => {
    if (typeof window.ethereum === 'undefined') {
      return false;
    }

    try {
      // Use environment variables for network configuration
      const config = {
        chainId: `0x${targetChainId.toString(16)}`,
        chainName: NETWORK_NAME || 'Unknown Network',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: null,
      };

      if (!RPC_URL || !NETWORK_NAME) {
        console.error('Network configuration incomplete. Please set VITE_RPC_URL and VITE_NETWORK_NAME');
        return false;
      }
      
      // Try to switch to the network first
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chainId }],
        });
        return true;
      } catch (switchError) {
        // If network doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [config],
          });
          return true;
        }
        throw switchError;
      }
    } catch (error) {
      console.error('Failed to add/switch network:', error);
      return false;
    }
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (connectingRef.current || isConnecting) {
      console.log('⚠️ Connection already in progress, skipping...');
      return false;
    }
    
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask not detected. Please install MetaMask.');
      return false;
    }

    connectingRef.current = true;
    setIsConnecting(true);
    setError(null);

    try {
      // First, ensure we're on the correct network
      console.log('🔗 Ensuring correct network is configured...');
      await addNetwork(CHAIN_ID);
      
      // Wait a bit for network switch to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await web3Provider.getNetwork();
      const web3Signer = web3Provider.getSigner();

      console.log('Wallet connected:', {
        account: accounts[0],
        chainId: network.chainId,
        networkName: network.name
      });

      // Verify we're on the correct chain
      if (network.chainId !== CHAIN_ID) {
        console.warn('⚠️ Wrong network detected. Expected:', CHAIN_ID, 'Got:', network.chainId);
        toast.error(`Please switch to ${NETWORK_NAME} (Chain ID: ${CHAIN_ID})`);
        setIsConnecting(false);
        connectingRef.current = false;
        return false;
      }

      setProvider(web3Provider);
      setChainId(network.chainId);
      setAccount(accounts[0]);
      setSigner(web3Signer);
      setIsConnected(true);

      console.log('Initializing contracts...');
      const contractsResult = await initializeContracts(web3Signer);
      console.log('Contracts initialized:', contractsResult);
      
      // Update ETH balance after a short delay
      setTimeout(() => {
        updateEthBalance();
      }, 500);
      
      toast.success('✅ Wallet connected successfully!');
      return true;
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err.message);
      
      // Check if it's a circuit breaker error
      if (err.message && err.message.includes('circuit breaker')) {
        toast.error('MetaMask circuit breaker is open. Please reset MetaMask or wait a few seconds and try again.');
      } else {
        toast.error(`Failed to connect wallet: ${err.message}`);
      }
      setIsConnecting(false);
      connectingRef.current = false;
      return false;
    } finally {
      setIsConnecting(false);
      connectingRef.current = false;
    }
  }, [initializeContracts, addNetwork, updateEthBalance, isConnecting]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    setContracts({});
    setEthBalance('0');
    setError(null);
  }, []);

  // Check if wallet is ready for transactions
  const isWalletReady = useCallback(async () => {
    if (!provider || !signer || !account) {
      return false;
    }

    try {
      // Check if we can get the account balance (simple test)
      await provider.getBalance(account);
      return true;
    } catch (error) {
      console.error('Wallet not ready:', error);
      return false;
    }
  }, [provider, signer, account]);

  // Buy shares with ETH
  // Buy shares with retry logic
  const buyShares = useCallback(async (marketId, isYes, ethAmount) => {
    if (!contracts.predictionMarket || !signer) {
      throw new Error('Contracts not initialized');
    }

    // Check if wallet is ready
    const walletReady = await isWalletReady();
    if (!walletReady) {
      throw new Error('Wallet not ready. Please check your MetaMask connection.');
    }

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Buy attempt ${attempt}/${maxRetries} for ${isYes ? 'YES' : 'NO'} shares`);
        
        // Wait a bit between retries
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Try with gas estimation first
        try {
          const gasEstimate = await contracts.predictionMarket.estimateGas.buyShares(marketId, isYes, {
            value: ethers.utils.parseEther(ethAmount.toString())
          });
          console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);

          const tx = await contracts.predictionMarket.buyShares(marketId, isYes, {
            value: ethers.utils.parseEther(ethAmount.toString()),
            gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
          });

          console.log('Buy transaction sent:', tx.hash);
          const receipt = await tx.wait();
          console.log('Buy transaction confirmed:', receipt);

          await updateEthBalance();
          return receipt;
        } catch (gasError) {
          console.log(`⛽ Gas estimation failed, trying with fixed gas limit...`);
          
          // Fallback to fixed gas limit
          const tx = await contracts.predictionMarket.buyShares(marketId, isYes, {
            value: ethers.utils.parseEther(ethAmount.toString()),
            gasLimit: 500000 // Fixed gas limit
          });

          console.log('Buy transaction sent (fixed gas):', tx.hash);
          const receipt = await tx.wait();
          console.log('Buy transaction confirmed (fixed gas):', receipt);

          await updateEthBalance();
          return receipt;
        }
      } catch (err) {
        lastError = err;
        console.error(`❌ Buy attempt ${attempt} failed:`, err.message);
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }
  }, [contracts.predictionMarket, signer, updateEthBalance, isWalletReady]);

  // Sell shares with retry logic
  const sellShares = useCallback(async (marketId, isYes, shares) => {
    if (!contracts.predictionMarket || !signer) {
      throw new Error('Contracts not initialized');
    }

    // Check if wallet is ready
    const walletReady = await isWalletReady();
    if (!walletReady) {
      throw new Error('Wallet not ready. Please check your MetaMask connection.');
    }

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Sell attempt ${attempt}/${maxRetries} for ${shares} ${isYes ? 'YES' : 'NO'} shares`);
        
        // Wait a bit between retries
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Try with gas estimation first
        try {
          const gasEstimate = await contracts.predictionMarket.estimateGas.sellShares(marketId, isYes, ethers.utils.parseEther(shares.toString()));
          console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);

          const tx = await contracts.predictionMarket.sellShares(marketId, isYes, ethers.utils.parseEther(shares.toString()), {
            gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
          });

          console.log('Sell transaction sent:', tx.hash);
          const receipt = await tx.wait();
          console.log('Sell transaction confirmed:', receipt);

          await updateEthBalance();
          return receipt;
        } catch (gasError) {
          console.log(`⛽ Gas estimation failed, trying with fixed gas limit...`);
          
          // Fallback to fixed gas limit
          const tx = await contracts.predictionMarket.sellShares(marketId, isYes, ethers.utils.parseEther(shares.toString()), {
            gasLimit: 300000 // Fixed gas limit
          });

          console.log('Sell transaction sent (fixed gas):', tx.hash);
          const receipt = await tx.wait();
          console.log('Sell transaction confirmed (fixed gas):', receipt);

          await updateEthBalance();
          return receipt;
        }
      } catch (err) {
        lastError = err;
        console.error(`❌ Sell attempt ${attempt} failed:`, err.message);
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }
  }, [contracts.predictionMarket, signer, updateEthBalance, isWalletReady]);

  // Get user position
  const getUserPosition = useCallback(async (marketId) => {
    if (!contracts.predictionMarket || !account) {
      throw new Error('Contracts not initialized or no account');
    }

    try {
      const position = await contracts.predictionMarket.getUserPosition(marketId, account);
      return {
        yesShares: ethers.utils.formatEther(position.yesShares),
        noShares: ethers.utils.formatEther(position.noShares),
        totalInvested: ethers.utils.formatEther(position.totalInvested)
      };
    } catch (err) {
      console.error('Failed to get user position:', err);
      throw err;
    }
  }, [contracts.predictionMarket, account]);

  // Place a limit order
  const placeLimitOrder = useCallback(async (marketId, isYes, priceCents, ethAmount) => {
    if (!contracts.predictionMarket || !signer) {
      throw new Error('Contracts not initialized');
    }

    const walletReady = await isWalletReady();
    if (!walletReady) {
      throw new Error('Wallet not ready. Please check your MetaMask connection.');
    }

    // Convert price from cents to basis points (50¢ -> 5000 basis points)
    const priceBps = Math.round(priceCents * 100);
    if (priceBps <= 0 || priceBps > 10000) {
      throw new Error('Price must be between 1¢ and 100¢');
    }

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Placing limit order attempt ${attempt}/${maxRetries}`);
        
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        try {
          const gasEstimate = await contracts.predictionMarket.estimateGas.placeLimitOrder(
            marketId,
            isYes,
            priceBps,
            {
              value: ethers.utils.parseEther(ethAmount.toString())
            }
          );
          console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);

          const tx = await contracts.predictionMarket.placeLimitOrder(
            marketId,
            isYes,
            priceBps,
            {
              value: ethers.utils.parseEther(ethAmount.toString()),
              gasLimit: gasEstimate.mul(120).div(100)
            }
          );

          console.log('Limit order transaction sent:', tx.hash);
          const receipt = await tx.wait();
          console.log('Limit order transaction confirmed:', receipt);

          await updateEthBalance();
          return receipt;
        } catch (gasError) {
          console.log(`⛽ Gas estimation failed, trying with fixed gas limit...`);
          
          const tx = await contracts.predictionMarket.placeLimitOrder(
            marketId,
            isYes,
            priceBps,
            {
              value: ethers.utils.parseEther(ethAmount.toString()),
              gasLimit: 500000
            }
          );

          console.log('Limit order transaction sent (fixed gas):', tx.hash);
          const receipt = await tx.wait();
          console.log('Limit order transaction confirmed (fixed gas):', receipt);

          await updateEthBalance();
          return receipt;
        }
      } catch (err) {
        lastError = err;
        console.error(`❌ Limit order attempt ${attempt} failed:`, err.message);
        
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }
  }, [contracts.predictionMarket, signer, updateEthBalance, isWalletReady]);

  // Get user's limit orders for a market (uses hybrid order API)
  const getUserLimitOrders = useCallback(async (marketId) => {
    if (!account) {
      return [];
    }

    try {
      // Use hybrid order system API instead of contract
      const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const response = await fetch(
        `${API_BASE}/api/orders?user=${account}&marketId=${marketId}`
      );

      if (!response.ok) {
        console.warn('Failed to fetch user orders from API');
        return [];
      }

      const data = await response.json();
      const orders = (data.orders || []).map(order => ({
        orderId: order.id,
        marketId: order.marketId.toString(),
        isYes: order.outcomeId === '0' || order.outcomeId === 0,
        price: parseFloat(order.price) / 100, // Convert ticks to cents
        amount: parseFloat(ethers.utils.formatEther(order.size || '0')),
        filled: order.filled ? parseFloat(ethers.utils.formatEther(order.filled)) : 0,
        timestamp: order.createdAt || new Date().toISOString(),
        status: order.status
      }));

      // Filter to only open and partially filled orders
      return orders.filter(o => o.status === 'open' || o.status === 'partially_filled');
    } catch (err) {
      console.error('Failed to get user limit orders:', err);
      return [];
    }
  }, [account]);

  // Get market data
  const getMarketData = useCallback(async (marketId) => {
    if (!contracts.predictionMarket) {
      throw new Error('Contracts not initialized');
    }

    try {
      const normalizedMarketId = normalizeMarketId(marketId);

      const market = await contracts.predictionMarket.getMarket(normalizedMarketId);

      if (!market?.id || !ethers.BigNumber.isBigNumber(market.id) || market.id.isZero()) {
        throw new Error(`Market ${normalizedMarketId.toString()} does not exist`);
      }

      console.log('Market data fetched:', market);

      // Get prices directly from chain using getCurrentPrice
      let yesPrice = 50; // Default 50¢
      let noPrice = 50; // Default 50¢

      try {
        // Prices come as basis points from contract (5000 = 50%)
        const yesPriceBps = await contracts.predictionMarket.getCurrentPrice(normalizedMarketId, true);
        const noPriceBps = await contracts.predictionMarket.getCurrentPrice(normalizedMarketId, false);
        yesPrice = parseFloat(yesPriceBps.toString()) / 100; // Convert to cents
        noPrice = parseFloat(noPriceBps.toString()) / 100; // Convert to cents
      } catch (err) {
        console.log('Could not get prices from chain, using defaults:', err.message);
        // Fallback to PricingAMM if available
        if (contracts.pricingAMM) {
          try {
            const prices = await contracts.pricingAMM.calculatePrice(normalizedMarketId);
            yesPrice = prices[0].toNumber() / 100;
            noPrice = prices[1].toNumber() / 100;
          } catch (ammErr) {
            console.log('Could not get prices from PricingAMM either, using defaults');
          }
        }
      }

      return {
        id: market.id.toString(),
        question: market.question,
        description: market.description,
        category: market.category,
        endTime: market.endTime.toString(),
        resolutionTime: market.resolutionTime.toString(),
        resolved: market.resolved,
        outcome: market.outcome,
        totalYesShares: market.totalYesShares.toString(),
        totalNoShares: market.totalNoShares.toString(),
        totalVolume: market.totalVolume.toString(),
        creator: market.creator,
        createdAt: market.createdAt.toString(),
        active: market.active,
        yesPrice: yesPrice,
        noPrice: noPrice,
        totalPool: (parseInt(market.totalYesShares.toString()) + parseInt(market.totalNoShares.toString())).toString()
      };
    } catch (err) {
      console.error('Failed to get market data:', err);
      throw err;
    }
  }, [contracts.predictionMarket, contracts.pricingAMM]);

  // Create market with improved error handling
  const createMarket = useCallback(async (question, description, category, endTime, resolutionTime) => {
    if (!contracts.predictionMarket || !signer) {
      throw new Error('Contracts not initialized');
    }

    // Check if wallet is ready
    const walletReady = await isWalletReady();
    if (!walletReady) {
      throw new Error('Wallet not ready. Please check your MetaMask connection.');
    }

    try {
      const marketCreationFee = await contracts.predictionMarket.marketCreationFee();
      
      console.log('Creating market with fee:', ethers.utils.formatEther(marketCreationFee), 'ETH');
      console.log('Parameters:', { question, category, endTime, resolutionTime });
      
      // Try with gas estimation first
      try {
        const gasEstimate = await contracts.predictionMarket.estimateGas.createMarket(
          question,
          description,
          category,
          endTime,
          resolutionTime,
          {
            value: marketCreationFee
          }
        );
        console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);

        const tx = await contracts.predictionMarket.createMarket(
          question,
          description,
          category,
          endTime,
          resolutionTime,
          {
            value: marketCreationFee,
            gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
          }
        );

        console.log('Create market transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('Create market transaction confirmed:', receipt);

        // Update ETH balance
        await updateEthBalance();

        return receipt;
      } catch (gasError) {
        console.log(`⛽ Gas estimation failed, trying with fixed gas limit...`);
        console.error('Gas estimation error:', gasError);
        
        // Fallback to fixed gas limit
        const tx = await contracts.predictionMarket.createMarket(
          question,
          description,
          category,
          endTime,
          resolutionTime,
          {
            value: marketCreationFee,
            gasLimit: 2000000 // Higher fixed gas limit for market creation
          }
        );

        console.log('Create market transaction sent (fixed gas):', tx.hash);
        const receipt = await tx.wait();
        console.log('Create market transaction confirmed (fixed gas):', receipt);

        // Update ETH balance
        await updateEthBalance();

        return receipt;
      }
    } catch (err) {
      console.error('Failed to create market:', err);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to create market';
      
      if (err.message) {
        if (err.message.includes('Insufficient market creation fee')) {
          errorMessage = 'Insufficient fee. Please ensure you have enough ETH.';
        } else if (err.message.includes('End time must be in future')) {
          errorMessage = 'End time must be in the future. Please check your dates.';
        } else if (err.message.includes('Resolution time must be after end time')) {
          errorMessage = 'Resolution time must be after end time.';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (err.message.includes('Internal JSON-RPC error')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = err.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  }, [contracts.predictionMarket, signer, updateEthBalance, isWalletReady]);

  // Claim winnings
  const claimWinnings = useCallback(async (marketId) => {
    if (!contracts.predictionMarket || !signer) {
      throw new Error('Contracts not initialized');
    }

    try {
      const tx = await contracts.predictionMarket.claimWinnings(marketId, {
        gasLimit: 200000
      });

      console.log('Claim winnings transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Claim winnings transaction confirmed:', receipt);

      // Update ETH balance
      await updateEthBalance();

      return receipt;
    } catch (err) {
      console.error('Failed to claim winnings:', err);
      throw err;
    }
  }, [contracts.predictionMarket, signer, updateEthBalance]);

  // Update balances when account or contracts change
  useEffect(() => {
    if (isConnected && account && provider) {
      updateEthBalance();
    }
  }, [isConnected, account, provider, updateEthBalance]);

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (accounts[0] !== account) {
          setAccount(accounts[0]);
        }
      };

      const handleChainChanged = (chainId) => {
        setChainId(parseInt(chainId, 16));
        window.location.reload(); // Reload to reinitialize contracts
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [account, disconnectWallet]);

  // Auto-connect if previously connected (only once on mount)
  useEffect(() => {
    // Only auto-connect once, and only if not already connected
    if (autoConnectedRef.current || isConnected || connectingRef.current) {
      return;
    }

    const autoConnect = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0 && !isConnected && !connectingRef.current) {
            autoConnectedRef.current = true;
            await connectWallet();
          }
        } catch (err) {
          console.error('Auto-connect failed:', err);
        }
      }
    };

    autoConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const value = {
    // Connection state
    provider,
    signer,
    account,
    chainId,
    networkName,
    isConnected,
    isConnecting,
    error,

    // Contracts
    contracts,

    // Balances
    ethBalance,

    // Actions
    connectWallet,
    disconnectWallet,
    buyShares,
    sellShares,
    getUserPosition,
    getMarketData,
    createMarket,
    claimWinnings,
    placeLimitOrder,
    getUserLimitOrders,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};
