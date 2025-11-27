// src/components/MapView.jsx
import React, { useRef, useCallback, useMemo, useState, useEffect } from "react";
import {
  GoogleMap,
  Marker,
  Polyline,
  Polygon,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";
import * as turf from "@turf/turf";
import { MAP_CONFIG, SHAPE_COLORS } from "../utils/MapView.constants";
import { TopControls } from "./TopControls";
import { RouteInfoBar } from "./RouteInfoBar";

/**
 * MapView - robust version
 * - Guards all window.google accesses behind `isLoaded` checks.
 * - Removes hard-coded / fallback API key (expect VITE_GOOGLE_MAPS_API_KEY).
 * - Cleans up polygon listeners reliably.
 * - Preserves all behavior: adding waypoints on click, polygon editing, lawnmower generation.
 */
// Add these constants after your imports in MapView.jsx
const waypointTypes = [
  { value: "straight_stop", label: "Straight route. Aircraft stops" },
  { value: "coordinated_turn", label: "Coordinated Turn (Skips Waypoint)" },
  { value: "curved_stop", label: "Curved route. Aircraft stops" },
  { value: "curved_continue", label: "Curved route. Aircraft continues" },
];

const aircraftYawModes = [
  { value: "route", label: "Along the Route" },
  { value: "manual", label: "Manual" },
  { value: "lock", label: "Lock Yaw Axis" },
];

const aircraftRotationModes = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
];
export default function MapView({
  waypoints = [],
  path = [],
  photoPoints = [],
  flightLines = [],
  setWaypoints,
  setPath,
  altitude,
  speed,
  mapCenter,
  setMapCenter,
  mapZoom,
  setMapZoom,
  routeParams = {},
  routeType = "waypoint",
  selectedMarker,
  setSelectedMarker,
  onEditWaypoint,
}) {
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const polygonRef = useRef(null);
  const polygonPathListenersRef = useRef([]);

  const [polygonPath, setPolygonPath] = useState([]);
  const [searchPlace, setSearchPlace] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { isLoaded } = useJsApiLoader({
    // Provide your API key via VITE_GOOGLE_MAPS_API_KEY
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyC20LuxJUoy120cX8HurFsT5pu1JWAvhSA",
    libraries: MAP_CONFIG.libraries,
  });

  // keep polygonPath in sync when switching to area or when waypoints change
  useEffect(() => {
    if (routeType === "area") {
      setPolygonPath(Array.isArray(waypoints) ? waypoints.map((w) => ({ lat: w.lat, lng: w.lng })) : []);
    } else {
      setPolygonPath([]);
    }
  }, [routeType, waypoints]);

  // compute area in hectares (guarded)
  const areaHectares = useMemo(() => {
    if (!isLoaded || !window.google?.maps || polygonPath.length < 3) return 0;
    const latlngs = polygonPath.map((p) => new window.google.maps.LatLng(p.lat, p.lng));
    return window.google.maps.geometry.spherical.computeArea(latlngs) / 10000;
  }, [polygonPath, isLoaded]);

  // compute total distance of path (meters)
  const totalDistance = useMemo(() => {
    if (!isLoaded || !window.google?.maps || !Array.isArray(path) || path.length < 2) return 0;
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      distance +=
        window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(prev.lat, prev.lng),
          new window.google.maps.LatLng(curr.lat, curr.lng)
        );
    }
    return distance;
  }, [path, isLoaded]);

  const estimatedDuration = useMemo(() => {
    const s = routeParams.speed || speed || 1;
    return s > 0 ? totalDistance / s : 0;
  }, [totalDistance, routeParams.speed, speed]);

  // helpers for turf
  const closeCoordsRing = (coords) => {
    if (!coords || coords.length === 0) return coords;
    const last = coords[coords.length - 1];
    const first = coords[0];
    // numeric comparison
    if (first[0] !== last[0] || first[1] !== last[1]) coords = [...coords, first];
    return coords;
  };

  const isValidPolygon = useCallback((pathArr) => {
    if (!Array.isArray(pathArr) || pathArr.length < 3) return false;
    try {
      const coords = pathArr.map((p) => [p.lng, p.lat]);
      const ring = closeCoordsRing(coords);
      const poly = turf.polygon([ring]);
      const kinks = turf.kinks(poly);
      return !(kinks && Array.isArray(kinks.features) && kinks.features.length > 0);
    } catch {
      return false;
    }
  }, []);

  // selection index
  const selectedIndex = useMemo(() => {
    if (selectedMarker == null) return null;
    if (typeof selectedMarker === "number") return selectedMarker;
    return waypoints.findIndex((w) => w.id === selectedMarker);
  }, [selectedMarker, waypoints]);

  const selectedWp = selectedIndex != null && selectedIndex >= 0 ? waypoints[selectedIndex] : null;

  // icon anchor & label origin points (guarded)
  const ICON_POINTS = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return { Point: { x: 12, y: 22 }, LabelPoint: { x: 12, y: 10 } };
    return {
      Point: new window.google.maps.Point(12, 22),
      LabelPoint: new window.google.maps.Point(12, 10),
    };
  }, [isLoaded]);

  // marker icon factory (returns undefined until maps loaded)
  const markerIcon = useCallback(
    ({ isActive }) => {
      if (!isLoaded || !window.google?.maps) return undefined;
      return {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
        fillColor: isActive ? "#f59e42" : "#2563eb",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: isActive ? "#fff" : "#c7d2fe",
        scale: 1.6,
        labelOrigin: ICON_POINTS.LabelPoint,
        anchor: ICON_POINTS.Point,
      };
    },
    [isLoaded, ICON_POINTS]
  );

  // map click adds a waypoint (works for area mode too)
  const handleMapClick = useCallback(
    (e) => {
      if (!isLoaded) return;
      const latLng = e?.latLng;
      if (!latLng) return;
      const newPoint = { lat: latLng.lat(), lng: latLng.lng() };

      setWaypoints((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          lat: newPoint.lat,
          lng: newPoint.lng,
          alt: altitude,
          speed,
        },
      ]);
    },
    [altitude, speed, setWaypoints, isLoaded]
  );

  // update waypoint when dragging a vertex marker
  const handleMarkerDragEnd = useCallback(
    (index, e) => {
      if (typeof index !== "number") return;
      const latLng = e?.latLng;
      if (!latLng) return;
      setWaypoints((prev) =>
        prev.map((wp, idx) => (idx === index ? { ...wp, lat: latLng.lat(), lng: latLng.lng() } : wp))
      );
    },
    [setWaypoints]
  );

  const handleDeleteVertex = useCallback(
    (idx) => {
      setWaypoints((prev) => prev.filter((_, i) => i !== idx));
    },
    [setWaypoints]
  );

  const clearWaypoints = useCallback(() => {
    setWaypoints([]);
    setPolygonPath([]);
  }, [setWaypoints]);

  const clearPath = useCallback(() => {
    setPath([]);
  }, [setPath]);

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace?.();
    if (place?.geometry?.location && mapRef.current) {
      const loc = place.geometry.location;
      const newCenter = { lat: loc.lat(), lng: loc.lng() };
      setMapCenter(newCenter);
      mapRef.current.panTo(newCenter);
      mapRef.current.setZoom(15);
      setMapZoom(15);

      setSearchPlace({
        name: place.name,
        address: place.formatted_address,
        coordinates: newCenter,
      });
    }
  }, [setMapCenter, setMapZoom]);

  // polygon editing listeners: update waypoints when user edits polygon via Google maps handles
  const attachPolygonPathListeners = useCallback(
    (gmPolygon) => {
      if (!gmPolygon || !gmPolygon.getPath || !isLoaded || !window.google?.maps) return;
      // remove previous listeners
      polygonPathListenersRef.current.forEach((l) => l.remove && l.remove());
      polygonPathListenersRef.current = [];

      const pathMVC = gmPolygon.getPath();

      const pushUpdate = () => {
        const arr = pathMVC.getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
        // set both polygonPath and waypoints (preserve ids where possible)
        setPolygonPath(arr);
        setWaypoints((prev) => {
          const next = arr.map((p, i) => ({
            id: prev[i]?.id ?? Date.now() + i,
            lat: p.lat,
            lng: p.lng,
            alt: prev[i]?.alt ?? altitude,
            speed: prev[i]?.speed ?? speed,
          }));
          return next;
        });
      };

      // listen for edits
      const onSetAt = pathMVC.addListener("set_at", pushUpdate);
      const onInsertAt = pathMVC.addListener("insert_at", pushUpdate);
      const onRemoveAt = pathMVC.addListener("remove_at", pushUpdate);

      polygonPathListenersRef.current = [onSetAt, onInsertAt, onRemoveAt];
    },
    [setPolygonPath, setWaypoints, altitude, speed, isLoaded]
  );

  // polygon load hook
  const onPolygonLoad = useCallback(
    (polygon) => {
      polygonRef.current = polygon;
      attachPolygonPathListeners(polygon);
    },
    [attachPolygonPathListeners]
  );

  // cleanup listeners on unmount
  useEffect(() => {
    return () => {
      polygonPathListenersRef.current.forEach((l) => l.remove && l.remove());
      polygonPathListenersRef.current = [];
    };
  }, []);

  // generate lawnmower (unchanged logic but wrapped safely)
  const generateLawnmower = useCallback(
    (opts = {}) => {
      if (!isValidPolygon(polygonPath) || polygonPath.length < 3) return null;
      setGenerating(true);
      try {
        const spacingMeters = opts.spacingMeters || routeParams.spacingMeters || 20;
        const alt = opts.alt || altitude || 30;
        const spd = opts.speed || routeParams.speed || speed || 5;

        const coords = polygonPath.map((p) => [p.lng, p.lat]);
        const closed = closeCoordsRing(coords);
        const poly = turf.polygon([closed]);
        const bbox = turf.bbox(poly); // [minLng, minLat, maxLng, maxLat]

        const lines = [];
        let currentPoint = turf.point([bbox[0], bbox[1]]);
        let stepCount = 0;
        while (true) {
          if (stepCount++ > 2000) break;
          const currentLat = currentPoint.geometry.coordinates[1];
          if (currentLat > bbox[3] + 1e-9) break;
          const start = [bbox[0], currentLat];
          const end = [bbox[2], currentLat];
          lines.push(turf.lineString([start, end]));
          currentPoint = turf.destination(currentPoint, spacingMeters / 1000, 0, { units: "kilometers" });
        }

        const segments = [];
        lines.forEach((line, idx) => {
          const intersects = turf.lineIntersect(line, poly);
          if (!intersects || !Array.isArray(intersects.features) || intersects.features.length === 0) return;
          const pts = intersects.features.map((f) => f.geometry.coordinates);
          if (pts.length < 2) return;
          pts.sort((a, b) => a[0] - b[0]);
          for (let i = 0; i + 1 < pts.length; i += 2) {
            const a = pts[i];
            const b = pts[i + 1];
            if (idx % 2 === 0) segments.push([a, b]);
            else segments.push([b, a]);
          }
        });

        const flightPoints = [];
        segments.forEach((seg) => {
          flightPoints.push({ lat: seg[0][1], lng: seg[0][0], alt, speed: spd });
          flightPoints.push({ lat: seg[1][1], lng: seg[1][0], alt, speed: spd });
        });

        const deduped = [];
        for (let i = 0; i < flightPoints.length; i++) {
          const p = flightPoints[i];
          const prev = deduped[deduped.length - 1];
          if (!prev || Math.abs(prev.lat - p.lat) > 1e-8 || Math.abs(prev.lng - p.lng) > 1e-8) deduped.push(p);
        }

        setPath(deduped.map((p) => ({ lat: p.lat, lng: p.lng, alt: p.alt, speed: p.speed })));
        setGenerating(false);
        return deduped;
      } catch (err) {
        console.error("generateLawnmower failed", err);
        setGenerating(false);
        return null;
      }
    },
    [polygonPath, routeParams, altitude, speed, setPath, isValidPolygon]
  );

  const DebugPanel = () => (
    <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded text-xs">
      <div>Polygon vertices: {polygonPath.length}</div>
      <div>Valid polygon: {isValidPolygon(polygonPath) ? "Yes" : "No"}</div>
      <div>Area: {areaHectares.toFixed(2)} ha</div>
      <div>Path points: {path.length}</div>
      <div>Distance: {(totalDistance / 1000).toFixed(3)} km</div>
    </div>
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="p-6 text-gray-700">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <TopControls
        autocompleteRef={autocompleteRef}
        handlePlaceChanged={handlePlaceChanged}
        clearWaypoints={clearWaypoints}
        clearPath={clearPath}
      />

      <div className="absolute right-4 top-16 z-50">
        <div className="bg-white rounded shadow p-2 text-sm">
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded"
            onClick={() => generateLawnmower({ spacingMeters: routeParams.spacingMeters || 20 })}
            disabled={generating || !isValidPolygon(polygonPath)}
          >
            {generating ? "Generating..." : "Generate LawnMower"}
          </button>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={MAP_CONFIG.containerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
        }}
      >
        {searchPlace && (
          <Marker position={searchPlace.coordinates} icon={{ url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" }} title={searchPlace.name} zIndex={1000} />
        )}

        {waypoints.map((wp, i) => (
          <Marker
            key={wp.id ?? i}
            position={{ lat: wp.lat, lng: wp.lng }}
            draggable
            onDragEnd={(e) => handleMarkerDragEnd(i, e)}
            onRightClick={() => handleDeleteVertex(i)}
            onClick={() => setSelectedMarker(i)}
            icon={markerIcon({ isActive: selectedIndex === i })}
            label={{
              text: String(i + 1),
              color: selectedIndex === i ? "#fff" : "#1e293b",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          />
        ))}

        {/* Start/End markers for waypoint routes */}
        {routeType !== "area" && waypoints.length > 0 && (
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
                anchor: ICON_POINTS.Point,
                labelOrigin: ICON_POINTS.LabelPoint,
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
                  anchor: ICON_POINTS.Point,
                  labelOrigin: ICON_POINTS.LabelPoint,
                }}
                label={{ text: "E", color: "#fff", fontWeight: "bold" }}
                clickable={false}
                zIndex={10}
              />
            )}
          </>
        )}

        {/* Area mode: editable polygon + optional vertex markers */}
        {routeType === "area" && polygonPath && polygonPath.length > 0 && (
          <>
            <Polygon
              paths={polygonPath.map((p) => ({ lat: p.lat, lng: p.lng }))}
              editable={true}
              options={{
                strokeColor: "#2563eb",
                strokeOpacity: 0.9,
                strokeWeight: 3,
                fillColor: "#3b82f6",
                fillOpacity: 0.12,
                clickable: true,
                zIndex: 5,
              }}
              onLoad={onPolygonLoad}
            />

            {/* Visible draggable markers for vertex editing */}
            {polygonPath.map((p, i) => (
              <Marker
                key={`area-vertex-${i}`}
                position={{ lat: p.lat, lng: p.lng }}
                draggable
                onDragEnd={(e) => handleMarkerDragEnd(i, e)}
                onRightClick={() => handleDeleteVertex(i)}
                onClick={() => setSelectedMarker(i)}
                icon={markerIcon({ isActive: selectedIndex === i })}
                label={{
                  text: String(i + 1),
                  color: selectedIndex === i ? "#fff" : "#1e293b",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
            ))}
          </>
        )}

        {/* Render polygon fill if not in area mode but polygonPath exists */}
        {polygonPath && polygonPath.length >= 3 && routeType !== "area" && (
          <Polygon
            paths={polygonPath.map((p) => ({ lat: p.lat, lng: p.lng }))}
            options={{
              strokeColor: "#2563eb",
              strokeOpacity: 0.9,
              strokeWeight: 3,
              fillColor: "#3b82f6",
              fillOpacity: 0.12,
            }}
          />
        )}

        {path && path.length >= 2 && (
          <Polyline
            path={path.map((p) => ({ lat: p.lat, lng: p.lng }))}
            options={{
              strokeColor: SHAPE_COLORS.PATH,
              strokeOpacity: 0.95,
              strokeWeight: 3,
              zIndex: 6,
            }}
          />
        )}

        {Array.isArray(flightLines) &&
          flightLines.length > 0 &&
          flightLines.map((seg, idx) => {
            const start = seg[0],
              end = seg[1];
            if (!start || !end) return null;
            return (
              <Polyline
                key={`flight-line-${idx}`}
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
            );
          })}

        {Array.isArray(photoPoints) &&
          photoPoints.length > 0 &&
          photoPoints.map((p, idx) => (
            <Marker
              key={`photo-${idx}`}
              position={{ lat: p.lat, lng: p.lng }}
              clickable={false}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: "#10b981",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 1,
                scale: 4,
              }}
            />
          ))}

         {selectedWp && (
  <InfoWindow position={{ lat: selectedWp.lat, lng: selectedWp.lng }} onCloseClick={() => setSelectedMarker(null)}>
    <div className="min-w-[280px] p-3 rounded-lg bg-[#001f3f] text-white shadow-lg text-sm">
      <h4 className="font-semibold text-blue-300 mb-2 border-b border-blue-500 pb-1">Waypoint Info</h4>
      <div className="space-y-2">
        {/* Basic Coordinates */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400 text-xs">Latitude</div>
            <div className="font-mono">{selectedWp.lat?.toFixed(6)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Longitude</div>
            <div className="font-mono">{selectedWp.lng?.toFixed(6)}</div>
          </div>
        </div>

        {/* Speed and Altitude */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400 text-xs">Altitude</div>
            <div>{selectedWp.alt != null ? `${selectedWp.alt.toFixed(1)} m` : 'Not set'}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Speed</div>
            <div>{selectedWp.speed != null ? `${selectedWp.speed.toFixed(1)} m/s` : 'Not set'}</div>
          </div>
        </div>

        {/* Waypoint Parameters */}
        <div className="border-t border-blue-700 pt-2 mt-2">
          <div className="text-gray-400 text-xs mb-1">Waypoint Parameters</div>
          
          {/* Waypoint Type */}
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-300">Type:</span>
            <span className="text-blue-300">
              {selectedWp.waypointType ? 
                waypointTypes.find(w => w.value === selectedWp.waypointType)?.label || selectedWp.waypointType 
                : 'Straight Stop'
              }
            </span>
          </div>

          {/* Aircraft Yaw */}
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-300">Aircraft Yaw:</span>
            <span className="text-blue-300">
              {selectedWp.aircraftYaw ? 
                aircraftYawModes.find(m => m.value === selectedWp.aircraftYaw)?.label || selectedWp.aircraftYaw 
                : 'Along Route'
              }
            </span>
          </div>

          {/* Gimbal Pitch */}
          {selectedWp.gimbalPitch != null && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300">Gimbal Pitch:</span>
              <span className="text-blue-300">{selectedWp.gimbalPitch}°</span>
            </div>
          )}

          {/* Aircraft Rotation */}
          {selectedWp.aircraftRotation && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300">Rotation Mode:</span>
              <span className="text-blue-300">
                {aircraftRotationModes.find(m => m.value === selectedWp.aircraftRotation)?.label || selectedWp.aircraftRotation}
              </span>
            </div>
          )}

          {/* Follow Route Settings */}
          <div className="mt-2 pt-2 border-t border-blue-800">
            <div className="text-gray-400 text-xs mb-1">Follows Route For:</div>
            <div className="flex flex-wrap gap-1">
              {selectedWp.followRouteSpeed && <span className="bg-blue-800 px-2 py-1 rounded text-xs">Speed</span>}
              {selectedWp.followRouteRelativeAltitude && <span className="bg-blue-800 px-2 py-1 rounded text-xs">Altitude</span>}
              {selectedWp.followRouteAircraftYaw && <span className="bg-blue-800 px-2 py-1 rounded text-xs">Yaw</span>}
              {selectedWp.followRouteWaypointType && <span className="bg-blue-800 px-2 py-1 rounded text-xs">Type</span>}
              {!selectedWp.followRouteSpeed && !selectedWp.followRouteRelativeAltitude && 
               !selectedWp.followRouteAircraftYaw && !selectedWp.followRouteWaypointType && 
               <span className="text-gray-500 text-xs">Custom settings</span>}
            </div>
          </div>

          {/* Actions Summary */}
          {selectedWp.actions && selectedWp.actions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-400 text-xs">Actions:</span>
                <span className="text-green-400 text-xs">{selectedWp.actions.length} configured</span>
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {selectedWp.actions.slice(0, 5).map((action, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-blue-900 px-2 py-1 rounded">
                    <span className="text-blue-300">•</span>
                    <span className="truncate">{action.type}</span>
                  </div>
                ))}
                {selectedWp.actions.length > 5 && (
                  <div className="text-gray-400 text-xs text-center">
                    +{selectedWp.actions.length - 5} more actions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold text-sm transition-colors"
        onClick={() => onEditWaypoint(selectedIndex)}
      >
        Edit Waypoint
      </button>
    </div>
  </InfoWindow>
)}
      </GoogleMap>

      {process.env.NODE_ENV === "development" && <DebugPanel />}

      <div className="absolute left-0 right-0 bottom-0 z-40">
        <RouteInfoBar
          routeType={routeType}
          routeParams={routeParams}
          speed={speed}
          altitude={altitude}
          waypoints={waypoints}
          totalDistance={totalDistance}
          estimatedDuration={estimatedDuration}
          areaHectares={areaHectares}
          polygonPath={polygonPath}
        />
      </div>
    </div>
  );
}
