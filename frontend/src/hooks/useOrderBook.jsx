import { useState, useEffect, useCallback, useRef } from 'react';
import { useWeb3 } from './useWeb3';

/**
 * Hook for managing order book and WebSocket connection
 */
export function useOrderBook(marketId, outcomeId = 0) {
  const { isConnected, contracts } = useWeb3();
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const WS_URL = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://');

  // Fetch order book from API
  const fetchOrderBook = useCallback(async () => {
    if (!marketId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/api/orders?marketId=${marketId}&outcomeId=${outcomeId}&depth=20`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch order book');
      }
      
      const data = await response.json();
      setOrderBook({
        bids: data.bids || [],
        asks: data.asks || []
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching order book:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, marketId, outcomeId]);

  // Connect WebSocket for real-time updates (optional - falls back to polling)
  useEffect(() => {
    if (!marketId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Try WebSocket connection (only if not in SSR context)
    if (typeof WebSocket !== 'undefined') {
      const connectWebSocket = () => {
        try {
          // Use same origin for WS connection
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsHost = window.location.host;
          const ws = new WebSocket(`${wsProtocol}//${wsHost}`);
          
          ws.onopen = () => {
            console.log('📡 WebSocket connected');
            // Subscribe to order book updates
            ws.send(JSON.stringify({
              type: 'subscribe',
              marketId: marketId.toString(),
              outcomeId: outcomeId.toString()
            }));
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.type === 'orderbook_update') {
                setOrderBook({
                  bids: data.bids || [],
                  asks: data.asks || []
                });
              } else if (data.type === 'subscribed') {
                console.log('✅ Subscribed to order book updates');
              }
            } catch (err) {
              console.error('Error parsing WebSocket message:', err);
            }
          };

          ws.onerror = (error) => {
            console.warn('WebSocket error (falling back to polling):', error);
            // Fall back to polling
            ws.close();
          };

          ws.onclose = () => {
            wsRef.current = null;
            // Only reconnect if not manually closed
            if (marketId) {
              reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
            }
          };

          wsRef.current = ws;
        } catch (err) {
          console.warn('WebSocket not available, using polling:', err);
        }
      };

      connectWebSocket();
    }

    // Fallback: Poll every 5 seconds if WebSocket not available
    const pollInterval = setInterval(fetchOrderBook, 5000);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      clearInterval(pollInterval);
    };
  }, [marketId, outcomeId, fetchOrderBook]);

  // Initial fetch
  useEffect(() => {
    fetchOrderBook();
  }, [fetchOrderBook]);

  return {
    orderBook,
    loading,
    error,
    refetch: fetchOrderBook
  };
}

