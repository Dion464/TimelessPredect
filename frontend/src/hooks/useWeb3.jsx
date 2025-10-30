import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { PREDICTION_MARKET_ADDRESS, CHAIN_ID } from '../contracts/config';

// Debug log to verify import
console.log('📍 Imported PREDICTION_MARKET_ADDRESS:', PREDICTION_MARKET_ADDRESS);
console.log('📍 CHAIN_ID:', CHAIN_ID);

// Use the ABI from eth-config as it has all the necessary functions
import { CONTRACT_ABI } from '../contracts/eth-config';
const ETH_PREDICTION_MARKET_ABI = CONTRACT_ABI;

// PricingAMM ABI (simplified for price calculation)
const PRICING_AMM_ABI = [
  "function calculatePrice(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice)",
  "function getMarketState(uint256 marketId) external view returns (uint256 yesShares, uint256 noShares, uint256 liquidity, uint256 yesPrice, uint256 noPrice)",
  "function calculateSharesToGive(uint256 marketId, bool isYes, uint256 amount) external view returns (uint256)"
];

// Contract addresses (will be updated after Mumbai deployment)
const CONTRACT_ADDRESSES = {
          // Local Hardhat
          1337: {
            ETH_PREDICTION_MARKET: PREDICTION_MARKET_ADDRESS, // Use deployed address from config.js
            PRICING_AMM: "0x0000000000000000000000000000000000000000", // Will be set dynamically
          },
          // Alternative Hardhat chain ID
          31337: {
            ETH_PREDICTION_MARKET: PREDICTION_MARKET_ADDRESS,
            PRICING_AMM: "0x0000000000000000000000000000000000000000", // Will be set dynamically
          },
  // Polygon Amoy Testnet (current official testnet)
  80002: {
    ETH_PREDICTION_MARKET: "0x0000000000000000000000000000000000000000", // Update after deployment
  },
  // Polygon Mainnet
  137: {
    ETH_PREDICTION_MARKET: "0x0000000000000000000000000000000000000000", // For future use
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

  // Network info
  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 1337: return 'Hardhat Local';
      case 31337: return 'Hardhat Local'; // Alternative Hardhat chain ID
      case 1: return 'Ethereum Mainnet';
      case 80002: return 'Polygon Amoy';
      case 137: return 'Polygon Mainnet';
      default: return `Chain ${chainId}`;
    }
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
        console.log('Available networks:', Object.keys(CONTRACT_ADDRESSES));
        throw new Error(`Unsupported network: ${chainId}. Please switch to Hardhat Local (1337) or Localhost 8545 (31337).`);
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

  // Get ETH balance
  const updateEthBalance = useCallback(async () => {
    if (!provider || !account) {
      console.log('⚠️ Missing provider or account:', { hasProvider: !!provider, account });
      return;
    }

    try {
      console.log('💰 Fetching ETH balance for account:', account);
      const balance = await provider.getBalance(account);
      
      const formattedBalance = ethers.utils.formatEther(balance);
      console.log('✅ Raw ETH balance:', balance.toString());
      console.log('✅ Formatted ETH balance:', formattedBalance);
      
      setEthBalance(formattedBalance);
    } catch (err) {
      console.error('❌ Failed to update ETH balance:', err);
    }
  }, [provider, account]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask not detected. Please install MetaMask.');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
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

      setProvider(web3Provider);
      setChainId(network.chainId);
      setAccount(accounts[0]);
      setSigner(web3Signer);
      setIsConnected(true);

      console.log('Initializing contracts...');
      const contractsResult = await initializeContracts(web3Signer);
      console.log('Contracts initialized:', contractsResult);
      
      toast.success('✅ Wallet connected successfully!');

      return true;
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err.message);
      toast.error(`Failed to connect wallet: ${err.message}`);
      setIsConnecting(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [initializeContracts]);

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

      // Try to get prices from PricingAMM if available
      let yesPrice = 50; // Default 50¢
      let noPrice = 50; // Default 50¢

      if (contracts.pricingAMM) {
        try {
          const prices = await contracts.pricingAMM.calculatePrice(normalizedMarketId);
          yesPrice = prices[0].toNumber() / 100;
          noPrice = prices[1].toNumber() / 100;
        } catch (err) {
          console.log('Could not get prices from PricingAMM, using defaults');
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

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            await connectWallet();
          }
        } catch (err) {
          console.error('Auto-connect failed:', err);
        }
      }
    };

    autoConnect();
  }, [connectWallet]);

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
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};
