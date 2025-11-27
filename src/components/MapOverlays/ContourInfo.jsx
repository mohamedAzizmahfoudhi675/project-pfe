import React from "react";
import { OverlayView } from "@react-google-maps/api";

export const ContourInfo = ({ 
  contourInfoVisible, 
  contourMetrics, 
  contourGeoJSON, 
  handleDownloadContour, 
  setContourInfoVisible 
}) => {
  if (!contourInfoVisible || !contourMetrics.centroid) return null;

  return (
    <OverlayView position={contourMetrics.centroid} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <div className="bg-white rounded-lg shadow p-3 text-sm text-slate-800">
        <div className="font-semibold mb-1">Contour</div>
        <div>Area: {(contourMetrics.area_m2 / 10000).toFixed(3)} ha</div>
        <div>Perimeter: {contourMetrics.perimeter_m.toFixed(1)} m</div>
        <div className="mt-2 flex gap-2">
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded"
            onClick={() => {
              if (contourGeoJSON) navigator.clipboard?.writeText(JSON.stringify(contourGeoJSON, null, 2));
            }}
          >
            Copy GeoJSON
          </button>
          <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={handleDownloadContour}>
            Download
          </button>
          <button
            className="px-2 py-1 bg-gray-300 text-slate-800 rounded"
            onClick={() => setContourInfoVisible(false)}
          >
            Close
          </button>
        </div>
      </div>
    </OverlayView>
  );
};