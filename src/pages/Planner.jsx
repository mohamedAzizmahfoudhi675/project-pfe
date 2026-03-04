import React, { useRef, useCallback, useState, useEffect } from "react";
import MapView from "../components/MapView.jsx";
import Sidebar from "../components/Sidebar.jsx";
import WaypointParamsModal from "../components/WaypointParamsModal.jsx";
import AreaRouteParamsPanel from "../components/AreaRouteParamsPanel.jsx";
import * as turf from '@turf/turf';
// Import camera specs and GSD calculator from the panel component
import { calculateGSDForDJI, CAMERA_SPECS } from "../components/AreaRouteParamsPanel.jsx";  

/**
 * Key used for saving planner state to localStorage.
 * @constant {string}
 */
const PLANNER_STATE_KEY = "plannerState";

/**
 * Default parameters for waypoint routes.
 * @type {Object}
 */
const defaultWaypointParams = {
  alt: 50,          // Default altitude in meters
  speed: 5,         // Default speed in m/s
};

/**
 * Default parameters for area (survey) routes.
 * These match the structure used in AreaRouteParamsPanel.
 * @type {Object}
 */
const defaultAreaParams = {
  areaRouteName: "",
  aircraftModel: "M30 Series",
  cameraModel: "M30T",
  lens: "WIDE",
  collectionMode: "Ortho",
  altitudeMode: "relative",
  routeAltitude: 120,
  elevationOptimization: false,
  safeTakeoffAltitude: 66,
  speed: 5,
  courseAngle: 0,
  uponCompletion: "Return To Home",
  gimbalPitchOblique: -45,
  sideOverlap: 70,
  frontOverlap: 80,
  margin: 0,
  photoMode: "Timed Interval Shot",
  takeoffSpeed: 3,
  targetSurfaceToTakeoff: 0,
  // Nested imageQuality – filled by GSD calculation
  imageQuality: {
    gsd: null,
    footprint: { width: null, height: null }
  }
  // legacy fields removed
};

/**
 * Default parameters for linear (corridor) routes.
 * @type {Object}
 */
const defaultLinearParams = {
  altitude: 50,
  speed: 5,
  corridorWidth: 20,
};

/**
 * Fallback battery capacities for different aircraft models (minutes).
 * @type {Object}
 */
const AIRCRAFT_BATTERY_CAPACITY = {
  "default": 30,
  "DJI_Mavic": 27,
  "Phantom4": 28
};

/**
 * Complete default state for the mission planner.
 * Used as a fallback when restoring from localStorage fails.
 * @type {Object}
 */
const DEFAULT_PLANNER_STATE = {
  waypoints: [],                 // Waypoints for non‑area routes
  polygonVertices: [],           // Vertices of the area polygon (area mode)
  path: [],                      // Computed flight path (list of points)
  photoPoints: [],               // Points where photos are triggered
  flightLines: [],               // Line segments for visualisation (lawnmower pattern)
  metrics: "",                   // Human‑readable summary string
  selectedMarker: null,          // Index of currently selected marker on the map
  routeType: "area",             // Current mode: "waypoint", "area", "linear"
  waypointParams: { ...defaultWaypointParams },
  areaParams: { ...defaultAreaParams },
  linearParams: { ...defaultLinearParams },
  sidebarWidth: 380,             // Width of the right sidebar (draggable)
  mapCenter: { lat: 40.7484, lng: -73.9857 }, // Default map center (Empire State Building)
  mapZoom: 15,                   // Default zoom level
  missionAnalytics: null,        // Detailed analytics object from path generation
  warnings: [],                  // List of warning messages
  exportFormats: ["JSON", "KML", "CSV"],
  dualCameraResults: null,       // Placeholder for future dual‑camera support
};

/**
 * Planner Component – Main mission planning page.
 * 
 * Combines a map (MapView) and a sidebar (Sidebar) to allow users to create
 * waypoint, area, or linear missions. Handles state persistence, path generation,
 * editing of waypoints, and export of mission data.
 * 
 * @returns {JSX.Element} The planner page layout.
 */
