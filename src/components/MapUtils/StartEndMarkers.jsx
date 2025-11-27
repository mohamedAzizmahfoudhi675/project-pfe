import React from "react";
import { Marker } from "@react-google-maps/api";

export const StartEndMarkers = ({ waypoints }) => {
  if (waypoints.length === 0) return null;

  return (
    <>
      <Marker 
        position={{ lat: waypoints[0].lat, lng: waypoints[0].lng }} 
        icon={{ 
          path: "M0 0h24v24H0z M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", 
          fillColor: "#10b981", 
          fillOpacity: 1, 
          strokeWeight: 1, 
          strokeColor: "#ffffff", 
          scale: 1.1, 
          anchor: new window.google.maps.Point(12, 22), 
          labelOrigin: new window.google.maps.Point(12, 10) 
        }} 
        label={{ text: "S", color: "#fff", fontWeight: "bold" }} 
        clickable={false} 
        zIndex={10} 
      />
      
      {waypoints.length > 1 && (
        <Marker 
          position={{ lat: waypoints[waypoints.length - 1].lat, lng: waypoints[waypoints.length - 1].lng }} 
          icon={{ 
            path: "M0 0h24v24H0z M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", 
            fillColor: "#2563eb", 
            fillOpacity: 1, 
            strokeWeight: 1, 
            strokeColor: "#ffffff", 
            scale: 1.1, 
            anchor: new window.google.maps.Point(12, 22), 
            labelOrigin: new window.google.maps.Point(12, 10) 
          }} 
          label={{ text: "E", color: "#fff", fontWeight: "bold" }} 
          clickable={false} 
          zIndex={10} 
        />
      )}
    </>
  );
};