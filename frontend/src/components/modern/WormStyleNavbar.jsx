import React from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';

const WormStyleNavbar = () => {
  const history = useHistory();
  const { account, isConnected, connectWallet, isConnecting } = useWeb3();

  const handleCreateClick = () => {
    history.push('/create');
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 min-h-[72px]">
          <button
            onClick={() => history.push('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FFE600] font-bold text-lg">
              PD
            </div>
            <div className="text-left leading-tight">
              <p className="text-white text-lg font-semibold">PolyDegen</p>
              <p className="text-white/50 text-xs tracking-wide uppercase">Prediction Markets</p>
            </div>
          </button>

          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
            <button
              onClick={handleCreateClick}
              disabled={isConnecting}
              className="w-full sm:w-auto px-5 py-2.5 text-sm sm:text-base text-white rounded-full transition-all font-space-grotesk font-medium border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
            >
              Create
            </button>

            <button
              onClick={handleConnectClick}
              disabled={isConnecting}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#171717] hover:bg-[#1a1a1a] text-white rounded-full transition-all font-space-grotesk font-bold border border-white/10 shadow-sm text-sm sm:text-base disabled:opacity-60"
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
