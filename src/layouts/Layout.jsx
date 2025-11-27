import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { useWebSocket } from "../contexts/WebSocketContext";

// Default planner state (for safe fallback)
const DEFAULT_PLANNER_STATE = {
  waypoints: [],
  path: [],
  metrics: "",
  selectedMarker: null,
  routeType: "waypoint",
  waypointParams: {},
  areaParams: {},
  linearParams: {},
  sidebarWidth: 340,
  showParamsModal: false,
  mapCenter: { lat: 40.7484, lng: -73.9857 },
  mapZoom: 15,
};

export default function Layout() {
  // Get WebSocket connection status
  const { isConnected, connectionStatus } = useWebSocket();

  // Defensive restore from localStorage, fallback to defaults
  const [plannerState, setPlannerState] = useState(() => {
    try {
      const saved = localStorage.getItem("plannerState");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults and ensure arrays
        return {
          ...DEFAULT_PLANNER_STATE,
          ...parsed,
          waypoints: Array.isArray(parsed.waypoints) ? parsed.waypoints : [],
          path: Array.isArray(parsed.path) ? parsed.path : [],
          mapCenter: parsed.mapCenter || DEFAULT_PLANNER_STATE.mapCenter,
          mapZoom: typeof parsed.mapZoom === "number" ? parsed.mapZoom : DEFAULT_PLANNER_STATE.mapZoom,
        };
      }
    } catch (error) {
      console.warn('Failed to restore planner state:', error);
    }
    return { ...DEFAULT_PLANNER_STATE };
  });

  // Save to localStorage on plannerState change
  useEffect(() => {
    try {
      localStorage.setItem("plannerState", JSON.stringify(plannerState));
    } catch (error) {
      console.error('Failed to save planner state:', error);
    }
  }, [plannerState]);

  // Simple connection status component
  const ConnectionStatusBar = () => {
    const getStatusConfig = () => {
      switch (connectionStatus) {
        case 'connected':
          return {
            bg: 'bg-green-500',
            text: 'text-white',
            icon: '●',
            message: 'Connected to Mission Server'
          };
        case 'connecting':
          return {
            bg: 'bg-yellow-500',
            text: 'text-black',
            icon: '◐',
            message: 'Connecting to server...'
          };
        case 'error':
          return {
            bg: 'bg-red-500',
            text: 'text-white',
            icon: '✕',
            message: 'Connection failed'
          };
        default:
          return {
            bg: 'bg-gray-500',
            text: 'text-white',
            icon: '○',
            message: 'Disconnected from server'
          };
      }
    };

    const config = getStatusConfig();
    
    return (
      <div className={`${config.bg} ${config.text} py-1 px-4 text-center text-sm font-medium transition-colors duration-300`}>
        <span className="inline-block mr-2">{config.icon}</span>
        {config.message}
        {connectionStatus === 'connected' && ' - Ready to send missions'}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      
      {/* Connection Status Bar */}
      <ConnectionStatusBar />
      
      <div className="flex-1 overflow-hidden bg-gray-100">
        <Outlet context={{ plannerState, setPlannerState }} />
      </div>
    </div>
  );
}