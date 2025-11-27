// TopControls.jsx
import React from "react";
import { Autocomplete } from "@react-google-maps/api";

export const TopControls = ({
  autocompleteRef,
  handlePlaceChanged,
  clearWaypoints,
  clearPath,
  polygonPath,
  applyPolygonAsWaypoints,
  computeContour,
  handleGetContour
}) => (
  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex gap-2 items-center bg-white/95 shadow rounded-2xl p-2">
    <Autocomplete onLoad={(ac) => (autocompleteRef.current = ac)} onPlaceChanged={handlePlaceChanged}>
      <input 
        type="text" 
        placeholder="Search location..." 
        className="w-64 px-3 py-2 rounded border border-gray-300 text-gray-900 text-sm outline-none focus:border-blue-500 transition-colors" 
      />
    </Autocomplete>

    <button 
      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded transition flex items-center gap-2"
      onClick={clearWaypoints}
      title="Remove all waypoints"
    >
      <span>🗑️</span>
      <span>Clear Waypoints</span>
    </button>

    <button 
      className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded transition flex items-center gap-2"
      onClick={clearPath} 
      title="Remove all waypoints and path"
    >
      <span>🧹</span>
      <span>Clear Path</span>
    </button>

    {polygonPath && polygonPath.length >= 3 && (
      <>
        <button 
          className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded transition flex items-center gap-2"
          onClick={applyPolygonAsWaypoints} 
          title="Apply polygon vertices as waypoints"
        >
          <span>📐</span>
          <span>Apply Polygon</span>
        </button>
        <button
          className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded transition flex items-center gap-2"
          onClick={() => {
            computeContour();
            handleGetContour();
          }}
          title="Get contour (GeoJSON)"
        >
          <span>📊</span>
          <span>Get Contour</span>
        </button>
      </>
    )}
  </div>
);
