import React from 'react';

class Web3ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Web3 Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                🔗 Web3 Connection Issue
              </h1>
              <p className="text-gray-600 mb-6">
                There's an issue with the Web3 connection. Please try:
              </p>
              <div className="text-left space-y-3 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-500">1.</span>
                  <span>Make sure MetaMask is connected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-500">2.</span>
                  <span>Switch to Localhost 8545 network</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-500">3.</span>
                  <span>Refresh the page</span>
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full mt-3 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default Web3ErrorBoundary;
