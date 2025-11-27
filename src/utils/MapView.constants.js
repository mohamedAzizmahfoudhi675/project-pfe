// MapView.constants.js
export const MAP_CONFIG = {
  containerStyle: { width: "100%", height: "100%" },
  libraries: ["places", "geometry", "drawing"],
};

export const DRAWING_MODES = {
  NONE: null,
  MARKER: "marker",
  POLYGON: "polygon", 
  POLYLINE: "polyline",
  CIRCLE: "circle",
  RECTANGLE: "rectangle"
};

export const SHAPE_COLORS = {
  POLYGON: '#4285F4',
  POLYLINE: '#34A853', 
  CIRCLE: '#FBBC05',
  RECTANGLE: '#EA4335',
  HIGHLIGHT: '#FF0000',
  PATH: '#ff0000',
  FLIGHT_LINE: '#06b6d4'
};