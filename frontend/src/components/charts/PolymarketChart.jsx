import React, { useEffect, useRef, useState } from 'react';

const DEFAULT_RANGES = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: 'ALL', value: 'all' }
];

const PolymarketChart = ({
  priceHistory = [],
  yesPriceHistory = [],
  noPriceHistory = [],
  currentYesPrice = 0.5,
  currentNoPrice = 0.5,
  height = 300,
  selectedRange = '24h',
  onRangeChange = () => {},
  ranges = DEFAULT_RANGES
}) => {
  const canvasRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const animationRef = useRef(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // Helper function to format prices: show decimals for small values
  const formatPrice = (price) => {
    if (price < 1) return price.toFixed(2);
    if (price < 10) return price.toFixed(1);
    return Math.round(price).toString();
  };

  useEffect(() => {
    // Reset animation when data changes
    setAnimationProgress(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Start animation
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const duration = 1500; // 1.5 second animation
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(progress);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [priceHistory, yesPriceHistory, noPriceHistory, currentYesPrice, currentNoPrice]);

  useEffect(() => {
    drawChart();
  }, [priceHistory, yesPriceHistory, noPriceHistory, currentYesPrice, currentNoPrice, height, animationProgress, hoveredPoint]);

  // Handle window resize for responsive chart
  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      // Debounce resize events
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        drawChart();
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [priceHistory, yesPriceHistory, noPriceHistory, currentYesPrice, currentNoPrice, height, animationProgress]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;
    
    // Store width for tooltip positioning
    setCanvasWidth(width);

    // Clear canvas and fill with background - dark theme like Polymarket
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a1a'; // Dark background
    ctx.fillRect(0, 0, width, height);

    // Use ONLY database price history - no current price additions
    // Only add current price if there's NO database history at all
    // Filter out extreme outliers (likely data errors)
    // Filter out prices below 0.1% (0.001) or above 99.9% (0.999) - these are likely data errors
    // Values like yes_price_bps: 3 (0.03%) are clearly errors and should be excluded
    const now = new Date();
    const filterOutliers = (history) => {
      return history.filter(point => {
        const price = point.price;
        const pricePercent = price * 100;
        // Filter out extreme outliers: prices below 0.1% or above 99.9% are likely data errors
        // This filters out values like yes_price_bps: 3 (0.03%) which are clearly wrong
        return pricePercent >= 0.1 && pricePercent <= 99.9;
      });
    };
    
    let yesHistoryWithCurrent = filterOutliers([...yesPriceHistory]);
    let noHistoryWithCurrent = filterOutliers([...noPriceHistory]);
    
    // Only add current price if there's no database history (fallback for new markets)
    if (yesHistoryWithCurrent.length === 0 && currentYesPrice !== undefined && currentYesPrice !== null && !isNaN(currentYesPrice)) {
      const currentYesDecimal = currentYesPrice / 100; // Convert cents to decimal
      // Only add if reasonable (between 0.1% and 99.9%)
      if (currentYesDecimal >= 0.001 && currentYesDecimal <= 0.999) {
        yesHistoryWithCurrent.push({
          price: currentYesDecimal,
          timestamp: now.toISOString()
        });
      }
    }
    
    if (noHistoryWithCurrent.length === 0 && currentNoPrice !== undefined && currentNoPrice !== null && !isNaN(currentNoPrice)) {
      const currentNoDecimal = currentNoPrice / 100; // Convert cents to decimal
      // Only add if reasonable (between 0.1% and 99.9%)
      if (currentNoDecimal >= 0.001 && currentNoDecimal <= 0.999) {
        noHistoryWithCurrent.push({
          price: currentNoDecimal,
          timestamp: now.toISOString()
        });
      }
    }

    // CRITICAL: Sort by timestamp to ensure proper chronological order
    // This prevents vertical spikes from misordered data points
    const sortByTimestamp = (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    const displayYesHistory = yesHistoryWithCurrent.length > 0 
      ? yesHistoryWithCurrent.sort(sortByTimestamp)
      : (currentYesPrice ? [{ price: currentYesPrice / 100, timestamp: now.toISOString() }] : []);
    const displayNoHistory = noHistoryWithCurrent.length > 0 
      ? noHistoryWithCurrent.sort(sortByTimestamp)
      : (currentNoPrice ? [{ price: currentNoPrice / 100, timestamp: now.toISOString() }] : []);

    // Get price range from database price history ONLY
    // Convert all prices to cents for consistent comparison
    const allPrices = [
      ...priceHistory.map(p => p.price * 100), // Convert decimal to cents
      ...displayYesHistory.map(p => p.price * 100), // Convert decimal to cents
      ...displayNoHistory.map(p => p.price * 100) // Convert decimal to cents
    ].filter(p => p !== undefined && p !== null && !isNaN(p));
    
    if (allPrices.length === 0) {
      // Draw empty state message
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No price data available', width / 2, height / 2);
      return;
    }
    
    // Always use full 0-100% range for accurate positioning
    const minPrice = 0;
    const maxPrice = 100;
    const priceRange = 100;

    // Draw grid lines - ultra-subtle dark theme (Polymarket style)
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    // Horizontal grid lines (price levels) - more subtle
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - 2 * padding) * i / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines (time) - very subtle
    for (let i = 0; i <= 4; i++) {
      const x = padding + (width - 2 * padding) * i / 4;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    // Draw crosshair on hover (Polymarket style) - more visible
    if (hoveredPoint) {
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(hoveredPoint.x, padding);
      ctx.lineTo(hoveredPoint.x, height - padding);
      ctx.moveTo(padding, hoveredPoint.y);
      ctx.lineTo(width - padding, hoveredPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw a large highlight circle at hover point
      // Outer glow
      ctx.fillStyle = 'rgba(255, 230, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(hoveredPoint.x, hoveredPoint.y, 12, 0, 2 * Math.PI);
      ctx.fill();
      
      // Main circle
      ctx.fillStyle = '#FFE600';
      ctx.beginPath();
      ctx.arc(hoveredPoint.x, hoveredPoint.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Inner dot
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(hoveredPoint.x, hoveredPoint.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw YES price line (green) - includes current price from chain
    // Use timestamps for X-axis positioning to show actual time progression
    if (displayYesHistory.length > 0) {
      // Ensure data is sorted by timestamp (safety check)
      const sortedYesHistory = [...displayYesHistory].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const firstTime = new Date(sortedYesHistory[0].timestamp).getTime();
      const lastTime = new Date(sortedYesHistory[sortedYesHistory.length - 1].timestamp).getTime();
      const timeRange = Math.max(lastTime - firstTime, 1); // Avoid division by zero
      
      ctx.strokeStyle = '#FFE600'; // Yellow color like Polymarket
      ctx.lineWidth = 3.5; // Thicker line for better visibility
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255, 230, 0, 0.3)';
      ctx.shadowBlur = 6;
      
      // Calculate all point coordinates first for line drawing
      const points = [];
      
      // Handle single point case separately
      if (sortedYesHistory.length === 1) {
        const point = sortedYesHistory[0];
        const priceInCents = point.price * 100;
        const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
        // Place single point at the right edge (or center if preferred)
        const x = width - padding;
        points.push({ x, y, time: firstTime, price: priceInCents });
      } else {
        // Multiple points: filter to reduce noise - only show meaningful price changes
        const minPriceChange = 0.3; // Minimum 0.3% price change to show
        const minTimeGap = Math.max(timeRange / 200, 5000); // Minimum 0.5% of time range or 5 seconds
        
        for (let i = 0; i < sortedYesHistory.length; i++) {
          const point = sortedYesHistory[i];
          const pointTime = new Date(point.timestamp).getTime();
          const priceInCents = point.price * 100;
          
          // Always include first and last points
          if (i === 0 || i === sortedYesHistory.length - 1) {
            const timePercent = timeRange > 0 ? (pointTime - firstTime) / timeRange : 0;
            const x = padding + (width - 2 * padding) * Math.max(0, Math.min(1, timePercent));
            const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
            points.push({ x, y, time: pointTime, price: priceInCents });
            continue;
          }
          
          // Check time gap from last added point
          const lastPoint = points.length > 0 ? points[points.length - 1] : null;
          if (lastPoint) {
            const timeDiff = pointTime - lastPoint.time;
            if (timeDiff < minTimeGap) {
              continue; // Skip if too close in time
            }
          }
          
          // Check if price changed significantly from last added point
          if (lastPoint) {
            const priceDiff = Math.abs(priceInCents - lastPoint.price);
            if (priceDiff < minPriceChange) {
              continue; // Skip if price change is too small
            }
          }
          
          const timePercent = timeRange > 0 ? (pointTime - firstTime) / timeRange : 0;
          const x = padding + (width - 2 * padding) * Math.max(0, Math.min(1, timePercent));
          const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
          points.push({ x, y, time: pointTime, price: priceInCents });
        }
      }

      if (points.length === 0) return;
      
      // Apply animation progress - only draw up to animated portion
      const visiblePoints = Math.ceil(points.length * animationProgress);
      const animatedPoints = points.slice(0, visiblePoints);

      // Start drawing smooth animated curve using cubic Bezier (Polymarket style)
      if (animatedPoints.length > 0) {
        ctx.beginPath();

        if (animatedPoints.length === 1) {
          // Single point: draw horizontal line from left edge to point
          const point = animatedPoints[0];
          ctx.moveTo(padding, point.y);
          ctx.lineTo(point.x, point.y);
        } else if (animatedPoints.length === 2) {
          // Simple line for 2 points
          ctx.moveTo(animatedPoints[0].x, animatedPoints[0].y);
          ctx.lineTo(animatedPoints[1].x, animatedPoints[1].y);
        } else {
          // Use cubic Bezier curves for smooth interpolation (Polymarket style)
          ctx.moveTo(animatedPoints[0].x, animatedPoints[0].y);
          
          for (let i = 0; i < animatedPoints.length - 1; i++) {
            const p0 = i > 0 ? animatedPoints[i - 1] : animatedPoints[i];
            const p1 = animatedPoints[i];
            const p2 = animatedPoints[i + 1];
            const p3 = i < animatedPoints.length - 2 ? animatedPoints[i + 2] : p2;
            
            // Calculate time differences for proper scaling
            const dt1 = p1.time - p0.time;
            const dt2 = p2.time - p1.time;
            const dt3 = p3.time - p2.time;
            
            // Avoid division by zero
            const safeDt1 = dt1 || dt2 || 1;
            const safeDt2 = dt2 || 1;
            const safeDt3 = dt3 || dt2 || 1;
            
            // Calculate smooth control points using Catmull-Rom style
            // This ensures the curve passes through actual points
            const tension = 0.5; // Higher = smoother curves, less visual noise
            
            // Calculate tangent vectors based on adjacent points
            const m1x = (p2.x - p0.x) / (safeDt1 + safeDt2) * safeDt2;
            const m1y = (p2.y - p0.y) / (safeDt1 + safeDt2) * safeDt2;
            const m2x = (p3.x - p1.x) / (safeDt2 + safeDt3) * safeDt2;
            const m2y = (p3.y - p1.y) / (safeDt2 + safeDt3) * safeDt2;
            
            // Control points for cubic Bezier (ensures smooth curve through p1 to p2)
            const cp1x = p1.x + m1x * tension;
            const cp1y = p1.y + m1y * tension;
            const cp2x = p2.x - m2x * tension;
            const cp2y = p2.y - m2y * tension;
            
            // Use cubic Bezier curve for smooth transition
            ctx.bezierCurveTo(
              cp1x, cp1y,
              cp2x, cp2y,
              p2.x, p2.y
            );
          }
        }
        
        ctx.shadowBlur = 0; // Reset shadow after line
        ctx.stroke();
      }
      
      // Draw a highlight dot on the current/animated price (last visible point) - Polymarket style
      if (animatedPoints.length > 0) {
        const lastPoint = animatedPoints[animatedPoints.length - 1];
        
        // Outer glow
        ctx.fillStyle = 'rgba(255, 230, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        // Main dot
        ctx.fillStyle = '#FFE600'; // Yellow
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 7, 0, 2 * Math.PI);
        ctx.fill();
        
        // Dark inner dot for contrast
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw price label next to the line endpoint - Polymarket style
        const priceInCents = sortedYesHistory[sortedYesHistory.length - 1].price * 100;
        const priceLabel = `Yes ${formatPrice(priceInCents)}¢`;
        ctx.fillStyle = '#FFE600'; // Yellow
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(priceLabel, lastPoint.x + 15, lastPoint.y + 5);
      }
    }

    // Draw NO price line (red) - includes current price from chain
    // Use timestamps for X-axis positioning to show actual time progression
    if (displayNoHistory.length > 0) {
      // Ensure data is sorted by timestamp (safety check)
      const sortedNoHistory = [...displayNoHistory].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const firstTime = new Date(sortedNoHistory[0].timestamp).getTime();
      const lastTime = new Date(sortedNoHistory[sortedNoHistory.length - 1].timestamp).getTime();
      const timeRange = Math.max(lastTime - firstTime, 1); // Avoid division by zero
      
      ctx.strokeStyle = '#ef4444'; // Red color for No line
      ctx.lineWidth = 3.5; // Thicker line for better visibility
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.3)';
      ctx.shadowBlur = 6;
      
      // Calculate all point coordinates first for line drawing
      const points = [];
      
      // Handle single point case separately
      if (sortedNoHistory.length === 1) {
        const point = sortedNoHistory[0];
        const priceInCents = point.price * 100;
        const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
        // Place single point at the right edge (or center if preferred)
        const x = width - padding;
        points.push({ x, y, time: firstTime, price: priceInCents });
      } else {
        // Multiple points: filter to reduce noise - only show meaningful price changes
        const minPriceChange = 0.3; // Minimum 0.3% price change to show
        const minTimeGap = Math.max(timeRange / 200, 5000); // Minimum 0.5% of time range or 5 seconds
        
        for (let i = 0; i < sortedNoHistory.length; i++) {
          const point = sortedNoHistory[i];
          const pointTime = new Date(point.timestamp).getTime();
          const priceInCents = point.price * 100;
          
          // Always include first and last points
          if (i === 0 || i === sortedNoHistory.length - 1) {
            const timePercent = timeRange > 0 ? (pointTime - firstTime) / timeRange : 0;
            const x = padding + (width - 2 * padding) * Math.max(0, Math.min(1, timePercent));
            const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
            points.push({ x, y, time: pointTime, price: priceInCents });
            continue;
          }
          
          // Check time gap from last added point
          const lastPoint = points.length > 0 ? points[points.length - 1] : null;
          if (lastPoint) {
            const timeDiff = pointTime - lastPoint.time;
            if (timeDiff < minTimeGap) {
              continue; // Skip if too close in time
            }
          }
          
          // Check if price changed significantly from last added point
          if (lastPoint) {
            const priceDiff = Math.abs(priceInCents - lastPoint.price);
            if (priceDiff < minPriceChange) {
              continue; // Skip if price change is too small
            }
          }
          
          const timePercent = timeRange > 0 ? (pointTime - firstTime) / timeRange : 0;
          const x = padding + (width - 2 * padding) * Math.max(0, Math.min(1, timePercent));
          const y = padding + (height - 2 * padding) * (1 - (priceInCents - minPrice) / priceRange);
          points.push({ x, y, time: pointTime, price: priceInCents });
        }
      }

      if (points.length === 0) return;
      
      // Apply animation progress - only draw up to animated portion
      const visiblePoints = Math.ceil(points.length * animationProgress);
      const animatedPoints = points.slice(0, visiblePoints);

      // Start drawing smooth animated curve using cubic Bezier (Polymarket style)
      if (animatedPoints.length > 0) {
        ctx.beginPath();

        if (animatedPoints.length === 1) {
          // Single point: draw horizontal line from left edge to point
          const point = animatedPoints[0];
          ctx.moveTo(padding, point.y);
          ctx.lineTo(point.x, point.y);
        } else if (animatedPoints.length === 2) {
          // Simple line for 2 points
          ctx.moveTo(animatedPoints[0].x, animatedPoints[0].y);
          ctx.lineTo(animatedPoints[1].x, animatedPoints[1].y);
        } else {
          // Use cubic Bezier curves for smooth interpolation (Polymarket style)
          ctx.moveTo(animatedPoints[0].x, animatedPoints[0].y);
          
          for (let i = 0; i < animatedPoints.length - 1; i++) {
            const p0 = i > 0 ? animatedPoints[i - 1] : animatedPoints[i];
            const p1 = animatedPoints[i];
            const p2 = animatedPoints[i + 1];
            const p3 = i < animatedPoints.length - 2 ? animatedPoints[i + 2] : p2;
            
            // Calculate time differences for proper scaling
            const dt1 = p1.time - p0.time;
            const dt2 = p2.time - p1.time;
            const dt3 = p3.time - p2.time;
            
            // Avoid division by zero
            const safeDt1 = dt1 || dt2 || 1;
            const safeDt2 = dt2 || 1;
            const safeDt3 = dt3 || dt2 || 1;
            
            // Calculate smooth control points using Catmull-Rom style
            // This ensures the curve passes through actual points
            const tension = 0.5; // Higher = smoother curves, less visual noise
            
            // Calculate tangent vectors based on adjacent points
            const m1x = (p2.x - p0.x) / (safeDt1 + safeDt2) * safeDt2;
            const m1y = (p2.y - p0.y) / (safeDt1 + safeDt2) * safeDt2;
            const m2x = (p3.x - p1.x) / (safeDt2 + safeDt3) * safeDt2;
            const m2y = (p3.y - p1.y) / (safeDt2 + safeDt3) * safeDt2;
            
            // Control points for cubic Bezier (ensures smooth curve through p1 to p2)
            const cp1x = p1.x + m1x * tension;
            const cp1y = p1.y + m1y * tension;
            const cp2x = p2.x - m2x * tension;
            const cp2y = p2.y - m2y * tension;
            
            // Use cubic Bezier curve for smooth transition
            ctx.bezierCurveTo(
              cp1x, cp1y,
              cp2x, cp2y,
              p2.x, p2.y
            );
          }
        }
        
        ctx.shadowBlur = 0; // Reset shadow after line
        ctx.stroke();
        
        // Draw a highlight dot on the current/animated price (last visible point) - Polymarket style
        const lastPoint = animatedPoints[animatedPoints.length - 1];
        
        // Outer glow
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        // Main dot
        ctx.fillStyle = '#ef4444'; // Red
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 7, 0, 2 * Math.PI);
        ctx.fill();
        
        // White inner dot for contrast
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw price label next to the line endpoint - Polymarket style
        const priceInCents = sortedNoHistory[sortedNoHistory.length - 1].price * 100;
        const priceLabel = `No ${formatPrice(priceInCents)}¢`;
        ctx.fillStyle = '#ef4444'; // Red
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(priceLabel, lastPoint.x + 15, lastPoint.y + 5);
      }
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

    // Draw percentage labels - Y-axis on the right (Polymarket style)
    ctx.fillStyle = '#888888'; // Lighter gray for dark background
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    
    // Draw 6 labels (0-5) to match Polymarket's style
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (priceRange * i / 5);
      const y = padding + (height - 2 * padding) * i / 5;
      const percentage = Math.round(price);
      // Position labels on the right side, aligned with grid lines
      ctx.fillText(`${percentage}%`, width - padding + 12, y + 4);
    }

    // Draw time labels - at bottom (Polymarket style)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888888'; // Lighter gray for dark background
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    if (displayYesHistory.length > 0 || displayNoHistory.length > 0) {
      const dataToUse = displayYesHistory.length > 0 ? displayYesHistory : displayNoHistory;
      const firstTimestamp = new Date(dataToUse[0].timestamp).getTime();
      const lastTimestamp = new Date(dataToUse[dataToUse.length - 1].timestamp).getTime();
      const timeRange = lastTimestamp - firstTimestamp;
      
      // Show 4-5 labels for cleaner look - Polymarket style
      const labelCount = Math.min(4, Math.max(2, Math.floor(timeRange / (1000 * 60 * 60 * 6)))); // Show label every ~6 hours or less
      
      for (let i = 0; i <= labelCount; i++) {
        const x = padding + (width - 2 * padding) * i / labelCount;
        const timePercent = i / labelCount;
        const pointTime = firstTimestamp + (timeRange * timePercent);
        const pointDate = new Date(pointTime);
        
        // Format time label - Polymarket style
        const now = Date.now();
        const diffMs = now - pointTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;
        
        let timeLabel;
        if (diffHours < 0.5) {
          timeLabel = 'Now';
        } else if (diffHours < 24) {
          timeLabel = `${Math.round(diffHours)}h`;
        } else if (diffDays < 7) {
          timeLabel = `${Math.round(diffDays)}d`;
        } else {
          timeLabel = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        ctx.fillText(timeLabel, x, height - 10);
      }
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
    
    // Debug: Log mouse position
    console.log('Mouse move:', { x, y, hasYesData: yesPriceHistory.length, hasNoData: noPriceHistory.length });
    
    // Allow hover anywhere on the chart, not just within padding
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      // Use the same filtering logic as drawChart
      const filterOutliers = (history) => {
        return history.filter(point => {
          const price = point.price;
          const pricePercent = price * 100;
          // Filter out extreme outliers: prices below 0.1% or above 99.9% are likely data errors
          // This filters out values like yes_price_bps: 3 (0.03%) which are clearly wrong
          return pricePercent >= 0.1 && pricePercent <= 99.9;
        });
      };
      
      const sortByTimestamp = (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      
      // Filter and sort YES history (same as drawChart)
      let yesFiltered = filterOutliers([...yesPriceHistory]).sort(sortByTimestamp);
      let noFiltered = filterOutliers([...noPriceHistory]).sort(sortByTimestamp);
      
      // Find the actual data point closest to the X position based on timestamp
      if (yesFiltered.length > 0 && noFiltered.length > 0) {
        const firstYesTime = new Date(yesFiltered[0].timestamp).getTime();
        const lastYesTime = new Date(yesFiltered[yesFiltered.length - 1].timestamp).getTime();
        const yesTimeRange = Math.max(lastYesTime - firstYesTime, 1);
        
        const firstNoTime = new Date(noFiltered[0].timestamp).getTime();
        const lastNoTime = new Date(noFiltered[noFiltered.length - 1].timestamp).getTime();
        const noTimeRange = Math.max(lastNoTime - firstNoTime, 1);
        
        // Calculate time position based on X coordinate
        const xPercent = (x - padding) / chartWidth;
        const hoverTimeYes = firstYesTime + (yesTimeRange * xPercent);
        const hoverTimeNo = firstNoTime + (noTimeRange * xPercent);
        
        // Find the closest actual data point (not interpolated)
        const findClosestPoint = (history, targetTime) => {
          let closest = history[0];
          let minDiff = Math.abs(new Date(history[0].timestamp).getTime() - targetTime);
          
          for (let i = 1; i < history.length; i++) {
            const diff = Math.abs(new Date(history[i].timestamp).getTime() - targetTime);
            if (diff < minDiff) {
              minDiff = diff;
              closest = history[i];
            }
          }
          return closest;
        };
        
        const closestYes = findClosestPoint(yesFiltered, hoverTimeYes);
        const closestNo = findClosestPoint(noFiltered, hoverTimeNo);
        
        const tooltipData = {
          yesPrice: closestYes.price * 100, // Convert to cents - use ACTUAL database price
          noPrice: closestNo.price * 100, // Convert to cents - use ACTUAL database price
          timestamp: closestYes.timestamp, // Use YES timestamp
          x: x,
          y: y
        };
        
        console.log('Setting tooltip:', tooltipData);
        setHoveredPoint(tooltipData);
      } else if (priceHistory.length > 0) {
        // Fallback to single price history
        const sortedHistory = [...priceHistory].sort(sortByTimestamp);
        const firstTime = new Date(sortedHistory[0].timestamp).getTime();
        const lastTime = new Date(sortedHistory[sortedHistory.length - 1].timestamp).getTime();
        const timeRange = Math.max(lastTime - firstTime, 1);
        const xPercent = (x - padding) / chartWidth;
        const hoverTime = firstTime + (timeRange * xPercent);
        
        const findClosestPoint = (history, targetTime) => {
          let closest = history[0];
          let minDiff = Math.abs(new Date(history[0].timestamp).getTime() - targetTime);
          for (let i = 1; i < history.length; i++) {
            const diff = Math.abs(new Date(history[i].timestamp).getTime() - targetTime);
            if (diff < minDiff) {
              minDiff = diff;
              closest = history[i];
            }
          }
          return closest;
        };
        
        const closest = findClosestPoint(sortedHistory, hoverTime);
        setHoveredPoint({
          price: closest.price * 100, // Convert to cents - use ACTUAL database price
          timestamp: closest.timestamp,
          x: x,
          y: y
        });
      }
    } else {
      setHoveredPoint(null);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate price change: from first historical point to current price from chain
  const yesPriceChange = (yesPriceHistory.length > 0 && currentYesPrice !== undefined && currentYesPrice !== null)
    ? (((currentYesPrice - (yesPriceHistory[0].price * 100)) / (yesPriceHistory[0].price * 100)) * 100)
    : 0;
    
  const noPriceChange = (noPriceHistory.length > 0 && currentNoPrice !== undefined && currentNoPrice !== null)
    ? (((currentNoPrice - (noPriceHistory[0].price * 100)) / (noPriceHistory[0].price * 100)) * 100)
    : 0;


  return (
    <div className="relative bg-[#1a1a1a] rounded-xl border border-white/10 shadow-sm p-4 sm:p-6 w-full">
      {/* Chart Header - Polymarket Style */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
        <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8 flex-wrap gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[#FFE600] rounded-full shadow-sm flex-shrink-0"></div>
            <span className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide">YES</span>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              {formatPrice(currentYesPrice)}¢
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              {formatPrice(currentNoPrice)}¢
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide">NO</span>
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[#ef4444] rounded-full shadow-sm flex-shrink-0"></div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time Range Selector - Polymarket Style - Responsive */}
          <div className="flex items-center space-x-1 bg-white/5 rounded-lg p-1 flex-wrap">
            {ranges.map((range) => (
              <button
                key={range.value}
                onClick={() => onRangeChange(range.value)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded transition-all ${
                  selectedRange === range.value
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse chart' : 'Expand chart'}
          >
            <svg 
              className="w-5 h-5 text-gray-400 transition-transform duration-200"
              style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)' }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart Canvas - Clean Background (Polymarket style) - Responsive - Collapsible */}
      {isExpanded && (
        <div className="relative bg-[#1a1a1a] rounded-lg border border-white/5 overflow-hidden w-full">
          <canvas
            ref={canvasRef}
            className="w-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ 
              height: `${height}px`, 
              width: '100%', 
              display: 'block',
              cursor: hoveredPoint ? 'pointer' : 'crosshair'
            }}
          />
        
          {/* Hover Tooltip - Enhanced with better visibility */}
          {hoveredPoint && (
            <div
              className="absolute bg-black text-white px-4 py-3 rounded-xl text-sm pointer-events-none z-50 shadow-2xl border-2 border-[#FFE600]"
              style={{
                left: hoveredPoint.x > canvasWidth - 200 ? hoveredPoint.x - 165 : hoveredPoint.x + 15,
                top: hoveredPoint.y - 90,
                backdropFilter: 'blur(10px)',
                backgroundColor: 'rgba(0, 0, 0, 0.95)'
              }}
            >
              {hoveredPoint.yesPrice !== undefined && hoveredPoint.noPrice !== undefined ? (
                <>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-3 h-3 bg-[#FFE600] rounded-full shadow-lg"></div>
                    <span className="text-gray-300 text-xs uppercase tracking-wider font-semibold">YES</span>
                    <span className="font-bold text-lg text-[#FFE600]">{formatPrice(hoveredPoint.yesPrice)}¢</span>
                  </div>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-3 h-3 bg-[#ef4444] rounded-full shadow-lg"></div>
                    <span className="text-gray-300 text-xs uppercase tracking-wider font-semibold">NO</span>
                    <span className="font-bold text-lg text-[#ef4444]">{formatPrice(hoveredPoint.noPrice)}¢</span>
                  </div>
                  <div className="text-gray-400 text-xs pt-2 border-t border-gray-600 mt-2 font-medium">
                    {formatTime(hoveredPoint.timestamp)}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-lg">{formatPrice(hoveredPoint.price)}¢</div>
                  <div className="text-gray-300 text-xs mt-1">{formatTime(hoveredPoint.timestamp)}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PolymarketChart;
