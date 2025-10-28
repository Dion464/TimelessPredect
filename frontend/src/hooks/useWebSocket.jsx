import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocket = (url, options = {}) => {
  const [socket, setSocket] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [readyState, setReadyState] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Connecting');
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = options.maxReconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setReadyState(1);
        setConnectionStatus('Connected');
        reconnectAttempts.current = 0;
        
        if (options.onOpen) {
          options.onOpen();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          if (options.onMessage) {
            options.onMessage(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setReadyState(3);
        setConnectionStatus('Disconnected');
        
        if (options.onClose) {
          options.onClose(event);
        }

        // Auto-reconnect logic
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setConnectionStatus(`Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setConnectionStatus('Connection Failed');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
        
        if (options.onError) {
          options.onError(error);
        }
      };

      setSocket(ws);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('Connection Failed');
    }
  }, [url, options, maxReconnectAttempts, reconnectInterval]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close();
    }
  }, [socket]);

  return {
    socket,
    lastMessage,
    readyState,
    connectionStatus,
    sendMessage,
    disconnect,
    reconnect: connect
  };
};

export default useWebSocket;

