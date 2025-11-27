import React, { createContext, useContext, useReducer } from 'react';

const MissionContext = createContext();

const missionReducer = (state, action) => {
  switch (action.type) {
    case 'SET_WAYPOINTS':
      return { ...state, waypoints: action.payload };
    case 'ADD_WAYPOINT':
      return { ...state, waypoints: [...state.waypoints, action.payload] };
    case 'UPDATE_WAYPOINT':
      return {
        ...state,
        waypoints: state.waypoints.map(wp => 
          wp.id === action.payload.id ? action.payload : wp
        )
      };
    case 'DELETE_WAYPOINT':
      return {
        ...state,
        waypoints: state.waypoints.filter(wp => wp.id !== action.payload)
      };
    case 'SET_MAP_VIEW':
      return { 
        ...state, 
        mapCenter: action.payload.center,
        mapZoom: action.payload.zoom 
      };
    case 'SET_DRAWING_MODE':
      return { ...state, drawingMode: action.payload };
    default:
      return state;
  }
};

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

export const MissionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(missionReducer, initialState);

  return (
    <MissionContext.Provider value={{ state, dispatch }}>
      {children}
    </MissionContext.Provider>
  );
};

export const useMission = () => {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
};