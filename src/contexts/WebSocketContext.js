// contexts/WebSocketContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [websocket, setWebsocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [messageQueue, setMessageQueue] = useState([]);
  const [messageHandlers, setMessageHandlers] = useState(new Map());
  
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const getWebSocketUrl = () => {
    if (process.env.NODE_ENV === 'development') {
      return 'ws://localhost:8080';
    }
    return `wss://${window.location.host}`;
  };

  const registerMessageHandler = (messageType, handler) => {
    setMessageHandlers(prev => new Map(prev).set(messageType, handler));
  };

  const unregisterMessageHandler = (messageType) => {
    setMessageHandlers(prev => {
      const newHandlers = new Map(prev);
      newHandlers.delete(messageType);
      return newHandlers;
    });
  };

  const clearAllIntervals = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const startHeartbeat = (ws) => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Start new heartbeat
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'ping', 
          timestamp: Date.now() 
        }));
      }
    }, 30000); // Every 30 seconds
  };

  const flushMessageQueue = (ws) => {
    if (messageQueue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      console.log(`📤 Flushing ${messageQueue.length} queued messages`);
      messageQueue.forEach(message => {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('❌ Error sending queued message:', error);
        }
      });
      setMessageQueue([]);
    }
  };

  const connectWebSocket = () => {
    try {
      setLastError(null);
      const ws = new WebSocket(getWebSocketUrl());
      
      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setWebsocket(ws);
        
        // Start heartbeat
        startHeartbeat(ws);
        
        // Identify as web client
        ws.send(JSON.stringify({
          type: 'identify',
          clientType: 'web',
          clientId: `web_${Date.now()}`
        }));

        // Flush any queued messages
        flushMessageQueue(ws);
      };
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setWebsocket(null);
        clearAllIntervals();

        // Auto-reconnect after delay (with exponential backoff)
        if (reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, delay);
        } else {
          setConnectionStatus('failed');
          setLastError('Max reconnection attempts reached');
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        setLastError(error.message || 'Connection error occurred');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          
          // Call registered handler if exists
          const handler = messageHandlers.get(data.type);
          if (handler) {
            handler(data);
          }
          
          // Default handlers
          switch (data.type) {
            case 'connection_established':
              console.log('✅ Server connection confirmed');
              break;
            case 'file_received':
              console.log('📁 File received notification:', data.filename);
              // You could add a toast notification here
              break;
            case 'mission_status':
              console.log('🎯 Mission status update:', data);
              break;
            case 'pong':
              console.log('💓 Heartbeat acknowledged');
              break;
            case 'error':
              console.error('🚨 Server error:', data.message);
              setLastError(data.message);
              break;
            default:
              console.log('📨 Unhandled message type:', data.type);
              break;
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          setLastError('Failed to parse server message');
        }
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      setConnectionStatus('error');
      setLastError(error.message);
    }
  };

  const disconnectWebSocket = () => {
    clearAllIntervals();
    setReconnectAttempts(5); // Prevent auto-reconnect
    setMessageQueue([]);
    
    if (websocket) {
      websocket.close(1000, 'User initiated disconnect');
      setWebsocket(null);
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const sendMessage = (message) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      try {
        websocket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('❌ Error sending message:', error);
        setLastError('Failed to send message');
        return false;
      }
    } else {
      // Queue message for when connection resumes
      setMessageQueue(prev => [...prev, message]);
      console.warn('⚠️ Message queued - WebSocket not connected');
      return false;
    }
  };

  const reconnect = () => {
    console.log('🔄 Manual reconnection initiated');
    setReconnectAttempts(0);
    setConnectionStatus('reconnecting');
    setLastError(null);
    clearAllIntervals();
    
    if (websocket) {
      websocket.close(1000, 'Reconnecting');
    }
    
    setTimeout(connectWebSocket, 1000);
  };

  const getQueueLength = () => messageQueue.length;

  const clearMessageQueue = () => {
    setMessageQueue([]);
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      disconnectWebSocket();
    };
  }, []);

  // Effect to flush queue when connection is restored
  useEffect(() => {
    if (isConnected && websocket) {
      flushMessageQueue(websocket);
    }
  }, [isConnected, websocket]);

  const value = {
    websocket,
    isConnected,
    connectionStatus,
    reconnectAttempts,
    lastError,
    sendMessage,
    reconnect,
    disconnectWebSocket,
    registerMessageHandler,
    unregisterMessageHandler,
    queueMessage: sendMessage, // alias for clarity
    getQueueLength,
    clearMessageQueue
  };

  return React.createElement(
    WebSocketContext.Provider,
    { value: value },
    children
  );
};