export default function Planner() {
  // ========== STATE INITIALISATION ==========
  /**
   * plannerState – The core state object for the planner.
   * Initialised by reading from localStorage (if available) or using defaults.
   */
  const [plannerState, setPlannerState] = useState(() => {
    try {
      const saved = localStorage.getItem(PLANNER_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved state with defaults, ensuring arrays exist
        return {
          ...DEFAULT_PLANNER_STATE,
          ...parsed,
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          polygonVertices: Array.isArray(parsed.polygonVertices) ? parsed.polygonVertices : [],
          missionAnalytics: parsed.missionAnalytics || null,
          dualCameraResults: parsed.dualCameraResults || null,
          waypointParams: { ...defaultWaypointParams, ...parsed.waypointParams },
          areaParams: { ...defaultAreaParams, ...parsed.areaParams },
          linearParams: { ...defaultLinearParams, ...parsed.linearParams },
        };
      }
      return DEFAULT_PLANNER_STATE;
    } catch (error) {
      console.error("Error loading saved state:", error);
      return DEFAULT_PLANNER_STATE;
    }
  });

  const [editingWaypointIndex, setEditingWaypointIndex] = useState(null); // Index of waypoint being edited
  const [exportModalOpen, setExportModalOpen] = useState(false);          // Control export modal visibility
  const [selectedExportFormat, setSelectedExportFormat] = useState("JSON"); // Selected export format
  const [showAreaParamsPanel, setShowAreaParamsPanel] = useState(false);  // Control area params panel

  // ========== PERSISTENCE ==========
  /**
   * Save plannerState to localStorage whenever it changes.
   */
  useEffect(() => {
    try {
      localStorage.setItem(PLANNER_STATE_KEY, JSON.stringify(plannerState));
    } catch (error) {
      console.error("Error saving state:", error);
    }
  }, [plannerState]);

  // ========== HELPER FUNCTIONS ==========
  /**
   * Returns the parameter object for the current route type.
   * Merges default values with the user‑provided ones.
   * @returns {Object} The active parameters.
   */
  function getCurrentParams() {
    switch (plannerState.routeType) {
      case "waypoint":
        return { ...defaultWaypointParams, ...plannerState.waypointParams };
      case "area":
        return { ...defaultAreaParams, ...plannerState.areaParams };
      case "linear":
        return { ...defaultLinearParams, ...plannerState.linearParams };
      default:
        return {};
    }
  }

  /**
   * Handles a change of the route type.
   * Resets derived data (path, photo points, flight lines, analytics) when switching.
   * @param {string} type - New route type.
   */
  const handleRouteTypeChange = (type) => {
    setPlannerState((prev) => ({
      ...prev,
      routeType: type,
      path: [],
      photoPoints: [],
      flightLines: [],
      missionAnalytics: null,
      warnings: [],
    }));
  };

  /**
   * Updates the parameters for the current route type.
   * Clears derived data because changes may affect path generation.
   * @param {Object} params - Partial parameter updates.
   */
  const setRouteParams = useCallback((params) => {
    setPlannerState((prev) => {
      const updateKey = `${prev.routeType}Params`;
      return {
        ...prev,
        [updateKey]: { ...prev[updateKey], ...params },
        path: [],
        photoPoints: [],
        flightLines: [],
        missionAnalytics: null,
        warnings: [],
      };
    });
  }, []);

  /**
   * Specifically updates areaParams (used by AreaRouteParamsPanel).
   * @param {Object} params - Partial updates for areaParams.
   */
  const setAreaParams = useCallback((params) => {
    setPlannerState((prev) => ({
      ...prev,
      areaParams: { ...prev.areaParams, ...params },
      path: [],
      photoPoints: [],
      flightLines: [],
      missionAnalytics: null,
      warnings: [],
    }));
  }, []);

  /**
   * Sets the index of the waypoint to be edited.
   * @param {number} index - Index of the waypoint.
   */
  const handleEditWaypoint = useCallback((index) => {
    setEditingWaypointIndex(index);
  }, []);

  /**
   * Callback invoked when the WaypointParamsModal is saved.
   * Updates the appropriate vertex (area mode) or waypoint (other modes) with new parameters.
   * Preserves all fields, including actions, gimbal, yaw, etc.
   * @param {Object} newParams - The updated parameters for the waypoint.
   */
  const handleWaypointModalConfirm = useCallback(
    (newParams) => {
      // Helper to merge new parameters into an existing waypoint
      const updated = (wp) => ({
        ...wp,
        ...newParams,

        // Actions (critical fix)
        actions: newParams.actions || wp.actions || [],

        // Gimbal, yaw, rotation, speed, altitude
        gimbalPitch: newParams.gimbalPitch ?? wp.gimbalPitch,
        aircraftYaw: newParams.aircraftYaw ?? wp.aircraftYaw,
        aircraftRotation: newParams.aircraftRotation ?? wp.aircraftRotation,
        waypointType: newParams.waypointType ?? wp.waypointType,

        // Follow‑route inherited values
        followRouteSpeed: newParams.followRouteSpeed ?? wp.followRouteSpeed,
        followRouteRelativeAltitude: newParams.followRouteRelativeAltitude ?? wp.followRouteRelativeAltitude,
        followRouteWaypointType: newParams.followRouteWaypointType ?? wp.followRouteWaypointType,
        followRouteAircraftYaw: newParams.followRouteAircraftYaw ?? wp.followRouteAircraftYaw,
        followRouteAircraftRotation: newParams.followRouteAircraftRotation ?? wp.followRouteAircraftRotation,

        // Route‑level values – only used if the corresponding follow flag is true
        speed: newParams.followRouteSpeed ? newParams.speed : newParams.speed ?? wp.speed,
        relativeAltitude: newParams.followRouteRelativeAltitude
          ? newParams.relativeAltitude
          : newParams.relativeAltitude ?? wp.relativeAltitude,
      });

      if (plannerState.routeType === "area") {
        // In area mode, update the polygon vertices
        setPlannerState((prev) => ({
          ...prev,
          polygonVertices: prev.polygonVertices.map((v, idx) =>
            idx === editingWaypointIndex ? updated(v) : v
          ),
        }));
      } else {
        // In waypoint/linear mode, update the waypoints
        setPlannerState((prev) => ({
          ...prev,
          waypoints: prev.waypoints.map((wp, idx) =>
            idx === editingWaypointIndex ? updated(wp) : wp
          ),
        }));
      }

      setEditingWaypointIndex(null);
    },
    [editingWaypointIndex, plannerState.routeType]
  );

  /**
   * Cancels waypoint editing.
   */
  const handleWaypointModalCancel = useCallback(() => {
    setEditingWaypointIndex(null);
  }, []);

  // ---------- Local helper functions (geometry, math) ----------
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const toDegrees = (rad) => (rad * 180) / Math.PI;

  /**
   * Calculates the great‑circle distance between two points using the Haversine formula.
   * @param {number} lat1 - Latitude of point A (degrees).
   * @param {number} lon1 - Longitude of point A.
   * @param {number} lat2 - Latitude of point B.
   * @param {number} lon2 - Longitude of point B.
   * @returns {number} Distance in meters.
   */
  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Linearly interpolates between two geographic points.
   * @param {Object} a - Point {lat, lng}.
   * @param {Object} b - Point {lat, lng}.
   * @param {number} t - Interpolation factor (0..1).
   * @returns {Object} Interpolated point.
   */
  const interpolateLatLng = (a, b, t) => ({
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  });

  /**
   * Checks whether a point is near the first vertex of a polygon.
   * Used for auto‑closing the polygon when the user clicks near the start point.
   * @param {Object} point - The point to test.
   * @param {Object} firstPoint - The first vertex of the polygon.
   * @param {number} thresholdMeters - Distance threshold (default 15 m).
   * @returns {boolean} True if the point is within threshold.
   */
  const isNearFirstPoint = (point, firstPoint, thresholdMeters = 15) => {
    if (!firstPoint || !point) return false;
    const distance = haversineDistance(point.lat, point.lng, firstPoint.lat, firstPoint.lng);
    return distance <= thresholdMeters;
  };

  /**
   * Generates a lawnmower (boustrophedon) flight path for area surveys.
   * This function is comprehensive: it takes the polygon vertices and area parameters,
   * calculates optimal flight line spacing and photo intervals based on GSD and overlaps,
   * and produces a full flight path with photo points.
   * 
   * @param {Array} vertices - Array of polygon vertex objects {lat, lng}.
   * @param {Object} areaParams - The current area parameters.
   * @returns {Object} Contains path, photoPoints, flightLines, metrics, missionAnalytics, warnings.
   */
  const generateSimpleAreaPath = useCallback((vertices, areaParams = {}) => {
    const warnings = [];

    if (!Array.isArray(vertices) || vertices.length < 3) {
      return {
        path: [],
        photoPoints: [],
        flightLines: [],
        metrics: "",
        missionAnalytics: null,
        warnings: ["Polygon needs at least 3 vertices"],
      };
    }

    try {
      // Convert to turf format: [lng, lat]
      const coords = vertices.map((v) => [v.lng, v.lat]);

      // Ensure closed ring for turf operations
      const lastCoord = coords[coords.length - 1];
      const firstCoord = coords[0];
      if (coords.length < 4 || lastCoord[0] !== firstCoord[0] || lastCoord[1] !== firstCoord[1]) {
        coords.push([...firstCoord]);
      }

      const originalPoly = turf.polygon([coords]);

      // Validate polygon for self‑intersections
      try {
        const kinks = turf.kinks(originalPoly);
        if (kinks && Array.isArray(kinks.features) && kinks.features.length > 0) {
          warnings.push("Polygon has self-intersections - coverage may be affected");
        }
      } catch (e) {
        warnings.push("Polygon validation failed: " + e.message);
      }

      // ========== PARAMETER PROCESSING ==========
      const alt = areaParams.routeAltitude || 120;
      const spd = areaParams.speed || 5;
      const courseAngle = areaParams.courseAngle || 0;
      const margin = areaParams.margin || 0;
      const collectionMode = areaParams.collectionMode || "Ortho";
      const gimbalPitch = areaParams.gimbalPitchOblique || -45;

      // Calculate GSD using the imported function
      const cameraModel = areaParams.cameraModel || "M30T";
      const gsd = calculateGSDForDJI(alt, cameraModel, {
        useSlantDistance: collectionMode === "Oblique",
        gimbalPitchDeg: gimbalPitch
      });

      // Get camera specifications for footprint calculations
      let cameraSpecs = CAMERA_SPECS[cameraModel] || CAMERA_SPECS.M30T;
      if (cameraModel === "M30T Wide+IR") {
        cameraSpecs = CAMERA_SPECS["M30T Wide+IR"].wide;
      }

      const gsd_m = gsd / 100; // Convert cm/pixel to m/pixel
      const imageWidthMeters = cameraSpecs.imageWidth * gsd_m;
      const imageHeightMeters = cameraSpecs.imageHeight * gsd_m;

      // Overlap values
      const sideOverlap = areaParams.sideOverlap || 70;
      const frontOverlap = areaParams.frontOverlap || 80;

      // Flight line spacing: use manual if provided, otherwise calculate from side overlap
      const manualSpacing = areaParams.flightLineSpacing;
      const spacingMeters = manualSpacing || Math.max(1, Math.round(imageHeightMeters * (1 - sideOverlap / 100)));

      // Photo interval: use manual if provided, otherwise calculate from front overlap
      const manualInterval = areaParams.photoInterval;
      const photoInterval = manualInterval || Math.max(1, Math.round(imageWidthMeters * (1 - frontOverlap / 100)));

      // Apply margin by buffering the polygon inward
      let workingPoly = originalPoly;
      if (margin > 0) {
        try {
          const marginKm = margin / 1000;
          workingPoly = turf.buffer(originalPoly, -marginKm, { units: 'kilometers' });

          if (!workingPoly || turf.area(workingPoly) < 0.0001) {
            warnings.push("Margin too large - using original polygon");
            workingPoly = originalPoly;
          }
        } catch (bufferError) {
          warnings.push("Margin application failed");
          workingPoly = originalPoly;
        }
      }

      // ========== LAWNMOWER PATH GENERATION ==========
      const center = turf.centerOfMass(workingPoly);
      const centerCoords = center.geometry.coordinates;

      // Rotate polygon to align flight lines with the desired course angle
      const rotatedPoly = turf.transformRotate(workingPoly, -courseAngle, { pivot: centerCoords });
      const bbox = turf.bbox(rotatedPoly);
      const [minLng, minLat, maxLng, maxLat] = bbox;

      const polyHeight = turf.distance([minLng, minLat], [minLng, maxLat], { units: 'kilometers' }) * 1000;

      // Generate parallel flight lines (lawnmower pattern)
      const lines = [];
      const numLines = Math.ceil(polyHeight / spacingMeters) + 2; // +2 for coverage beyond bounds

      for (let i = 0; i <= numLines; i++) {
        const offset = (i - 1) * spacingMeters; // Start slightly before the polygon
        const lineLat = minLat + (offset / 111320); // Approximate meters to degrees (latitude)

        // Create a flight line that extends beyond the polygon's longitudinal bounds
        const flightLine = turf.lineString([
          [minLng - 0.01, lineLat],  // extend left
          [maxLng + 0.01, lineLat]   // extend right
        ]);

        try {
          // Find intersections of the line with the rotated polygon
          const intersections = turf.lineIntersect(flightLine, rotatedPoly);

          if (intersections.features.length >= 2) {
            const points = intersections.features.map(f => f.geometry.coordinates);

            // Sort points by longitude (left to right)
            points.sort((a, b) => a[0] - b[0]);

            // For complex polygons, there may be multiple segments per line.
            // We take pairs of intersection points to form flight segments.
            for (let segIndex = 0; segIndex < points.length - 1; segIndex += 2) {
              if (segIndex + 1 < points.length) {
                const startPoint = points[segIndex];
                const endPoint = points[segIndex + 1];

                // Only create segments with meaningful length (>0.1 m)
                const segmentLength = turf.distance(startPoint, endPoint, { units: 'kilometers' }) * 1000;
                if (segmentLength > 0.1) {
                  const segmentRotated = turf.lineString([startPoint, endPoint]);
                  // Rotate back to original orientation
                  const segmentOriginal = turf.transformRotate(segmentRotated, courseAngle, { pivot: centerCoords });

                  lines.push({
                    segment: segmentOriginal,
                    index: i,
                    originalCoords: [startPoint, endPoint],
                    length: segmentLength
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn("Error processing flight line:", e);
        }
      }

      if (lines.length === 0) {
        return {
          path: [],
          photoPoints: [],
          flightLines: [],
          metrics: "",
          missionAnalytics: null,
          warnings: [...warnings, "No valid flight lines generated - check polygon geometry"],
        };
      }

      // ========== PATH CONSTRUCTION (CONTINUOUS LAWNMOWER) ==========
      // Sort lines by their index (which corresponds to their Y position)
      lines.sort((a, b) => a.index - b.index);

      const flightPoints = [];
      const flightLinesDisplay = [];
      let currentPosition = null;

      lines.forEach((lineObj, index) => {
        const coords = lineObj.segment.geometry.coordinates;
        if (coords.length < 2) return;

        const [start, end] = coords;
        let segmentStart, segmentEnd;

        // Alternate direction for efficient coverage (true lawnmower pattern)
        if (index % 2 === 0) {
          // Left to right
          segmentStart = { lng: start[0], lat: start[1] };
          segmentEnd = { lng: end[0], lat: end[1] };
        } else {
          // Right to left
          segmentStart = { lng: end[0], lat: end[1] };
          segmentEnd = { lng: start[0], lat: start[1] };
        }

        // Add transition from previous segment (if not the first segment)
        if (currentPosition && index > 0) {
          const transitionStart = currentPosition;
          const transitionEnd = segmentStart;
          const transitionDistance = haversineDistance(
            transitionStart.lat, transitionStart.lng,
            transitionEnd.lat, transitionEnd.lng
          );

          if (transitionDistance > 1) { // Only add transitions > 1 m
            flightPoints.push({
              ...transitionStart,
              alt,
              speed: spd,
              action: "TRANSITION"
            });

            // Add intermediate points for long transitions (smooth flight)
            if (transitionDistance > spacingMeters * 2) {
              const numTransitionPoints = Math.floor(transitionDistance / spacingMeters);
              for (let i = 1; i < numTransitionPoints; i++) {
                const t = i / numTransitionPoints;
                const transitionPoint = interpolateLatLng(transitionStart, transitionEnd, t);
                flightPoints.push({
                  ...transitionPoint,
                  alt,
                  speed: spd,
                  action: "TRANSITION"
                });
              }
            }

            flightPoints.push({
              ...transitionEnd,
              alt,
              speed: spd,
              action: "TRANSITION"
            });
          }
        }

        // Add the main flight segment
        flightPoints.push({
          ...segmentStart,
          alt,
          speed: spd,
          action: "FLIGHT_LINE"
        });

        // Add intermediate points along the flight line for long segments
        const segmentDistance = haversineDistance(segmentStart.lat, segmentStart.lng, segmentEnd.lat, segmentEnd.lng);
        if (segmentDistance > photoInterval * 2) {
          const numIntermediatePoints = Math.floor(segmentDistance / photoInterval);
          for (let i = 1; i < numIntermediatePoints; i++) {
            const t = i / numIntermediatePoints;
            const intermediatePoint = interpolateLatLng(segmentStart, segmentEnd, t);
            flightPoints.push({
              ...intermediatePoint,
              alt,
              speed: spd,
              action: "FLIGHT_LINE"
            });
          }
        }

        flightPoints.push({
          ...segmentEnd,
          alt,
          speed: spd,
          action: "FLIGHT_LINE"
        });

        currentPosition = { ...segmentEnd };

        // Store for visualisation (simple line between segment ends)
        flightLinesDisplay.push([
          { lat: start[1], lng: start[0] },
          { lat: end[1], lng: end[0] }
        ]);
      });

      // ========== PHOTO POINT GENERATION ==========
      const photoPoints = [];
      const photoMode = areaParams.photoMode || "Timed Interval Shot";

      lines.forEach((lineObj) => {
        const coords = lineObj.segment.geometry.coordinates;
        if (coords.length < 2) return;

        const start = { lat: coords[0][1], lng: coords[0][0] };
        const end = { lat: coords[1][1], lng: coords[1][0] };

        const segmentLength = haversineDistance(start.lat, start.lng, end.lat, end.lng);
        const numPhotos = Math.max(1, Math.floor(segmentLength / photoInterval));

        // Generate evenly spaced photo points along the segment
        for (let i = 0; i <= numPhotos; i++) {
          const t = numPhotos > 0 ? i / numPhotos : 0;
          const photoPoint = interpolateLatLng(start, end, t);

          photoPoints.push({
            lat: photoPoint.lat,
            lng: photoPoint.lng,
            alt,
            trigger: true,
            gimbalPitch: collectionMode === "Oblique" ? gimbalPitch : -90,
            cameraAction: "CAPTURE",
            cameraModel,
            focalLength: cameraSpecs.focalLength,
            sensorWidth: cameraSpecs.sensorWidth,
            // Sequencing information
            sequence: photoPoints.length + 1,
            lineIndex: lineObj.index
          });
        }
      });

      // ========== MISSION ANALYTICS & QUALITY ASSESSMENT ==========
      let totalDistance = 0;
      let flightLineDistance = 0;
      let transitionDistance = 0;

      for (let i = 1; i < flightPoints.length; i++) {
        const segmentDistance = haversineDistance(
          flightPoints[i - 1].lat, flightPoints[i - 1].lng,
          flightPoints[i].lat, flightPoints[i].lng
        );
        totalDistance += segmentDistance;

        if (flightPoints[i].action === "FLIGHT_LINE") {
          flightLineDistance += segmentDistance;
        } else {
          transitionDistance += segmentDistance;
        }
      }

      const flightTimeMinutes = Math.ceil(totalDistance / (spd * 60));
      const areaSqM = turf.area(workingPoly) * 1000000;
      const coverageArea = Math.round(areaSqM);

      const totalFlightLineCoverage = lines.reduce((sum, line) => sum + line.length, 0);
      const effectiveCoverageWidth = spacingMeters;
      const theoreticalCoverage = totalFlightLineCoverage * effectiveCoverageWidth;
      const coverageEfficiency = theoreticalCoverage > 0 ? Math.round((coverageArea / theoreticalCoverage) * 100) : 0;

      const groundSamplingDistance = gsd;
      const imageFootprint = {
        width: Math.round(imageWidthMeters * 10) / 10,
        height: Math.round(imageHeightMeters * 10) / 10
      };

      const missionAnalytics = {
        // Mission Basics
        vertexCount: vertices.length,
        flightLines: lines.length,
        photoPoints: photoPoints.length,
        totalDistance: Math.round(totalDistance),
        flightLineDistance: Math.round(flightLineDistance),
        transitionDistance: Math.round(transitionDistance),
        estimatedFlightTime: flightTimeMinutes,
        coverageArea,

        // Image Quality
        gsd: Math.round(groundSamplingDistance * 100) / 100,
        imageFootprint,
        cameraModel,
        collectionMode,
        gimbalPitch: collectionMode === "Oblique" ? gimbalPitch : -90,
        qualityLevel: groundSamplingDistance < 1 ? "Survey Grade" :
                      groundSamplingDistance < 3 ? "Engineering" :
                      groundSamplingDistance < 5 ? "Mapping" : "Reconnaissance",

        // Flight Parameters
        altitude: alt,
        speed: spd,
        courseAngle,
        spacingMeters,
        photoInterval,
        sideOverlap,
        frontOverlap,
        margin,

        // Coverage Analysis
        coverageEfficiency,
        areaPerPhoto: Math.round((imageWidthMeters * imageHeightMeters) * 100) / 100,
        totalAreaCovered: Math.round(theoreticalCoverage),
        coverageRedundancy: Math.round((photoPoints.length * imageWidthMeters * imageHeightMeters) / coverageArea * 100),

        // Performance Metrics
        flightEfficiency: Math.round((flightLineDistance / totalDistance) * 100),
        photosPerMinute: Math.round(photoPoints.length / flightTimeMinutes),
        areaCoverageRate: Math.round(coverageArea / flightTimeMinutes)
      };

      const metrics = `🏠 Lawnmower Coverage: ${coverageArea}m² | ${lines.length} lines | ${photoPoints.length} photos | GSD: ${gsd.toFixed(2)}cm | 🕒 ${flightTimeMinutes}min | 🎯 ${coverageEfficiency}% efficient`;

      // Intelligent warnings based on analysis
      if (coverageEfficiency < 85) {
        warnings.push(`Coverage efficiency ${coverageEfficiency}% - consider adjusting flight line spacing`);
      }
      if (missionAnalytics.flightEfficiency < 70) {
        warnings.push(`Flight efficiency ${missionAnalytics.flightEfficiency}% - high transition time`);
      }
      if (manualSpacing && manualSpacing > imageHeightMeters * 1.2) {
        warnings.push("Flight line spacing may result in coverage gaps");
      }
      if (manualInterval && manualInterval > imageWidthMeters * 1.2) {
        warnings.push("Photo interval may result in insufficient front overlap");
      }
      if (groundSamplingDistance > 8) {
        warnings.push("GSD > 8cm - consider lower altitude for better detail");
      }

      return {
        path: flightPoints,
        photoPoints,
        flightLines: flightLinesDisplay,
        metrics,
        missionAnalytics,
        warnings: [...new Set(warnings)], // Remove duplicates
      };
    } catch (error) {
      console.error("Lawnmower path generation error:", error);
      return {
        path: [],
        photoPoints: [],
        flightLines: [],
        metrics: "",
        missionAnalytics: null,
        warnings: [`Lawnmower generation failed: ${error.message}`],
      };
    }
  }, [haversineDistance, interpolateLatLng, calculateGSDForDJI, CAMERA_SPECS]);

  /**
   * Handles updates to waypoints or polygon vertices.
   * This is passed to MapView as setWaypoints. It can accept a new array or an updater function.
   * For area mode, it also implements auto‑closing of the polygon when the last vertex is near the first.
   * 
   * @param {Array|Function} cb - New waypoints array or updater function.
   */
  const handleWaypointsUpdate = useCallback((cb) => {
    setPlannerState((prev) => {
      const currentData = prev.routeType === "area" ? prev.polygonVertices : prev.waypoints;
      const newData = typeof cb === "function" ? cb(currentData) : cb;

      if (prev.routeType === "area") {
        let finalVertices = newData;

        if (Array.isArray(newData) && newData.length >= 3) {
          const firstPoint = newData[0];
          const lastPoint = newData[newData.length - 1];

          // Auto‑close if clicking near first point and we have enough points
          if (isNearFirstPoint(lastPoint, firstPoint) && newData.length > 2) {
            // Remove the last point (the click near first point) and mark as closed
            finalVertices = newData.slice(0, -1);

            // Schedule path generation after a short delay (to allow state update)
            setTimeout(() => {
              setPlannerState(current => ({
                ...current,
                polygonVertices: finalVertices
              }));
              generatePath();
            }, 100);
          }
        }

        return {
          ...prev,
          polygonVertices: finalVertices,
          path: [],
          photoPoints: [],
          flightLines: [],
          missionAnalytics: null,
          warnings: [],
        };
      } else {
        return {
          ...prev,
          waypoints: newData,
          path: [],
          photoPoints: [],
          flightLines: [],
          missionAnalytics: null,
          warnings: [],
        };
      }
    });
  }, []);

  /**
   * Validates the current mission based on route type.
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
   */
  const validateCurrentMission = useCallback(() => {
    const params = getCurrentParams();
    const routeType = plannerState.routeType;

    if (routeType === "area") {
      const vertices = plannerState.polygonVertices;
      if (vertices.length < 3) {
        return {
          isValid: false,
          errors: ["Need at least 3 vertices to define an area"],
          warnings: [],
        };
      }
      return { isValid: true, errors: [], warnings: [] };
    }

    if (routeType === "linear" && plannerState.waypoints.length < 2) {
      return {
        isValid: false,
        errors: ["Need at least 2 waypoints for linear survey"],
        warnings: [],
      };
    }

    if (routeType === "waypoint" && plannerState.waypoints.length < 1) {
      return {
        isValid: false,
        errors: ["Need at least 1 waypoint for waypoint route"],
        warnings: [],
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }, [plannerState.polygonVertices, plannerState.waypoints, plannerState.routeType]);

  /**
   * Estimates battery usage for linear missions.
   * @param {number} totalDistance - Total flight distance (m).
   * @param {number} speed - Flight speed (m/s).
   * @param {string} aircraftModel - Model identifier.
   * @returns {Object} Battery usage estimate.
   */
  const estimateBatteryUsageLinear = (totalDistance, speed, aircraftModel) => {
    const flightTime = totalDistance / speed / 60;
    const maxBatteryTime = AIRCRAFT_BATTERY_CAPACITY[aircraftModel] || AIRCRAFT_BATTERY_CAPACITY["default"];
    const batteryPercentage = (flightTime / maxBatteryTime) * 100;

    return {
      estimatedUsage: Math.ceil(flightTime),
      batteryPercentage: Math.min(100, Math.round(batteryPercentage)),
      maxBatteryTime,
      canComplete: flightTime <= maxBatteryTime * 0.8,
      safetyMargin: Math.round(maxBatteryTime * 0.8 - flightTime),
    };
  };

  /**
   * Generates the flight path based on the current route type and parameters.
   * For waypoint routes, it simply copies the waypoints.
   * For area routes, it calls generateSimpleAreaPath.
   * For linear routes, it creates a path with altitude/speed and estimates battery.
   */
  const generatePath = useCallback(() => {
    const validation = validateCurrentMission();
    if (!validation.isValid) {
      alert(`Mission validation failed:\n${validation.errors.join("\n")}`);
      setPlannerState((prev) => ({
        ...prev,
        warnings: validation.warnings || [],
      }));
      return;
    }

    const params = getCurrentParams();
    const routeType = plannerState.routeType;

    if (routeType === "waypoint") {
      const waypoints = plannerState.waypoints;
      setPlannerState((prev) => ({
        ...prev,
        path: [...waypoints],
        photoPoints: [],
        flightLines: [],
        metrics: `Generated waypoint route with ${waypoints.length} points.`,
        missionAnalytics: null,
        warnings: validation.warnings || [],
      }));
      return;
    }

    if (routeType === "area") {
      const vertices = plannerState.polygonVertices;
      const result = generateSimpleAreaPath(vertices, plannerState.areaParams || {});

      setPlannerState((prev) => ({
        ...prev,
        path: result.path || [],
        photoPoints: result.photoPoints || [],
        flightLines: result.flightLines || [],
        metrics: result.metrics || "",
        missionAnalytics: result.missionAnalytics || null,
        warnings: [...(validation.warnings || []), ...(result.warnings || [])],
        dualCameraResults: null,
      }));
      return;
    }

    if (routeType === "linear") {
      const waypoints = plannerState.waypoints;
      const updated = waypoints.map((wp) => ({
        ...wp,
        alt: params.altitude || wp.alt,
        speed: params.speed || wp.speed,
        corridorWidth: params.corridorWidth,
      }));

      const totalDistance = waypoints.reduce((sum, wp, index) => {
        if (index === 0) return sum;
        const prevWp = waypoints[index - 1];
        return sum + haversineDistance(prevWp.lat, prevWp.lng, wp.lat, wp.lng);
      }, 0);

      const flightTime = Math.ceil(totalDistance / (params.speed || 1) / 60);
      const batteryUsage = estimateBatteryUsageLinear(totalDistance, params.speed || 1, params.aircraftModel);

      setPlannerState((prev) => ({
        ...prev,
        path: updated,
        photoPoints: [],
        flightLines: [],
        metrics: `Linear route: ${waypoints.length} points, ${Math.round(totalDistance)}m total`,
        missionAnalytics: {
          totalDistance: Math.round(totalDistance),
          estimatedFlightTime: flightTime,
          batteryUsage,
          photoCount: 0,
          coverageArea: 0,
          dataVolume: 0,
          averageSpeed: params.speed,
        },
        warnings: validation.warnings || [],
      }));
      return;
    }

    alert("Unknown route type selected.");
  }, [plannerState.polygonVertices, plannerState.waypoints, plannerState.routeType, plannerState.areaParams, validateCurrentMission]);

  /**
   * Clears all mission data (waypoints, path, etc.) after user confirmation.
   */
  const clearAll = useCallback(() => {
    if (window.confirm("Are you sure you want to clear all data?")) {
      setPlannerState((prev) => ({
        ...prev,
        waypoints: [],
        polygonVertices: [],
        path: [],
        photoPoints: [],
        flightLines: [],
        metrics: "",
        selectedMarker: null,
        missionAnalytics: null,
        warnings: [],
        dualCameraResults: null,
      }));
    }
  }, []);

  /**
   * Updates a single waypoint/vertex with new parameters (used by Sidebar for inline edits).
   * @param {number} index - Index of the element.
   * @param {Object} newParams - Parameters to update.
   */
  const updateWaypoint = useCallback(
    (index, newParams) => {
      if (plannerState.routeType === "area") {
        setPlannerState((prev) => ({
          ...prev,
          polygonVertices: prev.polygonVertices.map((v, i) => (i === index ? { ...v, ...newParams } : v)),
        }));
      } else {
        setPlannerState((prev) => ({
          ...prev,
          waypoints: prev.waypoints.map((wp, i) => (i === index ? { ...wp, ...newParams } : wp)),
        }));
      }
    },
    [plannerState.routeType]
  );

  // ========== EXPORT HELPERS ==========
  /**
   * Builds a KML string from a path.
   * @param {Array} path - Array of points {lat, lng, alt}.
   * @returns {string} KML document.
   */
  const buildKMLFromPath = (path) => {
    const coords = (path || [])
      .map((p) => `${p.lng},${p.lat},${p.alt ?? 0}`)
      .join(" ");
    return `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <LineString>
            <coordinates>${coords}</coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>`;
  };

  /**
   * Builds a CSV string from a path.
   * @param {Array} path - Array of points {lat, lng, alt}.
   * @returns {string} CSV content.
   */
  const buildCSVFromPath = (path) => {
    const rows = ["lat,lng,alt"];
    (path || []).forEach((p) => {
      rows.push(`${p.lat},${p.lng},${p.alt ?? ""}`);
    });
    return rows.join("\n");
  };

  /**
   * Downloads a blob as a file.
   * @param {Blob} blob - The data blob.
   * @param {string} filename - Desired filename.
   */
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Exports the current mission data in the selected format.
   * @param {string} [format=selectedExportFormat] - Export format.
   */
  const handleExport = useCallback(
    (format = selectedExportFormat) => {
      if (!plannerState.path.length && !plannerState.photoPoints.length) {
        alert("No mission data to export");
        return;
      }

      const exportData = {
        path: plannerState.path,
        photoPoints: plannerState.photoPoints,
        flightLines: plannerState.flightLines,
        metrics: plannerState.metrics,
        missionAnalytics: plannerState.missionAnalytics,
        parameters: getCurrentParams(),
        routeType: plannerState.routeType,
        polygonVertices: plannerState.routeType === "area" ? plannerState.polygonVertices : undefined,
        waypoints: plannerState.routeType !== "area" ? plannerState.waypoints : undefined,
        generatedAt: new Date().toISOString(),
      };

      try {
        if (format === "JSON") {
          const dataStr = JSON.stringify(exportData, null, 2);
          const dataBlob = new Blob([dataStr], { type: "application/json" });
          downloadBlob(dataBlob, `mission-plan-${new Date().getTime()}.json`);
        } else if (format === "KML") {
          const kml = buildKMLFromPath(plannerState.path);
          const dataBlob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
          downloadBlob(dataBlob, `mission-route-${new Date().getTime()}.kml`);
        } else if (format === "CSV") {
          const csv = buildCSVFromPath(plannerState.path);
          const dataBlob = new Blob([csv], { type: "text/csv" });
          downloadBlob(dataBlob, `mission-data-${new Date().getTime()}.csv`);
        } else {
          alert("Unsupported export format");
        }

        setExportModalOpen(false);
        alert(`Mission exported successfully as ${format}`);
      } catch (error) {
        console.error("Export failed:", error);
        alert("Export failed: " + error.message);
      }
    },
    [plannerState, selectedExportFormat, getCurrentParams]
  );

  /**
   * Simple placeholder for GSD calculation based on altitude.
   * In a real implementation, we would use the imported calculateGSDForDJI.
   * @returns {number} Approximate GSD in cm/px.
   */
  const calculateCurrentGSD = useCallback(() => {
    const params = getCurrentParams();
    if (params.routeAltitude) {
      // naive estimate: GSD (cm/px) proportional to altitude.
      const gsd = Math.max(0.5, Math.round((params.routeAltitude / 10) * 10) / 10);
      return gsd;
    }
    return 0;
  }, [getCurrentParams]);

  /**
   * Updates area parameters (called by AreaRouteParamsPanel).
   * @param {Object} newParams - Partial updates.
   */
  const handleAreaParamsChange = useCallback((newParams) => {
    setPlannerState((prev) => ({
      ...prev,
      areaParams: { ...prev.areaParams, ...newParams },
      path: [],
      photoPoints: [],
      flightLines: [],
      missionAnalytics: null,
      warnings: [],
    }));
  }, []);

  /**
   * Manually closes the polygon by adding a duplicate of the first vertex.
   * Only applicable in area mode with at least 3 vertices.
   */
  const closePolygon = useCallback(() => {
    if (plannerState.routeType === "area" && plannerState.polygonVertices.length >= 3) {
      setPlannerState((prev) => {
        const vertices = prev.polygonVertices;
        const firstPoint = vertices[0];
        const lastPoint = vertices[vertices.length - 1];

        // If not already closed, add the first point at the end
        let finalVertices = vertices;
        if (vertices.length > 0 &&
            (firstPoint.lat !== lastPoint.lat || firstPoint.lng !== lastPoint.lng)) {
          finalVertices = [...vertices, { ...firstPoint }];
        }

        return {
          ...prev,
          polygonVertices: finalVertices,
          path: [],
          photoPoints: [],
          flightLines: [],
          missionAnalytics: null,
          warnings: [],
        };
      });

      // Trigger path generation after a short delay
      setTimeout(() => {
        generatePath();
      }, 100);
    }
  }, [plannerState.routeType, plannerState.polygonVertices.length, generatePath]);

  const currentParams = getCurrentParams();
  const currentGSD = calculateCurrentGSD();
  const warnings = Array.isArray(plannerState.warnings) ? plannerState.warnings : [];

  const displayVertices = plannerState.routeType === "area" ? plannerState.polygonVertices : plannerState.waypoints;

  // ========== RENDER ==========
  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden">
      {/* Map container */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <MapView
            waypoints={displayVertices}
            setWaypoints={handleWaypointsUpdate}
            path={plannerState.path}
            setPath={(cb) =>
              setPlannerState((prev) => ({
                ...prev,
                path: typeof cb === "function" ? cb(prev.path) : cb,
              }))
            }
            photoPoints={plannerState.photoPoints}
            flightLines={plannerState.flightLines}
            selectedMarker={plannerState.selectedMarker}
            setSelectedMarker={(cb) =>
              setPlannerState((prev) => ({
                ...prev,
                selectedMarker: typeof cb === "function" ? cb(prev.selectedMarker) : cb,
              }))
            }
            altitude={currentParams.relativeAltitude || currentParams.altitude}
            speed={currentParams.speed}
            mapCenter={plannerState.mapCenter}
            setMapCenter={(center) => setPlannerState((prev) => ({ ...prev, mapCenter: center }))}
            mapZoom={plannerState.mapZoom}
            setMapZoom={(zoom) => setPlannerState((prev) => ({ ...prev, mapZoom: zoom }))}
            routeParams={currentParams}
            routeType={plannerState.routeType}
            onEditWaypoint={handleEditWaypoint}
            missionAnalytics={plannerState.missionAnalytics}
            currentGSD={currentGSD}
            onOpenAreaParams={() => setShowAreaParamsPanel(true)}
            onClosePolygon={closePolygon}
          />
        </div>

        {/* Bottom status bar */}
        <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 text-xs text-gray-300 flex justify-between items-center">
          <div>
            {plannerState.routeType === "area"
              ? `${plannerState.polygonVertices.length} polygon vertices`
              : `${plannerState.waypoints.length} waypoints`}
            {plannerState.routeType === "area" && plannerState.polygonVertices.length >= 3 && (
              <span className="text-green-400 ml-2">• Ready to close polygon</span>
            )}
            {plannerState.routeType === "area" && ` • GSD: ${currentGSD} cm/px`}
            {plannerState.missionAnalytics && ` • Est. time: ${plannerState.missionAnalytics.estimatedFlightTime}min`}
          </div>
          <div className="flex gap-2">
            {plannerState.missionAnalytics?.batteryUsage && (
              <div
                className={`px-2 py-1 rounded ${
                  plannerState.missionAnalytics.batteryUsage.canComplete
                    ? "bg-green-900 text-green-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                Battery: {plannerState.missionAnalytics.batteryUsage.batteryPercentage}%
              </div>
            )}
            {warnings.length > 0 && (
              <div className="bg-yellow-900 text-yellow-300 px-2 py-1 rounded">
                {warnings.length} warning(s)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resizable Sidebar */}
      <div
        className="relative h-full overflow-y-auto bg-gradient-to-b from-neutral-900 via-neutral-950 to-blue-950 shadow-xl border-l border-blue-200"
        style={{
          width: plannerState.sidebarWidth,
          minWidth: 300,
          maxWidth: 600,
        }}
      >
        {/* Draggable resize handle */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 8,
            height: "100%",
            cursor: "ew-resize",
            zIndex: 10,
            background: "rgba(255,255,255,0.03)",
          }}
          title="Drag to resize"
          onMouseDown={(e) => {
            const resizing = { active: true };
            const startX = e.clientX;
            const startWidth = plannerState.sidebarWidth;

            const onMouseMove = (moveEvent) => {
              if (!resizing.active) return;
              let newWidth = startWidth + (moveEvent.clientX - startX);
              newWidth = Math.max(300, Math.min(600, newWidth));
              setPlannerState((prev) => ({ ...prev, sidebarWidth: newWidth }));
            };

            const onMouseUp = () => {
              resizing.active = false;
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          }}
        />
        <Sidebar
          waypoints={displayVertices}
          path={plannerState.path}
          photoPoints={plannerState.photoPoints}
          flightLines={plannerState.flightLines}
          metrics={plannerState.metrics}
          routeType={plannerState.routeType}
          setRouteType={handleRouteTypeChange}
          generatePath={generatePath}
          clearAll={clearAll}
          updateWaypoint={updateWaypoint}
          routeParams={currentParams}
          setRouteParams={setRouteParams}
          areaParams={plannerState.areaParams}
          setAreaParams={setAreaParams}
          onEditWaypoint={handleEditWaypoint}
          missionAnalytics={plannerState.missionAnalytics}
          warnings={warnings}
          currentGSD={currentGSD}
          onExport={() => setExportModalOpen(true)}
          dualCameraResults={plannerState.dualCameraResults}
          onOpenAreaParams={() => setShowAreaParamsPanel(true)}
          polygonVertices={plannerState.polygonVertices}
          onClosePolygon={closePolygon}
        />
      </div>

      {/* Modals (currently only a placeholder for export – you may want to implement them) */}
      {editingWaypointIndex !== null && (
        <WaypointParamsModal
          waypoint={displayVertices[editingWaypointIndex]}
          routeParams={currentParams}
          onSave={handleWaypointModalConfirm}
          onCancel={handleWaypointModalCancel}
        />
      )}

      {exportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          {/* Export modal content */}
        </div>
      )}

      {showAreaParamsPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          {/* Area params panel content */}
        </div>
      )}
    </div>
  );
}
