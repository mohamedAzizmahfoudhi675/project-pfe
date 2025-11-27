import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Smartphone,
  RefreshCw,
  Wifi,
  MapPin,
  Navigation,
  Compass,
  Battery,
  Satellite,
  Play,
  Pause,
  Square,
  AlertTriangle,
  Target,
  Plane,
  TrendingUp
} from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";

// ==================== GLOBAL STATE & WS MANAGER ====================
const globalState = {
  ws: null,
  reconnectTimer: null,
  listeners: new Set(),
  reconnectAttempts: 0,
  lastMessageTime: null,
  mobileConnected: false,
  mobileLastSeen: null,
};

const WS_URL = "ws://localhost:8080";
const MAX_RECONNECT_ATTEMPTS = 12;

const GOOGLE_MAPS_CONFIG = {
  apiKey: "AIzaSyC20LuxJUoy120cX8HurFsT5pu1JWAvhSA",
  version: "weekly",
  libraries: ["geometry", "marker"]
};

const wsManager = {
  connect() {
    if (globalState.ws?.readyState === WebSocket.OPEN || 
        globalState.ws?.readyState === WebSocket.CONNECTING) return;

    if (globalState.reconnectTimer) clearTimeout(globalState.reconnectTimer);
    this.notifyListeners({ type: 'status', wsStatus: 'connecting' });

    try {
      if (globalState.ws) {
        try { globalState.ws.onclose = null; globalState.ws.close(); } catch {}
      }

      const ws = new WebSocket(WS_URL);
      globalState.ws = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket Connected");
        globalState.reconnectAttempts = 0;
        this.notifyListeners({ type: 'status', wsStatus: 'connected' });
        ws.send(JSON.stringify({ type: "identify", clientType: "web", clientId: "react_control_panel", timestamp: new Date().toISOString() }));
        ws.send(JSON.stringify({ type: "request_status", timestamp: new Date().toISOString() }));
      };

      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          globalState.lastMessageTime = Date.now();
          this.handleMessage(payload);
        } catch (e) {
          console.error("❌ Parse error:", e);
        }
      };

      ws.onclose = () => { 
        console.log("🔌 WebSocket Closed");
        this.notifyListeners({ type: 'status', wsStatus: 'disconnected' }); 
        this.scheduleReconnect(); 
      };
      
      ws.onerror = (err) => { 
        console.error("❌ WebSocket Error:", err);
        this.notifyListeners({ type: 'error', error: 'Connection failed' }); 
      };
    } catch (err) {
      this.notifyListeners({ type: 'status', wsStatus: 'disconnected', error: 'Failed to connect' });
      this.scheduleReconnect();
    }
  },

  scheduleReconnect() {
    globalState.reconnectAttempts = Math.min(globalState.reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
    const delay = Math.min(2000 * globalState.reconnectAttempts, 30000);
    if (globalState.reconnectTimer) clearTimeout(globalState.reconnectTimer);
    globalState.reconnectTimer = setTimeout(() => this.connect(), delay);
  },

  handleMessage(data) {
    const now = Date.now();
    
    switch (data.type) {
      case "connection_established":
      case "status_response":
        globalState.mobileConnected = data.mobile?.connected ?? globalState.mobileConnected;
        globalState.mobileLastSeen = data.mobile?.lastSeen ?? now;
        this.notifyListeners({ type: 'mobile_status', connected: globalState.mobileConnected, lastSeen: globalState.mobileLastSeen });
        break;
        
      case "client_connected":
        if (["mobile","drone"].includes(data.clientType)) { 
          globalState.mobileConnected = true; 
          globalState.mobileLastSeen = now; 
          this.notifyListeners({ type: 'mobile_status', connected: true, lastSeen: now }); 
        }
        break;
        
      case "client_disconnected":
        if (["mobile","drone"].includes(data.clientType)) { 
          globalState.mobileConnected = false; 
          this.notifyListeners({ type: 'mobile_status', connected: false, lastSeen: now }); 
        }
        break;
        
      case "drone_status":
      case "drone_status_update":
        globalState.mobileConnected = data.mobileConnected ?? globalState.mobileConnected;
        this.notifyListeners({ type: 'drone_data', data });
        break;
        
      case "telemetry_data":
        const telemetryPayload = data.telemetry || data;
        console.log("📊 Telemetry received:", telemetryPayload);
        this.notifyListeners({ type: 'telemetry_data', data: telemetryPayload });
        break;
        
      case "mission_status":
      case "mission_event":
        this.notifyListeners({ type: 'mission_data', data }); 
        break;
        
      case "heartbeat_ack":
        globalState.mobileLastSeen = now;
        break;
        
      case "error": 
        this.notifyListeners({ type: 'error', error: data.message }); 
        break;
        
      default:
        console.log("❓ Unhandled:", data.type);
        break;
    }
  },

  send(obj) {
    if (globalState.ws?.readyState === WebSocket.OPEN) { 
      globalState.ws.send(JSON.stringify({ ...obj, timestamp: new Date().toISOString() })); 
      return true; 
    }
    return false;
  },

  addListener(callback) {
    globalState.listeners.add(callback);
    callback({ type: 'status', wsStatus: this.getStatus(), reconnectAttempts: globalState.reconnectAttempts });
    callback({ type: 'mobile_status', connected: globalState.mobileConnected, lastSeen: globalState.mobileLastSeen });
  },

  removeListener(callback) { globalState.listeners.delete(callback); },
  notifyListeners(message) { globalState.listeners.forEach(cb => { try { cb(message); } catch (e) {} }); },
  getStatus() { 
    if (!globalState.ws) return 'disconnected'; 
    return globalState.ws.readyState === WebSocket.OPEN ? 'connected' : 
           globalState.ws.readyState === WebSocket.CONNECTING ? 'connecting' : 'disconnected'; 
  }
};

