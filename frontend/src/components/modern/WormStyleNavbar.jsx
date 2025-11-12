import React from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';

const WormStyleNavbar = () => {
  const history = useHistory();
  const { account, isConnected, connectWallet, isConnecting } = useWeb3();

  const handleCreateClick = () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    history.push('/admin/create-market');
  };

  const handleConnectClick = () => {
    if (isConnected && account) {
      history.push(`/user/${account}`);
    } else {
      connectWallet();
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center" style={{ height: '87px' }}>
          {/* Logo */}
          <button
            onClick={() => history.push('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
              <span className="text-2xl font-bold text-white"></span>
          </button>

          {/* Right side buttons */}
          <div className="flex items-center gap-3">
            {/* Create button */}
            <button
              onClick={handleCreateClick}
              disabled={isConnecting}
              className="relative flex items-center justify-center text-white rounded-full transition-all font-space-grotesk font-medium overflow-hidden"
              style={{ 
                width: '100px', 
                height: '43.19px',
                fontSize: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <span>Create</span>
            </button>

            {/* Connect/Account button */}
            <button
              onClick={handleConnectClick}
              disabled={isConnecting}
              className="px-6 bg-[#171717] hover:bg-[#1a1a1a] text-white rounded-full transition-all font-space-grotesk font-bold border border-white/10 shadow-sm"
              style={{
                height: '48px',
                fontSize: '15.5px',
                lineHeight: '1.548em'
              }}
            >
              {isConnecting ? (
                'Connecting...'
              ) : isConnected && account ? (
                `${account.slice(0, 6)}...${account.slice(-4)}`
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default WormStyleNavbar;

