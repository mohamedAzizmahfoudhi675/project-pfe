import React from "react";
import { Marker } from "@react-google-maps/api";

export const WaypointMarkers = ({ 
  waypoints, 
  selectedMarker, 
  setSelectedMarker, 
  handleMarkerDragEnd, 
  handleDeleteVertex, 
  markerIcon 
}) => {
  return waypoints.map((wp, i) => (
    <Marker
      key={wp.id}
      position={{ lat: wp.lat, lng: wp.lng }}
      draggable
      onDragEnd={(e) => handleMarkerDragEnd(wp.id, e)}
      onRightClick={() => handleDeleteVertex(i)}
      onClick={() => setSelectedMarker(i)}
      icon={markerIcon({ number: i + 1, isActive: selectedMarker === i })}
      label={{ 
        text: String(i + 1), 
        color: selectedMarker === i ? "#fff" : "#1e293b", 
        fontSize: "14px", 
        fontWeight: "bold" 
      }}
      title={`Waypoint #${i + 1}\nLat: ${wp.lat.toFixed(6)}\nLng: ${wp.lng.toFixed(6)}`}
    />
  ));
};