// ==================== FLIGHT TRACKING MAP ====================
const FlightTrackingMap = ({ 
  center = { lat: 40.7128, lng: -74.0059 },
  zoom = 15, 
  telemetryData,
  flightPath = [],
  missionWaypoints = [],
  onClearPath
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const droneMarkerRef = useRef(null);
  const flightPathRef = useRef(null);
  const missionPathRef = useRef(null);
  const waypointMarkersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showFlightPath, setShowFlightPath] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);

  useEffect(() => {
    const initMap = async () => {
      try {
        const loader = new Loader(GOOGLE_MAPS_CONFIG);
        await loader.load();
        
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeId: 'hybrid',
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
          ],
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true
        });

        setMapLoaded(true);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    initMap();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !telemetryData) return;

    const position = telemetryData.position;
    const movement = telemetryData.movement || {};
    const status = telemetryData.status || {};

    if (!position?.latitude || !position?.longitude) return;

    const dronePos = { lat: position.latitude, lng: position.longitude };

    if (!droneMarkerRef.current) {
      const heading = movement.heading || 0;
      const batteryLevel = status.batteryLevel || 0;

      const droneIcon = {
        path: 'M 0,-2 L 1.5,1.5 L 0,1 L -1.5,1.5 Z',
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        scale: 8,
        rotation: heading,
        anchor: new google.maps.Point(0, 0)
      };

      droneMarkerRef.current = new google.maps.Marker({
        position: dronePos,
        map: mapInstanceRef.current,
        icon: droneIcon,
        title: `Drone - Battery: ${batteryLevel}%`,
        zIndex: 1000
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; font-family: monospace; color: #000;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🚁 Drone Status</div>
            <div style="margin: 4px 0;">📍 Lat: ${position.latitude.toFixed(6)}</div>
            <div style="margin: 4px 0;">📍 Lng: ${position.longitude.toFixed(6)}</div>
            <div style="margin: 4px 0;">⬆️ Alt: ${position.altitude?.toFixed(1) || 0}m</div>
            <div style="margin: 4px 0;">⚡ Speed: ${movement.speed?.toFixed(1) || 0} m/s</div>
            <div style="margin: 4px 0;">🧭 Heading: ${heading.toFixed(0)}°</div>
            <div style="margin: 4px 0;">🔋 Battery: ${batteryLevel}%</div>
          </div>
        `
      });

      droneMarkerRef.current.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, droneMarkerRef.current);
      });

      mapInstanceRef.current.setCenter(dronePos);
      mapInstanceRef.current.setZoom(18);
    } else {
      droneMarkerRef.current.setPosition(dronePos);
      
      const heading = movement.heading || 0;
      const icon = droneMarkerRef.current.getIcon();
      if (icon && typeof icon === 'object') {
        icon.rotation = heading;
        droneMarkerRef.current.setIcon(icon);
      }
    }

  }, [telemetryData, mapLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !showFlightPath) {
      if (flightPathRef.current) {
        flightPathRef.current.setMap(null);
        flightPathRef.current = null;
      }
      return;
    }

    if (flightPath.length < 2) {
      if (flightPathRef.current) {
        flightPathRef.current.setMap(null);
        flightPathRef.current = null;
      }
      return;
    }

    if (flightPathRef.current) {
      flightPathRef.current.setMap(null);
    }

    const pathCoordinates = flightPath.map(point => ({ 
      lat: point[0], 
      lng: point[1] 
    }));

    flightPathRef.current = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: '#EF4444',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: mapInstanceRef.current
    });

    if (flightPath.length > 0) {
      const startPoint = flightPath[0];
      new google.maps.Marker({
        position: { lat: startPoint[0], lng: startPoint[1] },
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        },
        title: 'Flight Start',
        zIndex: 999
      });
    }

  }, [flightPath, mapLoaded, showFlightPath]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !showWaypoints) {
      waypointMarkersRef.current.forEach(marker => marker.setMap(null));
      waypointMarkersRef.current = [];
      if (missionPathRef.current) {
        missionPathRef.current.setMap(null);
        missionPathRef.current = null;
      }
      return;
    }

    waypointMarkersRef.current.forEach(marker => marker.setMap(null));
    waypointMarkersRef.current = [];

    if (missionWaypoints.length === 0) return;

    const waypointCoords = missionWaypoints
      .filter(wp => wp.latitude && wp.longitude)
      .map(wp => ({ lat: wp.latitude, lng: wp.longitude }));

    if (waypointCoords.length > 1) {
      if (missionPathRef.current) {
        missionPathRef.current.setMap(null);
      }

      missionPathRef.current = new google.maps.Polyline({
        path: waypointCoords,
        geodesic: true,
        strokeColor: '#8B5CF6',
        strokeOpacity: 0.6,
        strokeWeight: 3,
        map: mapInstanceRef.current
      });
    }

    missionWaypoints.forEach((wp, index) => {
      if (!wp.latitude || !wp.longitude) return;

      const isStart = index === 0;
      const isEnd = index === missionWaypoints.length - 1;

      const marker = new google.maps.Marker({
        position: { lat: wp.latitude, lng: wp.longitude },
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isStart || isEnd ? 8 : 6,
          fillColor: isStart ? '#10B981' : isEnd ? '#EF4444' : '#8B5CF6',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        },
        label: {
          text: `${index + 1}`,
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: 'bold'
        },
        title: `Waypoint ${index + 1}${wp.altitude ? ` - ${wp.altitude}m` : ''}`,
        zIndex: 500
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: monospace; color: #000;">
            <div style="font-weight: bold; margin-bottom: 6px;">Waypoint ${index + 1}</div>
            <div>Lat: ${wp.latitude.toFixed(6)}</div>
            <div>Lng: ${wp.longitude.toFixed(6)}</div>
            ${wp.altitude ? `<div>Alt: ${wp.altitude}m</div>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      waypointMarkersRef.current.push(marker);
    });

  }, [missionWaypoints, mapLoaded, showWaypoints]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setShowFlightPath(!showFlightPath)}
          className={`px-4 py-2 rounded-lg font-semibold shadow-lg transition ${
            showFlightPath 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {showFlightPath ? '✓' : '○'} Flight Path
        </button>
        
        <button
          onClick={() => setShowWaypoints(!showWaypoints)}
          className={`px-4 py-2 rounded-lg font-semibold shadow-lg transition ${
            showWaypoints 
              ? 'bg-purple-600 text-white hover:bg-purple-700' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {showWaypoints ? '✓' : '○'} Waypoints
        </button>

        {flightPath.length > 0 && (
          <button
            onClick={onClearPath}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold shadow-lg hover:bg-orange-700 transition"
          >
            Clear Path
          </button>
        )}
      </div>

      {telemetryData && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-4 shadow-xl">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400 text-xs mb-1">Speed</div>
              <div className="text-white font-bold">{telemetryData.movement?.speed?.toFixed(1) || 0} m/s</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Altitude</div>
              <div className="text-white font-bold">{telemetryData.position?.altitude?.toFixed(1) || 0} m</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Heading</div>
              <div className="text-white font-bold">{telemetryData.movement?.heading?.toFixed(0) || 0}°</div>
            </div>
          </div>
        </div>
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
          <div className="text-white text-lg">Loading Map...</div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function DroneFlightTracker() {
  const [wsStatus, setWsStatus] = useState(wsManager.getStatus());
  const [mobileStatus, setMobileStatus] = useState({ connected: false, lastSeen: null });
  const [telemetryData, setTelemetryData] = useState(null);
  const [missionData, setMissionData] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [flightPath, setFlightPath] = useState([]);
  const [missionWaypoints, setMissionWaypoints] = useState([]);
  const [flightStats, setFlightStats] = useState({
    totalDistance: 0,
    maxSpeed: 0,
    maxAltitude: 0,
    flightTime: 0,
    startTime: null
  });

  const handleManagerMessage = useCallback((message) => {
    switch (message.type) {
      case 'status': 
        setWsStatus(message.wsStatus); 
        setConnectionError(message.error ?? null); 
        break;
        
      case 'mobile_status': 
        setMobileStatus({ connected: message.connected, lastSeen: message.lastSeen }); 
        break;
        
      case 'telemetry_data':
        const telemetry = message.data;
        console.log("📊 Setting telemetry:", telemetry);
        setTelemetryData(telemetry);
        
        if (telemetry?.position?.latitude && telemetry.position.longitude) {
          const newPoint = [telemetry.position.latitude, telemetry.position.longitude];
          
          setFlightPath(prev => {
            const newPath = [...prev, newPoint];
            
            if (prev.length > 0) {
              const lastPoint = prev[prev.length - 1];
              const distance = calculateDistance(
                lastPoint[0], lastPoint[1],
                newPoint[0], newPoint[1]
              );
              
              setFlightStats(stats => ({
                ...stats,
                totalDistance: stats.totalDistance + distance,
                maxSpeed: Math.max(stats.maxSpeed, telemetry.movement?.speed || 0),
                maxAltitude: Math.max(stats.maxAltitude, telemetry.position?.altitude || 0),
                startTime: stats.startTime || Date.now()
              }));
            } else {
              setFlightStats(stats => ({ ...stats, startTime: Date.now() }));
            }
            
            return newPath.slice(-500);
          });
        }
        break;
        
      case 'mission_data': 
        setMissionData(message.data);
        if (message.data.waypoints || message.data.mission?.waypoints) {
          const waypoints = message.data.waypoints || message.data.mission?.waypoints;
          setMissionWaypoints(waypoints || []);
        }
        break;
        
      case 'error': 
        setConnectionError(message.error); 
        setTimeout(() => setConnectionError(null), 5000);
        break;
    }
  }, []);

  useEffect(() => { 
    wsManager.addListener(handleManagerMessage); 
    if (wsManager.getStatus() === 'disconnected') wsManager.connect(); 
    return () => wsManager.removeListener(handleManagerMessage); 
  }, [handleManagerMessage]);

  useEffect(() => {
    if (!flightStats.startTime) return;
    
    const interval = setInterval(() => {
      setFlightStats(stats => ({
        ...stats,
        flightTime: Math.floor((Date.now() - stats.startTime) / 1000)
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [flightStats.startTime]);

  const sendCommand = useCallback((obj) => wsManager.send(obj), []);

  const startMission = () => sendCommand({ type: "mission_start", missionId: missionData?.missionId || "default" });
  const pauseMission = () => sendCommand({ type: "mission_pause", missionId: missionData?.missionId || "default" });
  const stopMission = () => sendCommand({ type: "mission_stop", missionId: missionData?.missionId || "default" });
  const clearFlightPath = () => {
    setFlightPath([]);
    setFlightStats({ totalDistance: 0, maxSpeed: 0, maxAltitude: 0, flightTime: 0, startTime: null });
  };

  const StatusIcon = ({ status }) => 
    status === "connected" ? <CheckCircle className="w-6 h-6 text-green-500" /> : 
    status === "disconnected" ? <XCircle className="w-6 h-6 text-red-500" /> : 
    <Clock className="w-6 h-6 text-yellow-400 animate-spin" />;

  const position = telemetryData?.position;
  const movement = telemetryData?.movement || {};
  const status = telemetryData?.status || {};
  
  const mapCenter = position?.latitude && position?.longitude ? 
    { lat: position.latitude, lng: position.longitude } : 
    { lat: 37.7749, lng: -122.4194 };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Plane className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Live Flight Tracker</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {connectionError && (
              <span className="flex items-center gap-2 text-red-300 text-sm bg-red-900/50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                {connectionError}
              </span>
            )}
            
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
              <StatusIcon status={wsStatus} />
              <span className="text-white font-semibold">{wsStatus.toUpperCase()}</span>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
              <Smartphone className="w-5 h-5 text-blue-400" />
              <StatusIcon status={mobileStatus.connected ? "connected" : "disconnected"} />
              <span className="text-white font-semibold">
                {mobileStatus.connected ? "DRONE" : "NO DRONE"}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Left Sidebar - Telemetry */}
          <div className="xl:col-span-1 space-y-4">
            {/* Live Telemetry */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-5 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Satellite className="w-5 h-5 text-blue-400" />
                Live Telemetry
              </h3>
              
              {telemetryData ? (
                <div className="space-y-3">
                  <div className="bg-slate-900/50 p-3 rounded-lg">
                    <div className="text-gray-400 text-xs mb-1">GPS Position</div>
                    <div className="text-white font-mono text-sm">
                      {position?.latitude?.toFixed(6)}<br/>
                      {position?.longitude?.toFixed(6)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> Altitude
                      </div>
                      <div className="text-white font-bold text-lg">{position?.altitude?.toFixed(1) || 0}m</div>
                    </div>
                    
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Speed
                      </div>
                      <div className="text-white font-bold text-lg">{movement?.speed?.toFixed(1) || 0} m/s</div>
                    </div>
                    
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        <Compass className="w-3 h-3" /> Heading
                      </div>
                      <div className="text-white font-bold text-lg">{movement?.heading?.toFixed(0) || 0}°</div>
                    </div>
                    
                    <div className="bg-slate-900/50 p-3 rounded-lg">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        <Battery className="w-3 h-3" /> Battery
                      </div>
                      <div className={`font-bold text-lg ${
                        (status?.batteryLevel || 0) > 50 ? 'text-green-400' :
                        (status?.batteryLevel || 0) > 20 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {status?.batteryLevel || 0}%
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <div>Waiting for telemetry data...</div>
                </div>
              )}
            </div>

            {/* Flight Statistics */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-5 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Flight Statistics</h3>
              
              <div className="space-y-3">
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Flight Time</div>
                  <div className="text-white font-bold text-xl">{formatTime(flightStats.flightTime)}</div>
                </div>
                
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Total Distance</div>
                  <div className="text-white font-bold text-xl">{flightStats.totalDistance.toFixed(0)}m</div>
                </div>
                
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Max Speed</div>
                  <div className="text-white font-bold text-xl">{flightStats.maxSpeed.toFixed(1)} m/s</div>
                </div>
                
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Max Altitude</div>
                  <div className="text-white font-bold text-xl">{flightStats.maxAltitude.toFixed(0)}m</div>
                </div>
                
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs mb-1">Path Points</div>
                  <div className="text-white font-bold text-xl">{flightPath.length}</div>
                </div>
              </div>
            </div>

            {/* Mission Control */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-5 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Mission Control</h3>
              
              <div className="space-y-2">
                <button 
                  onClick={startMission} 
                  disabled={!mobileStatus.connected}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  <Play className="w-4 h-4" /> Start Mission
                </button>
                
                <button 
                  onClick={pauseMission} 
                  disabled={!mobileStatus.connected}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  <Pause className="w-4 h-4" /> Pause Mission
                </button>
                
                <button 
                  onClick={stopMission} 
                  disabled={!mobileStatus.connected}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  <Square className="w-4 h-4" /> Stop Mission
                </button>
                
                <button 
                  onClick={clearFlightPath}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold"
                >
                  <RefreshCw className="w-4 h-4" /> Clear Path
                </button>
              </div>
              
              {missionData?.message && (
                <div className="mt-4 text-sm text-gray-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                  {missionData.message}
                </div>
              )}
            </div>
          </div>

          {/* Map - Takes remaining space */}
          <div className="xl:col-span-3">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
              <FlightTrackingMap
                center={mapCenter}
                zoom={18}
                telemetryData={telemetryData}
                flightPath={flightPath}
                missionWaypoints={missionWaypoints}
                onClearPath={clearFlightPath}
              />
            </div>
            
            {/* Legend */}
            <div className="flex justify-between items-center mt-3 px-2">
              <div className="flex gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Drone Position</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-red-500"></div>
                  <span>Flight Path</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span>Mission Waypoints</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-400 font-mono">
                {position?.latitude && position?.longitude ? 
                  `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : 
                  "Waiting for GPS..."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}