// pages/DroneStreamViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

/**
 * DroneStreamViewer Component
 *
 * This component displays a live video stream from a drone via Agora RTC.
 * It also maintains a separate WebSocket connection to a custom server (optional).
 * The Agora connection can be configured with App ID, channel, token, etc.
 * It handles connection lifecycle, error states, and provides a user interface
 * to manage the stream.
 *
 * @returns {JSX.Element} The rendered component.
 */
export default function DroneStreamViewer() {
  // ========== Refs ==========
  const videoRef = useRef(null);          // Reference to the <video> element where the stream will be played.
  const clientRef = useRef(null);         // Reference to the AgoraRTC client instance.
  const wsRef = useRef(null);             // Reference to the separate WebSocket (server) connection.

  // ========== State ==========
  const [isPlaying, setIsPlaying] = useState(false);               // Whether a video stream is currently playing.
  const [error, setError] = useState(null);                         // Current error message (if any).
  const [isLoading, setIsLoading] = useState(false);                // Whether an Agora connection is in progress.
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // Current status string.
  const [streamStats, setStreamStats] = useState({});               // Statistics about active streams (keyed by uid).
  const [showConfig, setShowConfig] = useState(false);              // Whether to show the configuration panel.

  // Agora configuration – can be updated by user.
  const [agoraConfig, setAgoraConfig] = useState({
    appId: "c3e998dadf0342c181f1196dd94f15a4",
    channel: "app",
    token:
      "007eJxTYAh5s3LClekX+rvjr3/O0NLbbnTzX+zXjj386znN7ZlaJxcqMCQbp1paWqQkpqQZGJsYJRtaGKYZGlqapaRYmqQZmiaa1MpyZTYEMjK8N3zHysgAgSA+M0NiQQEDAwCjnB/p",
    uid: "a7e1bd8595054beaa07fa32216028bb0",
    role: "audience",
  });

  // ========== Lifecycle Coordination Refs ==========
  // These refs help manage asynchronous operations and prevent race conditions.
  const isInitializingRef = useRef(false);   // True while connectAgora() is running.
  const isJoiningRef = useRef(false);        // True while client.join() is in progress.
  const hasJoinedRef = useRef(false);        // True after successful join.
  const pendingCleanupRef = useRef(false);   // True if disconnect was requested during join.

  // ========== Helper: Remove All Agora Listeners Safely ==========
  /**
   * Safely removes all event listeners from an Agora client.
   * Catches and logs any errors.
   * @param {Object} client - The AgoraRTC client instance.
   */
  const removeAllListenersSafe = (client) => {
    try {
      if (client && typeof client.removeAllListeners === "function") {
        client.removeAllListeners();
      }
    } catch (e) {
      console.warn("removeAllListenersSafe failed", e);
    }
  };

  // ========== Server WebSocket (Separate) ==========
  /**
   * Effect to create a single, long-lived WebSocket connection to a custom server.
   * This connection is independent of the Agora stream and is created once on mount.
   * It is closed only on component unmount.
   */
  useEffect(() => {
    const url = "wss://your-server.example/ws"; // <-- replace with your server WS URL
    if (wsRef.current) return; // Already connected

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Server WS open");
      };
      ws.onmessage = (ev) => {
        // handle server messages here
        // example: console.log("server message", ev.data);
      };
      ws.onerror = (ev) => {
        console.error("Server WS error", ev);
      };
      ws.onclose = (ev) => {
        console.log("Server WS closed", ev.code, ev.reason);
        // optional: implement reconnect/backoff here if you want
      };
    } catch (e) {
      console.error("Failed to create server WS", e);
    }

    // Cleanup on unmount
    return () => {
      try {
        wsRef.current?.close();
      } catch (e) {}
      wsRef.current = null;
    };
  }, []);

  // ========== Agora Connect ==========
  /**
   * Establishes an Agora RTC connection using the current configuration.
   * Handles all steps: client creation, listener registration, joining, and setting role.
   * Manages the isInitializingRef, isJoiningRef, and hasJoinedRef flags to avoid concurrency issues.
   */
  const connectAgora = async () => {
    // Prevent multiple simultaneous initialization attempts.
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setError(null);

    // Validate required fields.
    if (!agoraConfig.appId || agoraConfig.appId === "YOUR_APP_ID") {
      setError("Please set your Agora App ID in the configuration");
      setShowConfig(true);
      isInitializingRef.current = false;
      return;
    }
    if (!agoraConfig.channel) {
      setError("Channel name is required");
      isInitializingRef.current = false;
      return;
    }
    if (!agoraConfig.token) {
      setError("Token is required");
      isInitializingRef.current = false;
      return;
    }

    setIsLoading(true);
    setConnectionStatus("initializing");

    // Create a new Agora client (live mode, VP8 codec).
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    // ----- Event Handlers -----
    const handleUserPublished = async (user, mediaType) => {
      console.log("User published:", user.uid, mediaType);
      try {
        // Subscribe to the user's media track.
        await client.subscribe(user, mediaType);
        if (mediaType === "video" && user.videoTrack && videoRef.current) {
          user.videoTrack.play(videoRef.current);
          setIsPlaying(true);
          setConnectionStatus("connected");
          user.videoTrack.on("video-state-change", (state) => {
            console.log("Video state changed:", state);
          });
        }
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }

        // Update stream statistics.
        setStreamStats((prev) => ({
          ...prev,
          [user.uid]: {
            video: mediaType === "video",
            audio: mediaType === "audio",
            joinedAt: new Date().toLocaleTimeString(),
          },
        }));
      } catch (subscribeError) {
        console.error("Subscribe error:", subscribeError);
        setError(`Failed to subscribe: ${subscribeError?.message ?? subscribeError}`);
      }
    };

    const handleUserUnpublished = (user) => {
      console.log("User unpublished:", user.uid);
      setStreamStats((prev) => {
        const next = { ...prev };
        delete next[user.uid];
        // Check if any video stream remains.
        const hasVideoStream = Object.values(next).some((s) => s.video);
        setIsPlaying(hasVideoStream);
        if (!hasVideoStream) setConnectionStatus("waiting");
        return next;
      });
    };

    const handleUserJoined = (user) => {
      console.log("User joined:", user.uid);
      setConnectionStatus("stream-available");
    };

    const handleUserLeft = (user) => {
      console.log("User left:", user.uid);
      setStreamStats((prev) => {
        const next = { ...prev };
        delete next[user.uid];
        const hasVideoStream = Object.values(next).some((s) => s.video);
        setIsPlaying(hasVideoStream);
        return next;
      });
    };

    const handleConnectionStateChange = (curState) => {
      console.log("Connection state changed:", curState);
      setConnectionStatus(curState);
    };

    // Register all listeners.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.on("connection-state-change", handleConnectionStateChange);

    // Token expiration warnings.
    client.on("token-privilege-will-expire", () => {
      console.warn("Token will expire soon");
      setError("Token will expire soon - please refresh");
    });

    client.on("token-privilege-did-expire", () => {
      console.error("Token expired");
      setError("Token expired - please refresh the page");
    });

    // ----- Join the channel -----
    setConnectionStatus("joining");
    isJoiningRef.current = true;

    try {
      // Convert uid to number if it's a numeric string (Agora expects number or string).
      const uidVal = (() => {
        const n = Number(agoraConfig.uid);
        return Number.isFinite(n) ? n : agoraConfig.uid;
      })();

      await client.join(
        agoraConfig.appId,
        agoraConfig.channel,
        agoraConfig.token,
        uidVal
      );

      isJoiningRef.current = false;
      hasJoinedRef.current = true;

      // Set client role (audience or host).
      try {
        await client.setClientRole(agoraConfig.role);
      } catch (roleErr) {
        console.warn("setClientRole failed", roleErr);
      }

      setConnectionStatus("waiting");

      // If a disconnect was requested during join, clean up immediately.
      if (pendingCleanupRef.current) {
        try {
          await client.leave();
        } catch (e) {
          console.error("leave after pending cleanup failed:", e);
        } finally {
          removeAllListenersSafe(client);
          clientRef.current = null;
          hasJoinedRef.current = false;
        }
      }
    } catch (err) {
      console.error("Failed to initialize Agora:", err);
      setError(`Initialization failed: ${err?.message ?? String(err)}`);
      setConnectionStatus("error");
      isJoiningRef.current = false;
      try {
        removeAllListenersSafe(client);
      } catch (e) {}
      clientRef.current = null;
      hasJoinedRef.current = false;
    } finally {
      setIsLoading(false);
      isInitializingRef.current = false;
    }
  };

  // ========== Agora Disconnect ==========
  /**
   * Disconnects the Agora client.
   * Handles both normal disconnection and the case where a join is still in progress.
   */
  const disconnectAgora = async () => {
    const client = clientRef.current;
    if (!client) return;

    // If a join is in progress, we cannot call leave() immediately.
    // Instead, set pendingCleanup and remove listeners; the ongoing join will handle it.
    if (isJoiningRef.current) {
      pendingCleanupRef.current = true;
      removeAllListenersSafe(client);
      return;
    }

    // Normal disconnection.
    try {
      if (hasJoinedRef.current) {
        await client.leave();
      }
    } catch (e) {
      console.error("Error during cleanup leave:", e);
    } finally {
      removeAllListenersSafe(client);
      clientRef.current = null;
      hasJoinedRef.current = false;
      pendingCleanupRef.current = false;
      setIsPlaying(false);
      setConnectionStatus("disconnected");
      // DO NOT close wsRef here. Server WS remains independent.
    }
  };

  // ========== Cleanup on Unmount ==========
  /**
   * Effect to clean up both Agora client and server WebSocket when the component unmounts.
   * Handles the case where a join is still in progress.
   */
  useEffect(() => {
    return () => {
      const client = clientRef.current;
      if (client) {
        if (isJoiningRef.current) {
          pendingCleanupRef.current = true;
          removeAllListenersSafe(client);
        } else {
          (async () => {
            try {
              if (hasJoinedRef.current) await client.leave();
            } catch (e) {
              console.error("Error in unmount leave:", e);
            } finally {
              removeAllListenersSafe(client);
              clientRef.current = null;
              hasJoinedRef.current = false;
            }
          })();
        }
      }

      // Close server WebSocket.
      try {
        wsRef.current?.close();
      } catch (e) {}
      wsRef.current = null;
    };
    // run only on mount/unmount
  }, []);

  // ========== UI Handlers ==========
  /**
   * Updates a single field in the Agora configuration.
   * @param {string} key - The config key.
   * @param {any} value - The new value.
   */
  const handleConfigChange = (key, value) => {
    setAgoraConfig((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Applies the current configuration by disconnecting (if needed) and reconnecting.
   */
  const handleApply = async () => {
    setError(null);
    // Only touch Agora client; server WS remains untouched.
    if (hasJoinedRef.current || isJoiningRef.current) {
      await disconnectAgora();
    }
    await connectAgora();
  };

  /**
   * Disconnects the Agora client manually.
   */
  const handleDisconnectClick = async () => {
    await disconnectAgora();
  };

  /**
   * Returns a Tailwind CSS background color class based on the connection status.
   * @returns {string} The color class.
   */
  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500";
      case "connecting":
      case "initializing":
      case "joining":
        return "bg-yellow-500 animate-pulse";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  /**
   * Returns a human‑readable status text based on the connection status.
   * @returns {string} The status text.
   */
  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "LIVE STREAMING";
      case "connecting":
        return "CONNECTING";
      case "initializing":
        return "INITIALIZING";
      case "joining":
        return "JOINING CHANNEL";
      case "waiting":
        return "WAITING FOR STREAM";
      case "stream-available":
        return "STREAM AVAILABLE";
      case "error":
        return "CONNECTION ERROR";
      default:
        return "DISCONNECTED";
    }
  };

  // ========== Render ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            🚁 Drone Live Stream Viewer
          </h1>
          <p className="text-gray-600 text-lg">
            Real-time video stream from your mobile app
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main video panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Live Video Feed
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Channel: {agoraConfig.channel}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Status indicator */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                    <span
                      className={`font-medium ${
                        connectionStatus === "connected"
                          ? "text-green-600"
                          : connectionStatus === "error"
                          ? "text-red-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {getStatusText()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowConfig(!showConfig)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                    >
                      {showConfig ? "Hide Config" : "Show Config"}
                    </button>
                    {hasJoinedRef.current ? (
                      <button
                        onClick={handleDisconnectClick}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={handleApply}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Video container */}
              <div className="relative bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-96 object-contain"
                />

                {/* Loading overlay */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
                      <p className="text-lg">Connecting to Agora...</p>
                      <p className="text-sm opacity-75 mt-2">{connectionStatus}</p>
                    </div>
                  </div>
                )}

                {/* Error overlay */}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
                    <div className="text-white text-center p-8 max-w-md">
                      <div className="text-4xl mb-4">⚠️</div>
                      <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
                      <p className="text-gray-300 mb-6">{error}</p>
                      <div className="space-y-3">
                        <button
                          onClick={handleApply}
                          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
                        >
                          Retry Connection
                        </button>
                        <button
                          onClick={() => setShowConfig(true)}
                          className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors font-medium"
                        >
                          Check Configuration
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waiting for stream overlay */}
                {!isLoading && !error && !isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
                    <div className="text-white text-center p-8">
                      <div className="text-5xl mb-4">📡</div>
                      <h3 className="text-xl font-semibold mb-2">Waiting for Stream</h3>
                      <p className="text-gray-300">No active stream detected in channel</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Make sure your mobile app is streaming to: {agoraConfig.channel}
                      </p>
                    </div>
                  </div>
                )}

                {/* Live indicator when playing */}
                {isPlaying && (
                  <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span>LIVE</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream information panel */}
              <div className="p-6 bg-gray-50">
                <h3 className="font-semibold text-gray-800 mb-3">Stream Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-gray-600">Status</div>
                    <div className={`font-semibold ${isPlaying ? "text-green-600" : "text-yellow-600"}`}>
                      {isPlaying ? "Active" : "Waiting"}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-gray-600">Active Streams</div>
                    <div className="font-semibold text-gray-800">{Object.keys(streamStats).length}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-gray-600">Channel</div>
                    <div className="font-semibold text-gray-800 font-mono text-sm">{agoraConfig.channel}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-gray-600">Role</div>
                    <div className="font-semibold text-gray-800">{agoraConfig.role}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Configuration and status */}
          <div className={`space-y-6 ${showConfig ? "block" : "hidden lg:block"}`}>
            {/* Configuration card */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🔧 Stream Configuration</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App ID *</label>
                  <input
                    type="text"
                    value={agoraConfig.appId}
                    onChange={(e) => handleConfigChange("appId", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your Agora App ID"
                  />
                  <p className="text-xs text-gray-500 mt-1">Get this from your Agora console</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name *</label>
                  <input
                    type="text"
                    value={agoraConfig.channel}
                    onChange={(e) => handleConfigChange("channel", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter channel name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                  <textarea
                    value={agoraConfig.token}
                    onChange={(e) => handleConfigChange("token", e.target.value)}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="Paste your Agora token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={agoraConfig.role}
                    onChange={(e) => handleConfigChange("role", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="audience">Audience (View Only)</option>
                    <option value="host">Host (Can Publish)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UID (optional)</label>
                  <input
                    type="text"
                    value={agoraConfig.uid}
                    onChange={(e) => handleConfigChange("uid", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="Numeric or string UID"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={handleApply}
                    className="flex-1 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                  >
                    Apply Configuration & Reconnect
                  </button>
                  <button
                    onClick={handleDisconnectClick}
                    className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-semibold"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>

            {/* Connection status card */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Connection Status</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Agora SDK</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Loaded</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Client Role</span>
                  <span className="font-medium">{agoraConfig.role}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Stream Mode</span>
                  <span className="font-medium">Live</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Codec</span>
                  <span className="font-medium">VP8</span>
                </div>

                {/* List of active streams */}
                {Object.entries(streamStats).map(([uid, stats]) => (
                  <div key={uid} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Stream {uid}</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Video: {stats.video ? "✅" : "❌"}</div>
                      <div>Audio: {stats.audio ? "✅" : "❌"}</div>
                      <div>Joined: {stats.joinedAt}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile app setup help */}
            <div className="bg-blue-50 rounded-2xl shadow-xl p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">📱 Mobile App Setup</h3>

              <div className="space-y-3 text-sm text-blue-700">
                <div className="flex items-start space-x-2">
                  <div className="mt-1">1.</div>
                  <div>Use the same <strong>App ID</strong> in your mobile app</div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="mt-1">2.</div>
                  <div>Join the same <strong>channel name</strong></div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="mt-1">3.</div>
                  <div>Set role to <strong>"host"</strong> to publish stream</div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="mt-1">4.</div>
                  <div>Grant camera & microphone permissions</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Make sure your mobile app is using the same Agora configuration as shown above. The stream will appear automatically when the mobile app starts publishing.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile floating config toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-10">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg font-semibold"
          >
            {showConfig ? "Hide Config" : "Show Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
