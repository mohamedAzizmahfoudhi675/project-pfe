// contexts/WebSocketContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

/**
 * WebSocketContext - A React context for managing a persistent WebSocket connection.
 *
 * This context provides a shared WebSocket instance and connection state to any component
 * in the application. It handles:
 *   - Automatic connection and reconnection with exponential backoff.
 *   - Heartbeat (ping/pong) to keep the connection alive.
 *   - Message queuing when disconnected.
 *   - Registration of message handlers for specific message types.
 *   - Broadcasting of connection status and errors.
 *
 * Components can use the `useWebSocket` hook to access the connection and send/receive messages.
 *
 * @type {React.Context<Object|null>}
 */
const WebSocketContext = createContext();

/**
 * Custom hook to access the WebSocket context.
 * Must be used within a WebSocketProvider.
 *
 * @returns {Object} The context value containing websocket, isConnected, sendMessage, etc.
 * @throws {Error} If used outside of WebSocketProvider.
 */
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

/**
 * WebSocketProvider - Provider component that wraps the application and provides
 * WebSocket functionality to all children.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that need WebSocket access.
 * @returns {JSX.Element} The provider component.
 */
export const WebSocketProvider = ({ children }) => {
  // ========== STATE ==========
  /** @type {[WebSocket|null, Function]} The current WebSocket instance. */
  const [websocket, setWebsocket] = useState(null);

  /** @type {[boolean, Function]} Whether the WebSocket is currently connected. */
  const [isConnected, setIsConnected] = useState(false);

  /** @type {[string, Function]} Current connection status: 'connected', 'disconnected', 'error', 'reconnecting', 'failed'. */
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  /** @type {[number, Function]} Number of reconnection attempts made (for backoff). */
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  /** @type {[string|null, Function]} The last error message, if any. */
  const [lastError, setLastError] = useState(null);

  /** @type {[Array<Object>, Function]} Queue of messages that were sent while disconnected. */
  const [messageQueue, setMessageQueue] = useState([]);

  /** @type {[Map<string, Function>, Function]} Map of message type handlers registered by components. */
  const [messageHandlers, setMessageHandlers] = useState(new Map());

  // ========== REFS ==========
  /** Ref for the heartbeat interval, to allow clearing. */
  const heartbeatIntervalRef = useRef(null);

  /** Ref for the reconnection timeout, to allow clearing. */
  const reconnectTimeoutRef = useRef(null);

  // ========== HELPER FUNCTIONS ==========
  /**
   * Determines the WebSocket server URL based on environment.
   * In development, uses localhost:8080; in production, uses wss:// current host.
   *
   * @returns {string} The WebSocket URL.
   */
  const getWebSocketUrl = () => {
    if (process.env.NODE_ENV === 'development') {
      return 'ws://localhost:8080';
    }
    return `wss://${window.location.host}`;
  };

  /**
   * Registers a handler for a specific message type.
   * When a message of that type is received, the handler will be called with the parsed message object.
   *
   * @param {string} messageType - The message type to handle (e.g., 'mission_status').
   * @param {Function} handler - Callback function that receives the parsed message.
   */
  const registerMessageHandler = (messageType, handler) => {
    setMessageHandlers(prev => new Map(prev).set(messageType, handler));
  };

  /**
   * Unregisters a previously registered message handler.
   *
   * @param {string} messageType - The message type to remove the handler for.
   */
  const unregisterMessageHandler = (messageType) => {
    setMessageHandlers(prev => {
      const newHandlers = new Map(prev);
      newHandlers.delete(messageType);
      return newHandlers;
    });
  };

  /**
   * Clears the heartbeat interval and reconnection timeout, if active.
   */
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

  /**
   * Starts a heartbeat (ping) interval to keep the connection alive.
   * Sends a ping message every 30 seconds.
   *
   * @param {WebSocket} ws - The WebSocket instance.
   */
  const startHeartbeat = (ws) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'ping', 
          timestamp: Date.now() 
        }));
      }
    }, 30000); // Every 30 seconds
  };

  /**
   * Sends all queued messages through the provided WebSocket.
   * Called when the connection is (re)established.
   *
   * @param {WebSocket} ws - The WebSocket instance.
   */
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

  /**
   * Establishes a new WebSocket connection and sets up all event handlers.
   * This function is called initially and on reconnection attempts.
   */
  const connectWebSocket = () => {
    try {
      setLastError(null);
      const ws = new WebSocket(getWebSocketUrl());

      // ---- onopen ----
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

        // Send any queued messages
        flushMessageQueue(ws);
      };

      // ---- onclose ----
      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setWebsocket(null);
        clearAllIntervals();

        // Auto-reconnect with exponential backoff (up to 5 attempts)
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

      // ---- onerror ----
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        setLastError(error.message || 'Connection error occurred');
      };

      // ---- onmessage ----
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);

          // Call a registered handler for this message type, if any
          const handler = messageHandlers.get(data.type);
          if (handler) {
            handler(data);
          }

          // Default handlers for known message types
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

  /**
   * Disconnects the WebSocket manually and prevents auto‑reconnect.
   * Clears all intervals and queues.
   */
  const disconnectWebSocket = () => {
    clearAllIntervals();
    setReconnectAttempts(5); // Prevent auto‑reconnect
    setMessageQueue([]);

    if (websocket) {
      websocket.close(1000, 'User initiated disconnect');
      setWebsocket(null);
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  /**
   * Sends a message over the WebSocket. If the connection is currently down,
   * the message is queued and will be sent when the connection is restored.
   *
   * @param {Object} message - The message object to send (will be JSON‑stringified).
   * @returns {boolean} True if the message was sent immediately, false if queued or failed.
   */
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

  /**
   * Manually triggers a reconnection attempt.
   * Resets the attempt counter and closes the current connection if open.
   */
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

  /**
   * Returns the current number of messages in the queue.
   * @returns {number} Queue length.
   */
  const getQueueLength = () => messageQueue.length;

  /**
   * Clears all queued messages without sending them.
   */
  const clearMessageQueue = () => {
    setMessageQueue([]);
  };

  // ========== SIDE EFFECTS ==========
  /**
   * Effect to connect the WebSocket when the provider mounts,
   * and disconnect when it unmounts.
   */
  useEffect(() => {
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, []); // Empty dependency array – runs only on mount/unmount

  /**
   * Effect to flush the message queue whenever the connection becomes ready.
   */
  useEffect(() => {
    if (isConnected && websocket) {
      flushMessageQueue(websocket);
    }
  }, [isConnected, websocket]);

  // ========== CONTEXT VALUE ==========
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
