// src/utils/parameters.js

export const defaultWaypointParams = {
  waypointName: "",
  aircraft: "Matrice 30 T",
  altitudeMode: "relative",
  showWaypointNumber: true,
  showWaypointAltitude: true,
  showWaypointDistance: false,
  safeTakeoffAltitude: 20,
  climbToStartPoint: false,
  speed: 5,
  followRouteSpeed: false,
  relativeAltitude: 100,
  followRouteRelativeAltitude: false,
  aircraftYaw: "route",
  followRouteAircraftYaw: false,
  aircraftRotation: "auto",
  waypointType: "straight_stop",
  followRouteWaypointType: false,
  uponCompletion: "Return To Home",
  takeoffSpeed: 2.7,
  gimbalPitch: 0,
  gimbalControl: "Manual",
};

export const defaultAreaParams = {
  areaRouteName: "Create-Area-Route2",
  aircraft: "M30 Series",
  cameraModel: "M30T",
  lens: "WIDE",
  collectionMode: "Ortho",
  orthoGSD: 5,
  altitudeMode: "relative",
  routeAltitude: 400,
  elevationOptimization: false,
  safeTakeoffAltitude: 20,
  speed: 5.7,
  courseAngle: 46,
  uponCompletion: "Return To Home",
  gimbalPitchOblique: -45,
  obliqueGSD: 7,
  sideOverlap: 70,
  frontOverlap: 80,
  margin: 0,
  photoMode: "Timed Interval Shot",
  takeoffSpeed: 6.4
};

export const defaultLinearParams = {
  altitude: 20,
  speed: 5,
  corridorWidth: 40,
};