import React, { useEffect, useRef, useState } from 'react';

const PolymarketChart = ({ priceHistory = [], yesPriceHistory = [], noPriceHistory = [], currentYesPrice = 0.5, currentNoPrice = 0.5, height = 300 }) => {
  const canvasRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timeframe, setTimeframe] = useState('24H');

  useEffect(() => {
    drawChart();
  }, [priceHistory, yesPriceHistory, noPriceHistory, currentYesPrice, currentNoPrice, height]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || (priceHistory.length === 0 && yesPriceHistory.length === 0 && noPriceHistory.length === 0)) return;

    // Debug logging
    console.log('📊 Chart drawing with data:', {
      priceHistory: priceHistory.length,
      yesPriceHistory: yesPriceHistory.length,
      noPriceHistory: noPriceHistory.length,
      currentYesPrice,
      currentNoPrice,
      yesSample: yesPriceHistory.slice(0, 3),
      noSample: noPriceHistory.slice(0, 3)
    });

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get price range from all price histories
    // Convert all prices to cents for consistent comparison
    const allPrices = [
      ...priceHistory.map(p => p.price * 100), // Convert decimal to cents
      ...yesPriceHistory.map(p => p.price * 100), // Convert decimal to cents
      ...noPriceHistory.map(p => p.price * 100), // Convert decimal to cents
      currentYesPrice,
      currentNoPrice
    ].filter(p => p !== undefined && p !== null && !isNaN(p));
    
    const minPrice = Math.min(...allPrices) * 0.95;
    const maxPrice = Math.max(...allPrices) * 1.05;
    const priceRange = maxPrice - minPrice;

    // Draw grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (price levels)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - 2 * padding) * i / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines (time)
    for (let i = 0; i <= 6; i++) {
      const x = padding + (width - 2 * padding) * i / 6;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw YES price line (green)
    if (yesPriceHistory.length > 1) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();

      yesPriceHistory.forEach((point, index) => {
        const x = padding + (width - 2 * padding) * index / (yesPriceHistory.length - 1);
        const priceInCents = point.price * 100; // Convert decimal to cents
        const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Draw NO price line (red)
    if (noPriceHistory.length > 1) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();

      noPriceHistory.forEach((point, index) => {
        const x = padding + (width - 2 * padding) * index / (noPriceHistory.length - 1);
        const priceInCents = point.price * 100; // Convert decimal to cents
        const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Fallback: Draw single price line if only priceHistory is available
    if (priceHistory.length > 1 && yesPriceHistory.length === 0 && noPriceHistory.length === 0) {
      ctx.strokeStyle = currentYesPrice > currentNoPrice ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();

      priceHistory.forEach((point, index) => {
        const x = padding + (width - 2 * padding) * index / (priceHistory.length - 1);
        const priceInCents = point.price * 100; // Convert decimal to cents
        const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Draw price labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 4; i++) {
      const price = maxPrice - (priceRange * i / 4);
      const y = padding + (height - 2 * padding) * i / 4;
      ctx.fillText(`${Math.round(price)}¢`, padding - 10, y + 4);
    }

    // Draw time labels
    ctx.textAlign = 'center';
    const timeLabels = ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'];
    for (let i = 0; i <= 6; i++) {
      const x = padding + (width - 2 * padding) * i / 6;
      ctx.fillText(timeLabels[i], x, height - 10);
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = 40;
    const chartWidth = rect.width - 2 * padding;
    const chartHeight = rect.height - 2 * padding;
    
    if (x >= padding && x <= rect.width - padding && y >= padding && y <= rect.height - padding) {
      // Calculate data index for both YES and NO histories
      if (yesPriceHistory.length > 0 && noPriceHistory.length > 0) {
        const yesIndex = Math.round((x - padding) / chartWidth * (yesPriceHistory.length - 1));
        const noIndex = Math.round((x - padding) / chartWidth * (noPriceHistory.length - 1));
        
        if (yesIndex >= 0 && yesIndex < yesPriceHistory.length && noIndex >= 0 && noIndex < noPriceHistory.length) {
          setHoveredPoint({
            yesPrice: yesPriceHistory[yesIndex].price * 100, // Convert to cents
            noPrice: noPriceHistory[noIndex].price * 100, // Convert to cents
            timestamp: yesPriceHistory[yesIndex].timestamp,
            x: x,
            y: y
          });
        }
      } else if (priceHistory.length > 0) {
        // Fallback to single price history
        const dataIndex = Math.round((x - padding) / chartWidth * (priceHistory.length - 1));
        if (dataIndex >= 0 && dataIndex < priceHistory.length) {
          setHoveredPoint({
            price: priceHistory[dataIndex].price * 100, // Convert to cents
            timestamp: priceHistory[dataIndex].timestamp,
            x: x,
            y: y
          });
        }
      }
    } else {
      setHoveredPoint(null);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const yesPriceChange = yesPriceHistory.length > 1 
    ? (((yesPriceHistory[yesPriceHistory.length - 1].price * 100) - (yesPriceHistory[0].price * 100)) / (yesPriceHistory[0].price * 100) * 100)
    : 0;
    
  const noPriceChange = noPriceHistory.length > 1 
    ? (((noPriceHistory[noPriceHistory.length - 1].price * 100) - (noPriceHistory[0].price * 100)) / (noPriceHistory[0].price * 100) * 100)
    : 0;

  return (
    <div className="relative">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600">YES</span>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(currentYesPrice)}¢
            </div>
            <div className={`flex items-center space-x-1 ${yesPriceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span className="text-sm font-medium">
                {yesPriceChange >= 0 ? '↗' : '↘'} {yesPriceChange >= 0 ? '+' : ''}{yesPriceChange.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600">NO</span>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(currentNoPrice)}¢
            </div>
            <div className={`flex items-center space-x-1 ${noPriceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span className="text-sm font-medium">
                {noPriceChange >= 0 ? '↗' : '↘'} {noPriceChange >= 0 ? '+' : ''}{noPriceChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['1H', '6H', '24H', '7D'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={height}
          className="w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          style={{ height: `${height}px` }}
        />
        
        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg text-sm pointer-events-none z-10 shadow-lg"
            style={{
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 60,
              transform: hoveredPoint.x > 400 ? 'translateX(-100%)' : 'none'
            }}
          >
            {hoveredPoint.yesPrice !== undefined && hoveredPoint.noPrice !== undefined ? (
              <>
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">YES:</span>
                  <span className="font-medium">{Math.round(hoveredPoint.yesPrice)}¢</span>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-gray-300">NO:</span>
                  <span className="font-medium">{Math.round(hoveredPoint.noPrice)}¢</span>
                </div>
                <div className="text-gray-400 text-xs pt-1 border-t border-gray-700 mt-1">
                  {formatTime(hoveredPoint.timestamp)}
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">{Math.round(hoveredPoint.price)}¢</div>
                <div className="text-gray-300">{formatTime(hoveredPoint.timestamp)}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chart Legend */}
      <div className="flex items-center justify-center mt-4 space-x-6 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Yes Price</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>No Price</span>
        </div>
      </div>
    </div>
  );
};

export default PolymarketChart;
