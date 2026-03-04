import React from "react";

/**
 * RouteInfoBar Component
 *
 * Displays contextual information about the current route or survey area.
 * It shows metrics such as distance, estimated flight time, altitude, speed,
 * and for area mode: area (hectares), perimeter, and vertex count.
 *
 * @param {Object} props
 * @param {string} [props.routeType="area"] - Type of route: "waypoint", "area", or "survey". Fallback to waypoint.
 * @param {Object} [props.routeParams={}] - Additional route parameters (unused directly but passed for extensibility).
 * @param {number} [props.speed] - Default flight speed (m/s).
 * @param {number} [props.altitude] - Default flight altitude (m).
 * @param {Array} [props.waypoints=[]] - List of waypoint objects (each with lat/lng).
 * @param {number} [props.totalDistance] - Precomputed total distance of the flight path (meters).
 * @param {number} [props.estimatedDuration] - Precomputed estimated flight time (seconds).
 * @param {number} [props.areaHectares=0] - Area of the polygon (hectares) – typically computed in parent.
 * @param {Array} [props.polygonPath=[]] - Array of polygon vertices (each can be a Google LatLng or plain {lat,lng}).
 *
 * @returns {JSX.Element} A translucent bar showing route statistics.
 */
export const RouteInfoBar = ({
  routeType = "area", // "waypoint" | "area" | (other types fallback to waypoint)
  routeParams = {},
  speed,
  altitude,
  waypoints = [],
  totalDistance,
  estimatedDuration,
  areaHectares = 0,
  polygonPath = []
}) => {
  // ========== Safe numeric conversions (avoid NaN) ==========
  const safeTotalDistance = typeof totalDistance === "number" && !Number.isNaN(totalDistance) ? totalDistance : 0;
  const safeEstimatedDuration = typeof estimatedDuration === "number" && !Number.isNaN(estimatedDuration) ? estimatedDuration : 0;
  const safeAltitude = typeof altitude === "number" && !Number.isNaN(altitude) ? altitude : "";
  const safeSpeed = typeof speed === "number" && !Number.isNaN(speed) ? speed : "";

  // ========== Helper: Haversine distance between two points ==========
  /**
   * Calculates the great-circle distance between two geographic points using the haversine formula.
   * Used as a fallback when Google Maps geometry library is unavailable.
   *
   * @param {Object} a - Point A with numeric lat/lng.
   * @param {Object} b - Point B with numeric lat/lng.
   * @returns {number} Distance in meters.
   */
  const haversine = (a, b) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const φ1 = toRad(a.lat);
    const φ2 = toRad(b.lat);
    const Δφ = toRad(b.lat - a.lat);
    const Δλ = toRad(b.lng - a.lng);
    const sinΔφ = Math.sin(Δφ / 2);
    const sinΔλ = Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(
      Math.sqrt(sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ),
      Math.sqrt(1 - (sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ))
    );
    return R * c;
  };

  // ========== Helper: Convert a possibly Google LatLng object to plain {lat,lng} ==========
  /**
   * Normalizes a point that could be either a Google Maps LatLng (with lat()/lng() methods)
   * or a plain object {lat,lng}. Returns a plain object with numeric lat/lng.
   *
   * @param {any} p - Input point.
   * @returns {Object|null} Plain {lat,lng} object or null if invalid.
   */
  const toPlainLatLng = (p) => {
    if (!p) return null;
    // Duck-typing for Google LatLng: if both lat and lng are functions
    if (typeof p.lat === "function" && typeof p.lng === "function") {
      return { lat: p.lat(), lng: p.lng() };
    }
    // Mix of function and primitive
    if (typeof p.lat === "function" && typeof p.lng !== "function") {
      return { lat: p.lat(), lng: p.lng };
    }
    if (typeof p.lat !== "function" && typeof p.lng === "function") {
      return { lat: p.lat, lng: p.lng() };
    }
    // Assume plain {lat: number, lng: number}
    return { lat: Number(p.lat), lng: Number(p.lng) };
  };

  // ========== Memo: Compute polygon perimeter ==========
  /**
   * Computes the perimeter of the polygon (area mode) in meters.
   * Tries to use Google Maps geometry.spherical if available (more accurate),
   * otherwise falls back to haversine.
   */
  const perimeterMeters = React.useMemo(() => {
    if (routeType !== "area" || !Array.isArray(polygonPath) || polygonPath.length < 3) return 0;

    // Try to use Google Maps geometry library if available (client-side)
    if (typeof window !== "undefined") {
      const g = window.google?.maps;
      if (g?.geometry?.spherical) {
        /**
         * Convert a point to a google.maps.LatLng instance.
         * @param {any} p - Input point.
         * @returns {google.maps.LatLng}
         */
        const toLatLngObj = (p) => {
          if (p instanceof g.LatLng) return p;
          const lat = typeof p.lat === "function" ? p.lat() : p.lat;
          const lng = typeof p.lng === "function" ? p.lng() : p.lng;
          return new g.LatLng(lat, lng);
        };
        let perim = 0;
        for (let i = 0; i < polygonPath.length; i++) {
          const cur = toLatLngObj(polygonPath[i]);
          const next = toLatLngObj(polygonPath[(i + 1) % polygonPath.length]);
          perim += g.geometry.spherical.computeDistanceBetween(cur, next);
        }
        return perim;
      }
    }

    // Fallback: haversine formula
    let perim = 0;
    for (let i = 0; i < polygonPath.length; i++) {
      const a = toPlainLatLng(polygonPath[i]);
      const b = toPlainLatLng(polygonPath[(i + 1) % polygonPath.length]);
      if (a && b && Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng)) {
        perim += haversine(a, b);
      }
    }
    return perim;
  }, [polygonPath, routeType]);

  // ========== Memo: Vertex count ==========
  const vertexCount = React.useMemo(() => (routeType === "area" && Array.isArray(polygonPath) ? polygonPath.length : 0), [polygonPath, routeType]);

  // ========== Helper: Format duration (seconds → "Xm Ys") ==========
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // ========== Render content based on route type ==========
  /**
   * Renders statistics for a waypoint‑based route.
   * Shows number of waypoints, total distance, estimated time, altitude, speed.
   */
  const WaypointRouteInfo = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-6">
        <div className="text-sm">
          <div className="text-gray-500">Waypoints</div>
          <div className="font-semibold text-gray-800">{Array.isArray(waypoints) ? waypoints.length : 0}</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Total Distance</div>
          <div className="font-semibold text-gray-800">{safeTotalDistance.toFixed(0)} m</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Estimated Time</div>
          <div className="font-semibold text-gray-800">{formatDuration(safeEstimatedDuration)}</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Altitude</div>
          <div className="font-semibold text-gray-800">{safeAltitude !== "" ? `${safeAltitude} m` : "-"}</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Speed</div>
          <div className="font-semibold text-gray-800">{safeSpeed !== "" ? `${safeSpeed} m/s` : "-"}</div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          Array.isArray(waypoints) && waypoints.length > 0
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800"
        }`}>
          {Array.isArray(waypoints) && waypoints.length > 0 ? "Ready to Fly" : "No Waypoints"}
        </div>
      </div>
    </div>
  );

  /**
   * Renders statistics for an area (survey) mode.
   * Shows area (ha), perimeter, vertices, altitude, speed, plus flight distance/time if available.
   */
  const AreaRouteInfo = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-6">
        <div className="text-sm">
          <div className="text-gray-500">Area</div>
          <div className="font-semibold text-green-700">{Number(areaHectares).toFixed(2)} ha</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Perimeter</div>
          <div className="font-semibold text-gray-800">{perimeterMeters.toFixed(0)} m</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Vertices</div>
          <div className="font-semibold text-gray-800">{vertexCount}</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Flight Altitude</div>
          <div className="font-semibold text-gray-800">{safeAltitude !== "" ? `${safeAltitude} m` : "-"}</div>
        </div>

        <div className="text-sm">
          <div className="text-gray-500">Flight Speed</div>
          <div className="font-semibold text-gray-800">{safeSpeed !== "" ? `${safeSpeed} m/s` : "-"}</div>
        </div>

        {safeTotalDistance > 0 && (
          <div className="text-sm">
            <div className="text-gray-500">Flight Distance</div>
            <div className="font-semibold text-gray-800">{safeTotalDistance.toFixed(0)} m</div>
          </div>
        )}

        {safeEstimatedDuration > 0 && (
          <div className="text-sm">
            <div className="text-gray-500">Flight Time</div>
            <div className="font-semibold text-gray-800">{formatDuration(safeEstimatedDuration)}</div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          vertexCount >= 3
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800"
        }`}>
          {vertexCount >= 3 ? "Area Defined" : "Draw Area"}
        </div>
      </div>
    </div>
  );

  /**
   * Selects which info block to render based on routeType.
   * Supports "area" / "survey" (same) and falls back to waypoint for any other value.
   */
  const renderByType = () => {
    switch ((routeType || "").toLowerCase()) {
      case "area":
      case "survey":
        return AreaRouteInfo;
      case "waypoint":
      default:
        return WaypointRouteInfo;
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
      {renderByType()}
    </div>
  );
};

export default RouteInfoBar;
