import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useWeb3 } from '../../hooks/useWeb3';

const ADMIN_ADDRESSES = [
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat account #0
  // Add more admin addresses here
].map(addr => addr.toLowerCase());

const AdminLogin = () => {
  const history = useHistory();
  const { account, isConnected } = useWeb3();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simple admin authentication
      const adminUsers = [
        { username: 'admin', password: 'admin123' },
        { username: 'administrator', password: 'admin' }
      ];

      const isValidUser = adminUsers.find(
        user => user.username === credentials.username && user.password === credentials.password
      );

      if (isValidUser) {
        // Set admin session
        localStorage.setItem('usertype', 'admin');
        localStorage.setItem('username', credentials.username);
        localStorage.setItem('isAdminLoggedIn', 'true');
        
        toast.success('Admin login successful!');
        
        // Redirect manually after login
        setTimeout(() => {
          history.push('/admin/pending');
        }, 1000);
      } else {
        toast.error('Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check wallet-based admin (NO AUTO-REDIRECT - prevents loops)
  const isWalletAdmin = isConnected && account && ADMIN_ADDRESSES.includes(account?.toLowerCase() || '');

  // If wallet is admin, show button to navigate (NO AUTO-REDIRECT)
  if (isWalletAdmin) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 py-12" style={{ fontFamily: "'Clash Grotesk Variable', sans-serif" }}>
        <div className="max-w-md w-full text-center">
          <div className="glass-card rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#FFE600] to-yellow-400 rounded-full mb-4">
              <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-white mb-2">Admin Access Granted</h1>
            <p className="text-gray-300 mb-6">Your wallet is authorized for admin access.</p>
            <button
              onClick={() => history.push('/admin/pending')}
              className="w-full bg-[#FFE600] text-black py-3 rounded-full hover:bg-yellow-400 transition-all font-semibold mb-4"
            >
              Go to Admin Panel
            </button>
            <button
              onClick={() => history.push('/')}
              className="text-sm text-gray-300 hover:text-white font-medium"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show login form for everyone else
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 py-12" style={{ fontFamily: "'Clash Grotesk Variable', sans-serif" }}>
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#FFE600] to-yellow-400 rounded-full mb-4">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">Admin Panel</h1>
          <p className="text-gray-300">Connect your admin wallet or sign in with credentials</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                placeholder="Enter admin username"
                className="w-full px-4 py-3 rounded-[12px] text-white placeholder-gray-500"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-[12px] text-white placeholder-gray-500"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
                required
                autoComplete="current-password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFE600] text-black py-3 rounded-full hover:bg-yellow-400 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Info Section */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-[#FFE600] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-gray-300">
                <p className="font-medium text-white mb-1">Default Credentials</p>
                <p className="text-xs">Username: <span className="font-mono font-medium">admin</span></p>
                <p className="text-xs">Password: <span className="font-mono font-medium">admin123</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => history.push('/')}
            className="text-sm text-gray-300 hover:text-white font-medium"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
