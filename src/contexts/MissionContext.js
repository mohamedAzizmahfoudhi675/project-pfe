import React, { createContext, useContext, useReducer } from 'react';

/**
 * MissionContext - A React context for managing mission planning state.
 * This context provides a central store for waypoints, map view, drawing mode,
 * and mission parameters across the application.
 */
const MissionContext = createContext();

/**
 * missionReducer - Reducer function for the mission state.
 * Handles actions to update waypoints, map view, drawing mode, etc.
 *
 * @param {Object} state - Current state object.
 * @param {Object} action - Action object with type and payload.
 * @returns {Object} New state after applying the action.
 */
const missionReducer = (state, action) => {
  switch (action.type) {
    /**
     * Replaces the entire waypoints array with the provided payload.
     * @actionType 'SET_WAYPOINTS'
     * @payload {Array} New waypoints list.
     */
    case 'SET_WAYPOINTS':
      return { ...state, waypoints: action.payload };

    /**
     * Adds a single waypoint to the existing waypoints array.
     * @actionType 'ADD_WAYPOINT'
     * @payload {Object} The new waypoint object.
     */
    case 'ADD_WAYPOINT':
      return { ...state, waypoints: [...state.waypoints, action.payload] };

    /**
     * Updates an existing waypoint identified by its id.
     * @actionType 'UPDATE_WAYPOINT'
     * @payload {Object} Waypoint object with updated fields and same id.
     */
    case 'UPDATE_WAYPOINT':
      return {
        ...state,
        waypoints: state.waypoints.map(wp => 
          wp.id === action.payload.id ? action.payload : wp
        )
      };

    /**
     * Deletes a waypoint by its id.
     * @actionType 'DELETE_WAYPOINT'
     * @payload {string|number} The id of the waypoint to remove.
     */
    case 'DELETE_WAYPOINT':
      return {
        ...state,
        waypoints: state.waypoints.filter(wp => wp.id !== action.payload)
      };

    /**
     * Updates the map view (center and zoom).
     * @actionType 'SET_MAP_VIEW'
     * @payload {Object} Object containing center {lat,lng} and zoom level.
     */
    case 'SET_MAP_VIEW':
      return { 
        ...state, 
        mapCenter: action.payload.center,
        mapZoom: action.payload.zoom 
      };

    /**
     * Sets the current drawing mode (e.g., 'polygon', 'waypoint').
     * @actionType 'SET_DRAWING_MODE'
     * @payload {string|null} The drawing mode or null to disable.
     */
    case 'SET_DRAWING_MODE':
      return { ...state, drawingMode: action.payload };

    /**
     * Default case returns the current state unchanged.
     */
    default:
      return state;
  }
};

/**
 * Initial state for the mission context.
 * @property {Array} waypoints - List of waypoint objects.
 * @property {Array} path - Computed flight path (list of points).
 * @property {Array} photoPoints - Points where photos were taken.
 * @property {Array} flightLines - Additional flight line segments (e.g., for grid).
 * @property {Object} mapCenter - Current map center coordinates {lat, lng}.
 * @property {number} mapZoom - Current map zoom level.
 * @property {string} routeType - Type of route: 'waypoint' or 'area'.
 * @property {string|null} drawingMode - Current drawing mode (e.g., 'polygon').
 * @property {number|null} selectedMarker - Index or id of selected marker.
 * @property {Object} missionParams - Mission parameters like altitude, speed, yaw.
 */
const initialState = {
  waypoints: [],
  path: [],
  photoPoints: [],
  flightLines: [],
  mapCenter: { lat: 0, lng: 0 },
  mapZoom: 10,
  routeType: 'waypoint',
  drawingMode: null,
  selectedMarker: null,
  missionParams: {
    altitude: 100,
    speed: 10,
    aircraftYaw: 0
  }
};

/**
 * MissionProvider - Provider component that wraps the application (or part of it)
 * and makes the mission state and dispatch function available via the MissionContext.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will have access to the context.
 * @returns {JSX.Element} The provider wrapping the children.
 */
export const MissionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(missionReducer, initialState);

  return (
    <MissionContext.Provider value={{ state, dispatch }}>
      {children}
    </MissionContext.Provider>
  );
};

/**
 * useMission - Custom hook to access the mission context.
 * Must be used within a MissionProvider.
 *
 * @returns {Object} Context value containing { state, dispatch }.
 * @throws {Error} If used outside of MissionProvider.
 */
export const useMission = () => {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
};
