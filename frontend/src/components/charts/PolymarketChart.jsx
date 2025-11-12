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

    // Clear canvas and fill with background - white
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
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
    
    // Use reasonable range with moderate padding (like Polymarket)
    const actualMinPrice = Math.min(...allPrices);
    const actualMaxPrice = Math.max(...allPrices);
    const actualRange = actualMaxPrice - actualMinPrice;
    // Use 2% padding for smoother display, but ensure at least 5% range for visibility
    const pricePadding = Math.max(actualRange * 0.02, Math.max(2.5, (100 - actualRange) / 2));
    const minPrice = Math.max(0, actualMinPrice - pricePadding);
    const maxPrice = Math.min(100, actualMaxPrice + pricePadding);
    const priceRange = maxPrice - minPrice;

    // Draw grid lines - ultra-subtle (Polymarket style)
    ctx.strokeStyle = '#f9fafb';
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
    
    // Draw crosshair on hover (Polymarket style)
    if (hoveredPoint) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(hoveredPoint.x, padding);
      ctx.lineTo(hoveredPoint.x, height - padding);
      ctx.moveTo(padding, hoveredPoint.y);
      ctx.lineTo(width - padding, hoveredPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
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
      
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(16, 185, 129, 0.15)';
      ctx.shadowBlur = 3;
      
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
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        // White inner dot for contrast
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw price label next to the line endpoint - Polymarket style
        const priceInCents = sortedYesHistory[sortedYesHistory.length - 1].price * 100;
        const priceLabel = `${formatPrice(priceInCents)}%`;
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(priceLabel, lastPoint.x + 10, lastPoint.y + 4);
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
      
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.15)';
      ctx.shadowBlur = 3;
      
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
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        // White inner dot for contrast
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw price label next to the line endpoint - Polymarket style
        const priceInCents = sortedNoHistory[sortedNoHistory.length - 1].price * 100;
        const priceLabel = `${formatPrice(priceInCents)}%`;
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(priceLabel, lastPoint.x + 10, lastPoint.y + 4);
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
    ctx.fillStyle = '#6b7280';
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
    ctx.fillStyle = '#6b7280';
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
    
    if (x >= padding && x <= rect.width - padding && y >= padding && y <= rect.height - padding) {
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
        
        setHoveredPoint({
          yesPrice: closestYes.price * 100, // Convert to cents - use ACTUAL database price
          noPrice: closestNo.price * 100, // Convert to cents - use ACTUAL database price
          timestamp: closestYes.timestamp, // Use YES timestamp
          x: x,
          y: y
        });
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
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 w-full">
      {/* Chart Header - Polymarket Style */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
        <div className="flex items-center space-x-4 sm:space-x-8 flex-wrap gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm flex-shrink-0"></div>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide">YES</span>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              {formatPrice(currentYesPrice)}%
            </div>
            {yesPriceChange !== 0 && (
              <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs sm:text-sm ${yesPriceChange >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span className="font-semibold">
                  {yesPriceChange >= 0 ? '↗' : '↘'} {yesPriceChange >= 0 ? '+' : ''}{yesPriceChange.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              {formatPrice(currentNoPrice)}%
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide">NO</span>
            <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm flex-shrink-0"></div>
            {noPriceChange !== 0 && (
              <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs sm:text-sm ${noPriceChange >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span className="font-semibold">
                  {noPriceChange >= 0 ? '↗' : '↘'} {noPriceChange >= 0 ? '+' : ''}{noPriceChange.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Time Range Selector - Polymarket Style - Responsive */}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {ranges.map((range) => (
            <button
              key={range.value}
              onClick={() => onRangeChange(range.value)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded transition-all ${
                selectedRange === range.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>


      {/* Chart Canvas - Clean Background (Polymarket style) - Responsive */}
      <div className="relative bg-white rounded-lg border border-gray-100 overflow-hidden w-full">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          style={{ height: `${height}px`, width: '100%', display: 'block' }}
        />
        
        {/* Hover Tooltip - Enhanced Polymarket Style */}
        {hoveredPoint && (
          <div
            className="absolute bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm pointer-events-none z-20 shadow-xl border border-gray-700"
            style={{
              left: hoveredPoint.x + 15,
              top: hoveredPoint.y - 70,
              transform: hoveredPoint.x > 400 ? 'translateX(-100%)' : 'none'
            }}
          >
            {hoveredPoint.yesPrice !== undefined && hoveredPoint.noPrice !== undefined ? (
              <>
                <div className="flex items-center space-x-2.5 mb-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-sm"></div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">YES</span>
                  <span className="font-bold text-base">{formatPrice(hoveredPoint.yesPrice)}%</span>
                </div>
                <div className="flex items-center space-x-2.5 mb-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm"></div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">NO</span>
                  <span className="font-bold text-base">{formatPrice(hoveredPoint.noPrice)}%</span>
                </div>
                <div className="text-gray-500 text-xs pt-2 border-t border-gray-700 mt-2 font-medium">
                  {formatTime(hoveredPoint.timestamp)}
                </div>
              </>
            ) : (
              <>
                <div className="font-bold text-base">{formatPrice(hoveredPoint.price)}%</div>
                <div className="text-gray-400 text-xs mt-1">{formatTime(hoveredPoint.timestamp)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PolymarketChart;
