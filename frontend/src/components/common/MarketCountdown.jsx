import React, { useState, useEffect } from 'react';

const MarketCountdown = ({ endTime, className = '', showLabel = true, variant = 'default' }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (!endTime) {
        setTimeRemaining('No end date');
        return;
      }

      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;

      if (diff <= 0) {
        setIsEnded(true);
        setTimeRemaining('Market Ended');
        return;
      }

      setIsEnded(false);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 7) {
        setTimeRemaining(`${days} days`);
      } else if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // Different variants for different contexts
  const getVariantStyles = () => {
    switch (variant) {
      case 'card':
        // For market cards on home page
        return {
          container: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            isEnded 
              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
              : 'bg-white/10 text-white border border-white/20'
          }`,
          icon: isEnded ? '🔴' : '⏱️',
          label: showLabel ? (isEnded ? '' : 'Ends in ') : ''
        };
      
      case 'badge':
        // Small badge variant
        return {
          container: `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
            isEnded 
              ? 'bg-red-100 text-red-700 border border-red-200' 
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`,
          icon: isEnded ? '⏹️' : '⏰',
          label: ''
        };
      
      case 'detail':
        // For market detail page - larger, more prominent
        return {
          container: `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
            isEnded 
              ? 'bg-red-500/10 text-red-500 border-2 border-red-500/30' 
              : 'bg-[#FFE600]/10 text-[#FFE600] border-2 border-[#FFE600]/30'
          }`,
          icon: isEnded ? '🔴' : '⏳',
          label: showLabel ? (isEnded ? '' : 'Trading ends in ') : ''
        };
      
      default:
        return {
          container: `inline-flex items-center gap-1.5 ${className}`,
          icon: isEnded ? '🔴' : '⏱️',
          label: showLabel ? (isEnded ? '' : 'Ends in ') : ''
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={styles.container}>
      <span>{styles.icon}</span>
      <span>
        {styles.label}{timeRemaining}
      </span>
    </div>
  );
};

export default MarketCountdown;

