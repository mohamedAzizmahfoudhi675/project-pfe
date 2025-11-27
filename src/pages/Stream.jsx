// pages/DroneStreamViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

export default function DroneStreamViewer() {
  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const wsRef = useRef(null); // separate server WS

  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [streamStats, setStreamStats] = useState({});
  const [showConfig, setShowConfig] = useState(false);

  // Agora Configuration - update as needed
  const [agoraConfig, setAgoraConfig] = useState({
    appId: "c3e998dadf0342c181f1196dd94f15a4",
    channel: "app",
    token:
      "007eJxTYAh5s3LClekX+rvjr3/O0NLbbnTzX+zXjj386znN7ZlaJxcqMCQbp1paWqQkpqQZGJsYJRtaGKYZGlqapaRYmqQZmiaa1MpyZTYEMjK8N3zHysgAgSA+M0NiQQEDAwCjnB/p",
    uid: "a7e1bd8595054beaa07fa32216028bb0",
    role: "audience",
  });

  // lifecycle coordination refs
  const isInitializingRef = useRef(false);
  const isJoiningRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const pendingCleanupRef = useRef(false);

  // safe listener removal
  const removeAllListenersSafe = (client) => {
    try {
      if (client && typeof client.removeAllListeners === "function") {
        client.removeAllListeners();
      }
    } catch (e) {
      console.warn("removeAllListenersSafe failed", e);
    }
  };

  // =========================
  // Server WebSocket (separate)
  // Initializes once per component mount. Not closed on Agora reconnect.
  // =========================
  useEffect(() => {
    const url = "wss://your-server.example/ws"; // <-- replace with your server WS URL
    if (wsRef.current) return;

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

    return () => {
      try {
        wsRef.current?.close();
      } catch (e) {}
      wsRef.current = null;
    };
  }, []);

  // ===== Agora connect =====
  const connectAgora = async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setError(null);

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

    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    // Handlers
    const handleUserPublished = async (user, mediaType) => {
      console.log("User published:", user.uid, mediaType);
      try {
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
        // update isPlaying based on remaining streams
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

    // register listeners
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.on("connection-state-change", handleConnectionStateChange);

    client.on("token-privilege-will-expire", () => {
      console.warn("Token will expire soon");
      setError("Token will expire soon - please refresh");
    });

    client.on("token-privilege-did-expire", () => {
      console.error("Token expired");
      setError("Token expired - please refresh the page");
    });

    // join
    setConnectionStatus("joining");
    isJoiningRef.current = true;

    try {
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

      try {
        await client.setClientRole(agoraConfig.role);
      } catch (roleErr) {
        console.warn("setClientRole failed", roleErr);
      }

      setConnectionStatus("waiting");

      // if cleanup requested during join, leave now
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

  // ===== Agora disconnect =====
  const disconnectAgora = async () => {
    const client = clientRef.current;
    if (!client) return;

    // If join is in progress, mark pending and remove Agora listeners only
    if (isJoiningRef.current) {
      pendingCleanupRef.current = true;
      removeAllListenersSafe(client);
      return;
    }

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

  // Cleanup on unmount: close both Agora client and server WS
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

      try {
        wsRef.current?.close();
      } catch (e) {}
      wsRef.current = null;
    };
    // run only on mount/unmount
  }, []);

  // UI handlers
  const handleConfigChange = (key, value) => {
    setAgoraConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = async () => {
    setError(null);
    // Only touch Agora client; server WS remains untouched.
    if (hasJoinedRef.current || isJoiningRef.current) {
      await disconnectAgora();
    }
    await connectAgora();
  };

  const handleDisconnectClick = async () => {
    await disconnectAgora();
  };

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

              <div className="relative bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-96 object-contain"
                />

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
                      <p className="text-lg">Connecting to Agora...</p>
                      <p className="text-sm opacity-75 mt-2">{connectionStatus}</p>
                    </div>
                  </div>
                )}

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

                {isPlaying && (
                  <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span>LIVE</span>
                    </div>
                  </div>
                )}
              </div>

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

          <div className={`space-y-6 ${showConfig ? "block" : "hidden lg:block"}`}>
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
