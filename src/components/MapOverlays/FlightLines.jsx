import React from "react";
import { Polyline, OverlayView } from "@react-google-maps/api";
import { SHAPE_COLORS } from "../../utils/MapView.constants";

export const FlightLines = ({ flightLines }) => {
  if (!Array.isArray(flightLines) || flightLines.length === 0) return null;

  return flightLines.map((seg, idx) => {
    const start = seg[0], end = seg[1];
    if (!start || !end) return null;
    
    const length = window.google.maps.geometry.spherical.computeDistanceBetween(
      new window.google.maps.LatLng(start.lat, start.lng),
      new window.google.maps.LatLng(end.lat, end.lng)
    );
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    
    return (
      <React.Fragment key={`flight-line-${idx}`}>
        <Polyline
          path={[
            { lat: start.lat, lng: start.lng },
            { lat: end.lat, lng: end.lng },
          ]}
          options={{
            strokeColor: SHAPE_COLORS.FLIGHT_LINE,
            strokeOpacity: 0.95,
            strokeWeight: 2.5,
            zIndex: 5,
          }}
        />
        <OverlayView position={{ lat: midLat, lng: midLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div className="flight-line-label bg-white/90 px-2 py-1 rounded text-xs font-semibold text-gray-700 border border-gray-300">
            {length.toFixed(1)} m
          </div>
        </OverlayView>
      </React.Fragment>
    );
  });
};