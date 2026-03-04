import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { useWebSocket } from "../contexts/WebSocketContext";

/**
 * Default state for the mission planner.
 * Used as a fallback when restoring from localStorage fails, and as the base for merging.
 * @type {Object}
 */
const DEFAULT_PLANNER_STATE = {
  waypoints: [],                      // List of waypoint objects { lat, lng, alt, speed, ... }
  path: [],                            // Computed flight path points
  metrics: "",                         // Additional metrics (distance, duration, etc.)
  selectedMarker: null,                 // Currently selected marker index or id
  routeType: "waypoint",                // Type of route: "waypoint", "area", or "linear"
  waypointParams: {},                   // Parameters specific to waypoint mode
  areaParams: {},                       // Parameters specific to area survey mode
  linearParams: {},                     // Parameters specific to linear mode
  sidebarWidth: 340,                     // Width of the sidebar (for resizing)
  showParamsModal: false,                // Whether the parameters modal is open
  mapCenter: { lat: 40.7484, lng: -73.9857 }, // Default map center (Empire State Building)
  mapZoom: 15,                           // Default map zoom level
};

/**
 * Layout Component
 *
 * The root layout for the application. It wraps all pages and provides:
 * - A persistent navigation bar (Navbar)
 * - A connection status bar that reflects WebSocket state
 * - Global planner state stored in localStorage (synchronized across refreshes)
 * - The Outlet from react-router-dom for rendering child routes, with the planner state
 *   and its setter passed as context.
 *
 * @returns {JSX.Element} The layout with navbar, status bar, and content area.
 */
export default function Layout() {
  // Get WebSocket connection status from the WebSocket context
  const { isConnected, connectionStatus } = useWebSocket();

  /**
   * plannerState - The current state of the mission planner.
   * Initialized by attempting to load from localStorage. If loading fails or no saved state exists,
   * defaults to DEFAULT_PLANNER_STATE.
   */
  const [plannerState, setPlannerState] = useState(() => {
    try {
      const saved = localStorage.getItem("plannerState");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults and ensure arrays exist (defensive)
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
    // Fallback to default state if nothing saved or error
    return { ...DEFAULT_PLANNER_STATE };
  });

  /**
   * Effect: Save plannerState to localStorage whenever it changes.
   * This allows the user's work to persist across page reloads.
   */
  useEffect(() => {
    try {
      localStorage.setItem("plannerState", JSON.stringify(plannerState));
    } catch (error) {
      console.error('Failed to save planner state:', error);
    }
  }, [plannerState]);

  /**
   * ConnectionStatusBar - A small bar at the top showing the current WebSocket connection status.
   * Changes color, icon, and message based on connectionStatus from useWebSocket.
   *
   * @returns {JSX.Element} The status bar.
   */
  const ConnectionStatusBar = () => {
    /**
     * Determines the styling and message based on connectionStatus.
     * @returns {Object} { bg, text, icon, message }
     */
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
        default: // 'disconnected', 'failed', etc.
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
      {/* Main navigation bar */}
      <Navbar />

      {/* Connection status bar (always visible) */}
      <ConnectionStatusBar />

      {/* Main content area – child routes are rendered here via Outlet */}
      <div className="flex-1 overflow-hidden bg-gray-100">
        {/**
         * Outlet with context: passes the planner state and its setter down to child routes.
         * Child components can access these via the useOutletContext() hook.
         */}
        <Outlet context={{ plannerState, setPlannerState }} />
      </div>
    </div>
  );
}
