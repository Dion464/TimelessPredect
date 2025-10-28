import React, { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../../helpers/AuthContent';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';

const ModernNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isLoggedIn, username, usertype, logout } = useAuth();
  const { 
    account, 
    isConnected, 
    connectWallet, 
    disconnectWallet, 
    isConnecting, 
    chainId, 
    networkName,
    ethBalance
  } = useWeb3();
  const history = useHistory();
  const location = useLocation();

  const navigation = [
    { name: 'Markets', href: '/markets', current: location.pathname === '/markets' },
    { name: 'Portfolio', href: `/user/${username}`, current: location.pathname === `/user/${username}`, requiresAuth: true },
  ];

  const adminNavigation = [
    { name: 'Create Market', href: '/admin/create-market', current: location.pathname === '/admin/create-market' },
    { name: 'Revenue', href: '/admin/revenue', current: location.pathname === '/admin/revenue' },
  ];

  const handleLogin = () => {
    // This would open a login modal or navigate to login page
    history.push('/login');
  };

  const handleLogout = () => {
    logout();
    history.push('/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and primary nav */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <button
                onClick={() => history.push('/')}
                className="text-2xl font-bold text-gray-900 hover:text-gray-700"
              >
                TimelessPredict
              </button>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                if (item.requiresAuth && !isLoggedIn) return null;
                return (
                  <button
                    key={item.name}
                    onClick={() => history.push(item.href)}
                    className={`${
                      item.current
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {item.name}
                  </button>
                );
              })}
              
              {/* Admin Navigation */}
              {(localStorage.getItem('isAdminLoggedIn') === 'true' || usertype === 'admin') && (
                <div className="flex items-center ml-4 pl-4 border-l border-gray-300">
                  <span className="text-xs text-gray-400 font-semibold mr-2">ADMIN</span>
                  {adminNavigation.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => history.push(item.href)}
                      className={`${
                        item.current
                          ? 'border-purple-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ml-2`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {/* Web3 Wallet Connection */}
            {isConnected ? (
              <div className="flex items-center space-x-3">
                        {/* ETH Balance */}
                        <div className="bg-blue-50 px-3 py-1 rounded-full flex items-center space-x-2">
                          <span className="text-sm font-medium text-blue-700">
                            {ethBalance && parseFloat(ethBalance) > 0 ? parseFloat(ethBalance).toFixed(4) : '0.0000'} ETH
                          </span>
                        </div>
                
                {/* Network Badge */}
                <div className="bg-blue-50 px-3 py-1 rounded-full">
                  <span className="text-sm font-medium text-blue-700">
                    {networkName}
                  </span>
                </div>
                
                {/* Wallet Address */}
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {account?.slice(2, 4).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-700 font-mono">
                    {account?.slice(0, 6)}...{account?.slice(-4)}
                  </span>
                </div>
                
                <button
                  onClick={disconnectWallet}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}

            {/* Traditional Auth (Optional - can be removed for pure Web3) */}
            {isLoggedIn ? (
              <>
                <div className="flex items-center space-x-2 border-l pl-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-700">@{username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Sign out
                </button>
              </>
            ) : null}
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <span className="sr-only">Open main menu</span>
              {!isMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              if (item.requiresAuth && !isLoggedIn) return null;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    history.push(item.href);
                    setIsMenuOpen(false);
                  }}
                  className={`${
                    item.current
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
                >
                  {item.name}
                </button>
              );
            })}
            
            {/* Admin Navigation in Mobile */}
            {(localStorage.getItem('isAdminLoggedIn') === 'true' || usertype === 'admin') && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="px-3 py-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Admin</span>
                </div>
                {adminNavigation.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      history.push(item.href);
                      setIsMenuOpen(false);
                    }}
                    className={`${
                      item.current
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                    } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
                  >
                    {item.name}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            {isLoggedIn ? (
              <div className="space-y-1">
                <div className="flex items-center px-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">@{username}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="px-4">
                <button
                  onClick={() => {
                    handleLogin();
                    setIsMenuOpen(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default ModernNavbar;

