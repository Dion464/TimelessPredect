import React, { useEffect, useRef, useState } from 'react';

const PriceChart = ({ priceHistory, marketId, height = 300 }) => {
  const canvasRef = useRef(null);
  const [timeframe, setTimeframe] = useState('24h');

  // Filter data based on timeframe
  const getFilteredData = () => {
    if (!priceHistory || priceHistory.length === 0) return [];

    const now = Date.now();
    let cutoff;

    switch (timeframe) {
      case '1h':
        cutoff = now - (60 * 60 * 1000);
        break;
      case '6h':
        cutoff = now - (6 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoff = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = now - (24 * 60 * 60 * 1000);
    }

    return priceHistory.filter(point => point.timestamp >= cutoff);
  };

  // Draw the chart
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const data = getFilteredData();

    if (data.length === 0) {
      // Draw empty state
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Set up dimensions
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find min/max values
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 0.1; // Avoid division by zero

    // Draw grid lines
    ctx.strokeStyle = '#F3F4F6';
    ctx.lineWidth = 1;

    // Horizontal grid lines (price levels)
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * chartHeight / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();

      // Price labels
      const price = maxPrice - (i * priceRange / 5);
      ctx.fillStyle = '#6B7280';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${(price * 100).toFixed(0)}¢`, padding - 5, y + 4);
    }

    // Vertical grid lines (time)
    const timePoints = 6;
    for (let i = 0; i <= timePoints; i++) {
      const x = padding + (i * chartWidth / timePoints);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();

      // Time labels
      if (data.length > 0) {
        const timeIndex = Math.floor((i / timePoints) * (data.length - 1));
        const timestamp = data[timeIndex]?.timestamp;
        if (timestamp) {
          const time = new Date(timestamp);
          let label;
          
          if (timeframe === '1h' || timeframe === '6h') {
            label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            label = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }

          ctx.fillStyle = '#6B7280';
          ctx.font = '12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(label, x, canvas.height - 10);
        }
      }
    }

    // Draw price line
    if (data.length > 1) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw area under the line
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.lineTo(padding + chartWidth, padding + chartHeight);
      ctx.lineTo(padding, padding + chartHeight);
      ctx.closePath();
      ctx.fill();

      // Draw current price point
      const lastPoint = data[data.length - 1];
      const lastX = padding + chartWidth;
      const lastY = padding + chartHeight - ((lastPoint.price - minPrice) / priceRange) * chartHeight;

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Current price label
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const priceText = `${(lastPoint.price * 100).toFixed(0)}¢`;
      const textWidth = ctx.measureText(priceText).width;
      const labelX = lastX + 10;
      const labelY = lastY - 10;

      // Price label background
      ctx.fillRect(labelX - 5, labelY - 15, textWidth + 10, 20);
      ctx.strokeRect(labelX - 5, labelY - 15, textWidth + 10, 20);

      // Price label text
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(priceText, labelX, labelY);
    }
  };

  // Set canvas size and draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    drawChart();
  }, [priceHistory, timeframe, height]);

  // Redraw on window resize
  useEffect(() => {
    const handleResize = () => {
      setTimeout(drawChart, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [priceHistory, timeframe]);

  const data = getFilteredData();
  const currentPrice = data[data.length - 1]?.price || 0;
  const previousPrice = data[data.length - 2]?.price || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Price Chart</h3>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">
              {(currentPrice * 100).toFixed(0)}¢
            </span>
            <span className={`text-sm font-medium ${
              priceChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {priceChange >= 0 ? '+' : ''}{(priceChange * 100).toFixed(1)}¢ 
              ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {['1h', '6h', '24h', '7d'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
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

      {/* Chart canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full border border-gray-100 rounded"
          style={{ height: `${height}px` }}
        />
      </div>

      {/* Chart stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-xs text-gray-500">24h High</div>
          <div className="text-sm font-medium">
            {data.length > 0 ? (Math.max(...data.map(d => d.price)) * 100).toFixed(0) : 0}¢
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">24h Low</div>
          <div className="text-sm font-medium">
            {data.length > 0 ? (Math.min(...data.map(d => d.price)) * 100).toFixed(0) : 0}¢
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Volume</div>
          <div className="text-sm font-medium">$0</div>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;

