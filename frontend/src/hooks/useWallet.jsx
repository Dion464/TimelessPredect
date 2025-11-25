import { useState, useEffect, useCallback } from 'react';

const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);

  // Get MetaMask provider only - strict MetaMask-only connection
  const getMetaMaskProvider = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
      return null;
    }

    // If multiple providers exist, find MetaMask only
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      // Strictly find MetaMask - ignore all other wallets
      const metamaskProvider = window.ethereum.providers.find(
        (p) => p.isMetaMask && !p.isBraveWallet
      );
      if (metamaskProvider) {
        return metamaskProvider;
      }
      // MetaMask not found in providers array - return null
      return null;
    }

    // If it's MetaMask directly, use it
    if (window.ethereum.isMetaMask) {
      return window.ethereum;
    }

    // Not MetaMask - return null to reject connection
    return null;
  }, []);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return getMetaMaskProvider() !== null;
  }, [getMetaMaskProvider]);

  // Get current account and chain info
  const getAccountInfo = useCallback(async () => {
    const metamaskProvider = getMetaMaskProvider();
    if (!metamaskProvider) return;

    try {
      const accounts = await metamaskProvider.request({ method: 'eth_accounts' });
      const chainId = await metamaskProvider.request({ method: 'eth_chainId' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setChainId(chainId);
        
        // Get balance
        const balance = await metamaskProvider.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest']
        });
        
        // Convert from wei to ETH
        const ethBalance = (parseInt(balance, 16) / Math.pow(10, 18)).toFixed(4);
        setBalance(ethBalance);
      }
    } catch (error) {
      console.error('Error getting account info:', error);
      setError(error.message);
    }
  }, [getMetaMaskProvider]);

  // Connect wallet - MetaMask only
  const connectWallet = useCallback(async () => {
    const metamaskProvider = getMetaMaskProvider();
    
    if (!metamaskProvider) {
      // Check if other wallets are installed but MetaMask is not
      if (typeof window.ethereum !== 'undefined') {
        const hasOtherWallets = (window.ethereum.providers && window.ethereum.providers.length > 0) || 
                                (!window.ethereum.isMetaMask);
        if (hasOtherWallets) {
          setError('MetaMask not found. Please install or enable MetaMask extension. Other wallet extensions are not supported.');
          return;
        }
      }
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = await metamaskProvider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        await getAccountInfo();
        setProvider(metamaskProvider);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, [getMetaMaskProvider, getAccountInfo]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setBalance('0');
    setProvider(null);
    setError(null);
  }, []);

  // Switch network
  const switchNetwork = useCallback(async (targetChainId) => {
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      });
    } catch (error) {
      console.error('Error switching network:', error);
      setError(error.message);
    }
  }, [provider]);

  // Add network
  const addNetwork = useCallback(async (networkConfig) => {
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [networkConfig],
      });
    } catch (error) {
      console.error('Error adding network:', error);
      setError(error.message);
    }
  }, [provider]);

  // Send transaction
  const sendTransaction = useCallback(async (transactionConfig) => {
    if (!provider || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: account,
          ...transactionConfig
        }],
      });

      return txHash;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }, [provider, account]);

  // Sign message
  const signMessage = useCallback(async (message) => {
    if (!provider || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, account],
      });

      return signature;
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  }, [provider, account]);

  // Listen for account changes
  useEffect(() => {
    const metamaskProvider = getMetaMaskProvider();
    if (!metamaskProvider) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        getAccountInfo();
      }
    };

    const handleChainChanged = (chainId) => {
      setChainId(chainId);
      getAccountInfo();
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    metamaskProvider.on('accountsChanged', handleAccountsChanged);
    metamaskProvider.on('chainChanged', handleChainChanged);
    metamaskProvider.on('disconnect', handleDisconnect);

    // Check if already connected
    getAccountInfo();

    return () => {
      if (metamaskProvider.removeListener) {
        metamaskProvider.removeListener('accountsChanged', handleAccountsChanged);
        metamaskProvider.removeListener('chainChanged', handleChainChanged);
        metamaskProvider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [getMetaMaskProvider, getAccountInfo, disconnectWallet]);

  // Network configurations
  const networks = {
    ethereum: {
      chainId: '0x1',
      chainName: 'Ethereum Mainnet',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.infura.io/v3/'],
      blockExplorerUrls: ['https://etherscan.io/']
    },
    polygon: {
      chainId: '0x89',
      chainName: 'Polygon Mainnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-rpc.com/'],
      blockExplorerUrls: ['https://polygonscan.com/']
    },
    arbitrum: {
      chainId: '0xa4b1',
      chainName: 'Arbitrum One',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      blockExplorerUrls: ['https://arbiscan.io/']
    }
  };

  return {
    // State
    account,
    chainId,
    balance,
    isConnecting,
    error,
    provider,
    isConnected: !!account,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    
    // Actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    addNetwork,
    sendTransaction,
    signMessage,
    
    // Utils
    networks,
    getAccountInfo
  };
};

export default useWallet;
