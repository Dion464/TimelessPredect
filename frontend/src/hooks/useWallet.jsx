import { useState, useEffect, useCallback } from 'react';

const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && 
           typeof window.ethereum !== 'undefined' && 
           window.ethereum.isMetaMask;
  }, []);

  // Get current account and chain info
  const getAccountInfo = useCallback(async () => {
    if (!isMetaMaskInstalled()) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setChainId(chainId);
        
        // Get balance
        const balance = await window.ethereum.request({
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
  }, [isMetaMaskInstalled]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        await getAccountInfo();
        setProvider(window.ethereum);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled, getAccountInfo]);

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
    if (!isMetaMaskInstalled()) return;

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

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    // Check if already connected
    getAccountInfo();

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [isMetaMaskInstalled, getAccountInfo, disconnectWallet]);

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
