// area-route-kmz.js
// npm: install jszip
import JSZip from "jszip";

/* ---------- geo helpers ---------- */
const R_EARTH = 6378137;
const deg2rad = d => d * Math.PI / 180;
const rad2deg = r => r * 180 / Math.PI;

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = deg2rad(lat1), φ2 = deg2rad(lat2);
  const Δφ = deg2rad(lat2 - lat1), Δλ = deg2rad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function latLonToXY(lat, lon, originLat) {
  const lat0 = deg2rad(originLat);
  const x = deg2rad(lon) * R_EARTH * Math.cos(lat0);
  const y = deg2rad(lat) * R_EARTH;
  return { x, y };
}

function xyToLatLon(x, y, originLat) {
  const lat = rad2deg(y / R_EARTH);
  const lon = rad2deg(x / (R_EARTH * Math.cos(deg2rad(originLat))));
  return { lat, lng: lon };
}

function rotatePoint(p, angleRad) {
  const cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);
  return { x: p.x * cosA - p.y * sinA, y: p.x * sinA + p.y * cosA };
}

function rotatePoints(points, angleRad) {
  return points.map(pt => rotatePoint(pt, angleRad));
}

function intersectHorizontal(a, b, Y) {
  if ((Y < Math.min(a.y, b.y)) || (Y > Math.max(a.y, b.y))) return null;
  if (a.y === b.y) return null;
  const t = (Y - a.y) / (b.y - a.y);
  return { x: a.x + t * (b.x - a.x), y: Y };
}

function segmentsFromIntersections(intersections) {
  if (intersections.length < 2) return [];
  const xs = intersections.map(p => p.x).sort((a,b)=>a-b);
  const out = [];
  for (let i=0;i+1<xs.length;i+=2) out.push([xs[i], xs[i+1]]);
  return out;
}

function pointsAlongSegment(x0,x1,y,spacing) {
  const len = Math.abs(x1-x0);
  if (len < 1e-9) return [{x:x0,y}];
  const steps = Math.max(1, Math.ceil(len/spacing));
  const pts = [];
  for (let s=0;s<=steps;s++){
    const t = s/steps;
    pts.push({ x: x0 + (x1-x0)*t, y });
  }
  return pts;
}

function ensureClosed(path) {
  if (!path || !path.length) return path || [];
  const first = path[0], last = path[path.length-1];
  if (first.lat === last.lat && first.lng === last.lng) return path.slice();
  return [...path, { lat: first.lat, lng: first.lng }];
}

/* ---------- CAMERA SPECS (used to derive cameraSpec from panel values) ---------- */
export const CAMERA_SPECS = {
  M30T: {
    sensorWidth: 6.4,
    focalLength: 4.5,
    imageWidth: 4000,
    imageHeight: 3000,
  },
  M30T_Thermal: {
    sensorWidth: 12.288,
    focalLength: 9.1,
    imageWidth: 1280,
    imageHeight: 1024,
    pixelPitch: 0.012,
  },
  "M30T Wide+IR": {
    wide: {
      sensorWidth: 6.4,
      focalLength: 4.5,
      imageWidth: 4000,
      imageHeight: 3000,
    },
    ir: {
      sensorWidth: 12.288,
      focalLength: 9.1,
      imageWidth: 1280,
      imageHeight: 1024,
      pixelPitch: 0.012,
    },
  },
  H20T: { 
    sensorWidth: 8.8, 
    focalLength: 6.8, 
    imageWidth: 3840, 
    imageHeight: 2160 
  },
  "P4RTK Camera": { 
    sensorWidth: 13.2, 
    focalLength: 8.8, 
    imageWidth: 5472, 
    imageHeight: 3648 
  },
  "Mavic 3E Camera": { 
    sensorWidth: 17.3, 
    focalLength: 24, 
    imageWidth: 5280, 
    imageHeight: 3956 
  },
};

/* ---------- UTIL: extract only the editable params (useful for params.json) ---------- */
export function extractEditablePanelFields(panel = {}) {
  if (!panel || typeof panel !== "object") return {};
  const keys = [
    "areaRouteName","aircraftModel","cameraModel","lens","collectionMode","altitudeMode",
    "routeAltitude","elevationOptimization","safeTakeoffAltitude","speed","courseAngle",
    "uponCompletion","gimbalPitchOblique","sideOverlap","frontOverlap","margin","photoMode",
    "takeoffSpeed","targetSurfaceToTakeoff","calculatedGSD","footprint","actionIntervalSeconds",
    "autoSave"
  ];
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(panel, k)) out[k] = panel[k];
  }
  return out;
}

/* ---------- UTIL: derive cameraSpec from panel values ---------- */
export function pickCameraSpecFromPanel(panel = {}) {
  const model = panel.cameraModel || "M30T";
  const lens = (panel.lens || "WIDE").toUpperCase();

  if (model === "M30T Wide+IR") {
    if (lens.includes("IR")) {
      return CAMERA_SPECS["M30T Wide+IR"].ir;
    }
    return CAMERA_SPECS["M30T Wide+IR"].wide;
  }

  const specs = CAMERA_SPECS[model];
  if (specs) return specs;
  // fallback to a sensible default
  return CAMERA_SPECS.M30T;
}

/* ---------- Sweep computation (camera -> spacing) ---------- */
export function computeSweepFromCamera({
  altitude,
  cameraSpec = { imageWidth: 4000, imageHeight: 3000 },
  gsdCm = null,
  sideOverlapPct = 70,
  frontOverlapPct = 80,
  angleDeg = 0,
  alternate = true,
} = {}) {
  const alt = Number(altitude ?? 40);
  const spec = {
    imageWidth: Number(cameraSpec.imageWidth ?? cameraSpec.width ?? 4000),
    imageHeight: Number(cameraSpec.imageHeight ?? cameraSpec.height ?? 3000)
  };

  let _gsdCm = (gsdCm && Number(gsdCm) > 0) ? Number(gsdCm) : 3.0;
  const gsdM = _gsdCm / 100.0;
  const footprintWidth = spec.imageWidth * gsdM;
  const footprintHeight = spec.imageHeight * gsdM;
  const lineSpacing = Math.max(1, footprintWidth * (1 - sideOverlapPct / 100));
  const pointSpacing = Math.max(1, footprintHeight * (1 - frontOverlapPct / 100));

  return {
    lineSpacing: Math.max(1, Math.round(lineSpacing)),
    pointSpacing: Math.max(1, Math.round(pointSpacing)),
    angleDeg: Number(angleDeg || 0),
    alt,
    alternate: Boolean(alternate),
    _meta: { 
      gsdCm: _gsdCm, 
      gsdM, 
      imageWidthPx: spec.imageWidth, 
      imageHeightPx: spec.imageHeight, 
      footprintWidth, 
      footprintHeight, 
      sideOverlapPct, 
      frontOverlapPct 
    }
  };
}

/* ---------- Lawn mower waypoint generator ---------- */
export function generateSweepWaypoints(opts = {}) {
  const {
    polygon,
    lineSpacing = 20,
    pointSpacing = 10,
    angleDeg = 0,
    alt = 40,
    alternate = true,
  } = opts;
  
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new Error("polygon must contain >=3 points");
  }

  const poly = ensureClosed(polygon);
  const originLat = poly.reduce((s,p)=>s+p.lat,0)/poly.length;

  const polyXY = poly.map(p => latLonToXY(p.lat, p.lng, originLat));
  const angleRad = deg2rad(angleDeg);
  const rotPoly = rotatePoints(polyXY, -angleRad);

  let minY=Infinity, maxY=-Infinity;
  for (const p of rotPoly) { 
    if(p.y<minY) minY=p.y; 
    if(p.y>maxY) maxY=p.y; 
  }

  const lines = [];
  for (let y=minY; y<=maxY+1e-6; y += lineSpacing) lines.push(y);

  const waypoints = [];
  let idx = 0, lineIndex=0;
  
  for (const y of lines) {
    const inters = [];
    for (let i=0;i<rotPoly.length-1;i++){
      const a=rotPoly[i], b=rotPoly[i+1];
      const I = intersectHorizontal(a,b,y);
      if (I) inters.push(I);
    }
    
    const pairs = segmentsFromIntersections(inters);
    if (!pairs.length) { 
      lineIndex++; 
      continue; 
    }
    
    let linePts = [];
    for (const [x0,x1] of pairs) {
      const pts = pointsAlongSegment(x0,x1,y,pointSpacing);
      linePts = linePts.concat(pts);
    }
    
    if (alternate && (lineIndex % 2 === 1)) linePts.reverse();
    
    for (const rp of linePts) {
      const rb = rotatePoint({ x: rp.x, y: rp.y }, angleRad);
      const ll = xyToLatLon(rb.x, rb.y, originLat);
      waypoints.push({ 
        lat: ll.lat, 
        lng: ll.lng, 
        alt, 
        idx: idx++,
        speed: opts.autoFlightSpeed || 3
      });
    }
    lineIndex++;
  }
  
  return waypoints;
}

/* ---------- small helpers to build actions ---------- */
const actionTypeMapping = {
  "Take Photo": { 
    func: "takePhoto", 
    params: { 
      payloadPositionIndex: 0, 
      useGlobalPayloadLensIndex: 1 
    } 
  },
  "Start Recording": { 
    func: "startRecord", 
    params: { 
      payloadPositionIndex: 0, 
      useGlobalPayloadLensIndex: 1 
    } 
  },
  "Stop Recording": { 
    func: "stopRecord", 
    params: { 
      payloadPositionIndex: 0, 
      useGlobalPayloadLensIndex: 1 
    } 
  },
  "Gimbal Pitch": { 
    func: "gimbalRotate", 
    params: { 
      pitch: 0, 
      roll: 0, 
      yaw: 0, 
      time: 1.0, 
      mode: "absolute" 
    } 
  },
  "Camera Zoom": { 
    func: "zoom", 
    params: { 
      factor: 1.0, 
      time: 1.0 
    } 
  }
};

function convertActionsToDJIFormat(actions, waypointParams = {}) {
  if (!actions || !Array.isArray(actions)) return [];
  
  return actions.map(action => {
    const mapping = actionTypeMapping[action.type];
    if (!mapping) return null;
    
    const params = { ...mapping.params };
    switch (action.type) {
      case "Gimbal Pitch": 
        params.pitch = waypointParams.gimbalPitch || 0; 
        break;
      case "Gimbal Yaw": 
        params.yaw = waypointParams.aircraftYaw === "manual" ? 
          (waypointParams.waypointHeadingAngle || 0) : 0; 
        break;
    }
    
    return { 
      func: mapping.func, 
      params 
    };
  }).filter(a => a !== null);
}

function serializeActions(actions) {
  if (!actions || !Array.isArray(actions)) return '';
  
  return actions
    .filter(action => typeof action.func === "string" && action.func.length > 0)
    .map((action, aId) => {
      const paramsXML = Object.entries(action.params || {})
        .map(([key, value]) => `<wpml:${key}>${value}</wpml:${key}>`)
        .join('\n          ');
      
      return `
          <wpml:action>
            <wpml:actionId>${aId}</wpml:actionId>
            <wpml:actionActuatorFunc>${action.func}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              ${paramsXML}
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
    }).join('\n');
}

/* ---------- payload defaults ---------- */
const cameraPayloadMap = {
  67: { 
    payloadEnumValue: 53, 
    payloadSubEnumValue: 0, 
    payloadPositionIndex: 0, 
    meteringMode: 'average', 
    dewarpingEnable: 0, 
    returnMode: 'singleReturnStrongest', 
    samplingRate: 240000, 
    scanningMode: 'nonRepetitive', 
    modelColoringEnable: 0, 
    imageFormat: 'wide,ir,zoom' 
  },
  68: { 
    payloadEnumValue: 53, 
    payloadSubEnumValue: 0, 
    payloadPositionIndex: 0, 
    meteringMode: 'average', 
    dewarpingEnable: 0, 
    returnMode: 'singleReturnStrongest', 
    samplingRate: 240000, 
    scanningMode: 'nonRepetitive', 
    modelColoringEnable: 0, 
    imageFormat: 'wide,ir,zoom' 
  },
  60: { 
    payloadEnumValue: 50, 
    payloadSubEnumValue: 0, 
    payloadPositionIndex: 0, 
    meteringMode: 'average', 
    dewarpingEnable: 0, 
    returnMode: 'singleReturnStrongest', 
    samplingRate: 120000, 
    scanningMode: 'nonRepetitive', 
    modelColoringEnable: 0, 
    imageFormat: 'wide' 
  }
};

function getDefaultPayload(droneEnumValue) {
  return cameraPayloadMap[droneEnumValue] || { 
    payloadEnumValue: 0, 
    payloadSubEnumValue: 0, 
    payloadPositionIndex: 0, 
    meteringMode: 'average', 
    dewarpingEnable: 0, 
    returnMode: 'singleReturnStrongest', 
    samplingRate: 120000, 
    scanningMode: 'nonRepetitive', 
    modelColoringEnable: 0, 
    imageFormat: 'wide' 
  };
}

/* ---------- build template KML (area) ---------- */
export function buildTemplateKMLArea({
  name = "area_route",
  polygon = [],
  templatePoints = undefined,
  globalHeight = 40,
  autoFlightSpeed = 3,
  takeOffSecurityHeight = 20,
  droneEnumValue = 67,
  payloadParam = null,
  sideOverlap = 80,
  frontOverlap = 70,
  margin = 0,
  finishAction = "goHome",
} = {}) {
  const now = Date.now();
  const usePts = (Array.isArray(templatePoints) && templatePoints.length >= 3) ? 
    ensureClosed(templatePoints) : ensureClosed(polygon);
  // Remove consecutive duplicates and redundant closing point
  const dedupedPts = [];
  for (let i = 0; i < usePts.length; i++) {
    const prev = dedupedPts[dedupedPts.length - 1];
    const curr = usePts[i];
    if (!prev || prev.lat !== curr.lat || prev.lng !== curr.lng) {
      dedupedPts.push(curr);
    }
  }
  // Also remove last point if identical to first (common in closed polygons)
  if (
    dedupedPts.length > 1 &&
    dedupedPts[0].lat === dedupedPts[dedupedPts.length - 1].lat &&
    dedupedPts[0].lng === dedupedPts[dedupedPts.length - 1].lng
  ) {
    dedupedPts.pop();
  }

  const coordsText = dedupedPts
    .map(p => `                ${p.lng},${p.lat},0`)
    .join("\n");
    
  const defaultPayload = getDefaultPayload(droneEnumValue);
  const payloadParamFinal = payloadParam || {
    payloadPositionIndex: defaultPayload.payloadPositionIndex,
    meteringMode: defaultPayload.meteringMode,
    dewarpingEnable: defaultPayload.dewarpingEnable,
    returnMode: defaultPayload.returnMode,
    samplingRate: defaultPayload.samplingRate,
    scanningMode: defaultPayload.scanningMode,
    modelColoringEnable: defaultPayload.modelColoringEnable,
    imageFormat: defaultPayload.imageFormat
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:createTime>${now}</wpml:createTime>
    <wpml:updateTime>${now}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>10</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>${defaultPayload.payloadEnumValue}</wpml:payloadEnumValue>
        <wpml:payloadSubEnumValue>${defaultPayload.payloadSubEnumValue}</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>${defaultPayload.payloadPositionIndex}</wpml:payloadPositionIndex>
      </wpml:payloadInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateType>mapping2d</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
        <wpml:globalShootHeight>${globalHeight}</wpml:globalShootHeight>
      </wpml:waylineCoordinateSysParam>
      <wpml:autoFlightSpeed>${autoFlightSpeed}</wpml:autoFlightSpeed>
      <Placemark>
        <wpml:caliFlightEnable>0</wpml:caliFlightEnable>
        <wpml:elevationOptimizeEnable>1</wpml:elevationOptimizeEnable>
        <wpml:smartObliqueEnable>0</wpml:smartObliqueEnable>
        <wpml:shootType>time</wpml:shootType>
        <wpml:direction>0</wpml:direction>
        <wpml:margin>${Number(margin)}</wpml:margin>
        <wpml:overlap>
          <wpml:orthoCameraOverlapH>${Number(frontOverlap)}</wpml:orthoCameraOverlapH>
          <wpml:orthoCameraOverlapW>${Number(sideOverlap)}</wpml:orthoCameraOverlapW>
        </wpml:overlap>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
${coordsText}
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
        <wpml:ellipsoidHeight>${globalHeight}</wpml:ellipsoidHeight>
        <wpml:height>${globalHeight}</wpml:height>
      </Placemark>
      <wpml:payloadParam>
        <wpml:payloadPositionIndex>${payloadParamFinal.payloadPositionIndex}</wpml:payloadPositionIndex>
        <wpml:meteringMode>${payloadParamFinal.meteringMode}</wpml:meteringMode>
        <wpml:dewarpingEnable>${payloadParamFinal.dewarpingEnable}</wpml:dewarpingEnable>
        <wpml:returnMode>${payloadParamFinal.returnMode}</wpml:returnMode>
        <wpml:samplingRate>${payloadParamFinal.samplingRate}</wpml:samplingRate>
        <wpml:scanningMode>${payloadParamFinal.scanningMode}</wpml:scanningMode>
        <wpml:modelColoringEnable>${payloadParamFinal.modelColoringEnable}</wpml:modelColoringEnable>
        <wpml:imageFormat>${payloadParamFinal.imageFormat}</wpml:imageFormat>
      </wpml:payloadParam>
    </Folder>
  </Document>
</kml>`;
}

/* ---------- build waylines.wpml for area sweep ---------- */
export function buildWaylinesWPMLArea({
  waypoints = [],
  droneEnumValue = 67,
  droneSubEnumValue = 0,
  payloadParam = null,
  takeOffSecurityHeight = 20,
  autoFlightSpeed = 3,
  globalHeight = 40,
  actionIntervalSeconds = 2.0,
  finishAction = "goHome",
} = {}) {
  const defaultPayload = getDefaultPayload(droneEnumValue);
  const payloadParamFinal = payloadParam || {
    payloadPositionIndex: defaultPayload.payloadPositionIndex,
    meteringMode: defaultPayload.meteringMode,
    dewarpingEnable: defaultPayload.dewarpingEnable,
    returnMode: defaultPayload.returnMode,
    samplingRate: defaultPayload.samplingRate,
    scanningMode: defaultPayload.scanningMode,
    modelColoringEnable: defaultPayload.modelColoringEnable,
    imageFormat: defaultPayload.imageFormat
  };

  let totalDistance = 0;
  for (let i=0;i<waypoints.length-1;i++) {
    totalDistance += haversine(
      waypoints[i].lat, 
      waypoints[i].lng, 
      waypoints[i+1].lat, 
      waypoints[i+1].lng
    );
  }
  
  const duration = autoFlightSpeed > 0 ? totalDistance / autoFlightSpeed : 0;

  const placemarks = waypoints.map((p,i) => {
    const djiActions = convertActionsToDJIFormat(p.actions, p);
    const actionGroupXML = (djiActions && djiActions.length>0) ? `
        <wpml:actionGroup>
          <wpml:actionGroupId>${i}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${i}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${i}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
${serializeActions(djiActions)}
        </wpml:actionGroup>` : '';

    return `
      <Placemark>
        <Point><coordinates>${p.lng},${p.lat}</coordinates></Point>
        <wpml:index>${i}</wpml:index>
        <wpml:executeHeight>${p.alt ?? globalHeight}</wpml:executeHeight>
        <wpml:waypointSpeed>${p.speed ?? autoFlightSpeed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>coordinateTurn</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>1</wpml:useStraightLine>
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
        <wpml:isRisky>0</wpml:isRisky>
        <wpml:waypointWorkType>0</wpml:waypointWorkType>
        ${actionGroupXML}
      </Placemark>`;
  }).join("\n");

  const payloadInfoStr = `
    <wpml:payloadInfo>
      <wpml:payloadEnumValue>${defaultPayload.payloadEnumValue}</wpml:payloadEnumValue>
      <wpml:payloadSubEnumValue>${defaultPayload.payloadSubEnumValue}</wpml:payloadSubEnumValue>
      <wpml:payloadPositionIndex>${defaultPayload.payloadPositionIndex}</wpml:payloadPositionIndex>
    </wpml:payloadInfo>`;

  const payloadParamStr = `
    <wpml:payloadParam>
      <wpml:payloadPositionIndex>${payloadParamFinal.payloadPositionIndex}</wpml:payloadPositionIndex>
      <wpml:meteringMode>${payloadParamFinal.meteringMode}</wpml:meteringMode>
      <wpml:dewarpingEnable>${payloadParamFinal.dewarpingEnable}</wpml:dewarpingEnable>
      <wpml:returnMode>${payloadParamFinal.returnMode}</wpml:returnMode>
      <wpml:samplingRate>${payloadParamFinal.samplingRate}</wpml:samplingRate>
      <wpml:scanningMode>${payloadParamFinal.scanningMode}</wpml:scanningMode>
      <wpml:modelColoringEnable>${payloadParamFinal.modelColoringEnable}</wpml:modelColoringEnable>
      <wpml:imageFormat>${payloadParamFinal.imageFormat}</wpml:imageFormat>
    </wpml:payloadParam>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>10</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>${payloadInfoStr}
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>${totalDistance.toFixed(6)}</wpml:distance>
      <wpml:duration>${duration.toFixed(6)}</wpml:duration>
      <wpml:autoFlightSpeed>${autoFlightSpeed}</wpml:autoFlightSpeed>
      ${placemarks}${payloadParamStr}
    </Folder>
  </Document>
</kml>`;
}

/* ---------- Map panel snapshot -> generateAreaKMZ options ---------- */
export function mapPanelToKMZOptions(panel = {}, polygon = []) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new Error("polygon (>=3 points) required");
  }

  const merged = { ...(panel || {}) };

  const routeAltitude = Number(merged.routeAltitude ?? merged.altitude ?? 40);
  const sideOverlapPct = Number(merged.sideOverlap ?? 70);
  const frontOverlapPct = Number(merged.frontOverlap ?? 80);
  const autoFlightSpeed = Number(merged.speed ?? 3);
  const globalHeight = routeAltitude;
  const takeOffSecurityHeight = Number(merged.safeTakeoffAltitude ?? 20);

  const cameraSpec = pickCameraSpecFromPanel(merged);

  // prefer panel.calculatedGSD if present
  let gsdCm = (merged.calculatedGSD != null && Number(merged.calculatedGSD) > 0)
    ? Number(merged.calculatedGSD)
    : null;

  // drone enum mapping (tweak to your app's enum)
  const DRONE_ENUM_MAP = {
    "M30 Series": 67,
    "Matrice 300 RTK": 68,
    "Phantom 4 RTK": 60,
    "Mavic 3 Enterprise": 60,
  };
  const droneEnumValue = DRONE_ENUM_MAP[merged.aircraftModel] ?? 67;

  return {
    name: merged.areaRouteName || "area_route",
    polygon: polygon.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })),
    templatePoints: undefined,
    sweep: undefined,
    cameraSpec,
    gsdCm,
    sideOverlapPct,
    frontOverlapPct,
    droneEnumValue,
    droneSubEnumValue: merged.droneSubEnumValue ?? 0,
    payloadParam: null,
    autoFlightSpeed,
    globalHeight,
    takeOffSecurityHeight,
    actionIntervalSeconds: Number(merged.actionIntervalSeconds ?? 2.0),
    autoSave: (merged.autoSave != null) ? Boolean(merged.autoSave) : true,
    panelParams: merged
  };
}

/* ---------- high-level KMZ exporter (enhanced: honors panelParams & writes params.json & sweep-meta.json) ---------- */
export async function generateAreaKMZ({
  name = "area_route",
  polygon = [],
  templatePoints = undefined,
  sweep = undefined,
  cameraSpec = { imageWidth: 4000, imageHeight: 3000 },
  gsdCm = null,
  sideOverlapPct = 70,
  frontOverlapPct = 80,
  droneEnumValue = 67,
  droneSubEnumValue = 0,
  payloadParam = null,
  autoFlightSpeed = 3,
  globalHeight = 40,
  takeOffSecurityHeight = 20,
  actionIntervalSeconds = 2.0,
  autoSave = true,
  panelParams = {}, // <-- new: pass the panel snapshot here
} = {}) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new Error("polygon required (>=3 points)");
  }

  // If caller passed panelParams but didn't pass cameraSpec/gsd/etc, prefer panel
  const panel = panelParams || {};
  const finalName = panel.areaRouteName || name;
  const finalGlobalHeight = Number(panel.routeAltitude ?? globalHeight);
  const finalAutoFlightSpeed = Number(panel.speed ?? autoFlightSpeed);
  const finalTakeOffSecurityHeight = Number(panel.safeTakeoffAltitude ?? takeOffSecurityHeight);
  const finalSideOverlap = Number(panel.sideOverlap ?? sideOverlapPct);
  const finalFrontOverlap = Number(panel.frontOverlap ?? frontOverlapPct);
  const finalGsdCm = (panel.calculatedGSD != null && !Number.isNaN(Number(panel.calculatedGSD)))
    ? Number(panel.calculatedGSD) : gsdCm;
  const finalDroneEnumValue = (panel.droneEnumValue != null) ? panel.droneEnumValue : droneEnumValue;
  const finalActionIntervalSeconds = Number(panel.actionIntervalSeconds ?? actionIntervalSeconds);
  const finalAutoSave = (panel.autoSave != null) ? Boolean(panel.autoSave) : autoSave;

  // If panel provides a cameraModel/lens but caller didn't pass cameraSpec, derive it
  const finalCameraSpec = (cameraSpec && cameraSpec.imageWidth) ? cameraSpec : pickCameraSpecFromPanel(panel);

  // Sweep: compute if missing or incomplete
  let sweepUsed = sweep ? { ...sweep } : undefined;
  if (!sweepUsed || sweepUsed.lineSpacing == null || sweepUsed.pointSpacing == null) {
    const altitude = (sweepUsed && sweepUsed.alt) ? sweepUsed.alt : finalGlobalHeight;
    const computed = computeSweepFromCamera({
      altitude,
      cameraSpec: finalCameraSpec,
      gsdCm: finalGsdCm,
      sideOverlapPct: finalSideOverlap,
      frontOverlapPct: finalFrontOverlap,
      angleDeg: (sweepUsed && 'angleDeg' in sweepUsed) ? sweepUsed.angleDeg : (Number(panel.courseAngle ?? 0) || 0),
      alternate: (sweepUsed && 'alternate' in sweepUsed) ? sweepUsed.alternate : true,
    });
    sweepUsed = { ...computed, ...(sweepUsed || {}) };
  }

  sweepUsed.lineSpacing = Number(sweepUsed.lineSpacing);
  sweepUsed.pointSpacing = Number(sweepUsed.pointSpacing);
  sweepUsed.angleDeg = Number(sweepUsed.angleDeg || 0);
  sweepUsed.alt = Number(sweepUsed.alt || finalGlobalHeight);
  sweepUsed.alternate = Boolean(sweepUsed.alternate);

  const waypoints = generateSweepWaypoints({
    polygon,
    lineSpacing: sweepUsed.lineSpacing,
    pointSpacing: sweepUsed.pointSpacing,
    angleDeg: sweepUsed.angleDeg,
    alt: sweepUsed.alt,
    alternate: sweepUsed.alternate,
    autoFlightSpeed: finalAutoFlightSpeed
  });

  waypoints.forEach(w => { 
    w.speed = finalAutoFlightSpeed; 
    w.alt = w.alt ?? finalGlobalHeight; 
  });

  // map panel uponCompletion -> wpml finishAction tokens
  const finishActionMap = {
    "Return To Home": "goHome",
    "Exit Route Mode": "exitRoute",
    "Land": "land",
    "Return to start point and hover": "returnToStartPointHover"
  };
  const finishAction = finishActionMap[(panel.uponCompletion || panel.uponCompletion) || ""] || "goHome";

  const templateKML = buildTemplateKMLArea({
    name: finalName,
    polygon,
    templatePoints,
    globalHeight: finalGlobalHeight,
    autoFlightSpeed: finalAutoFlightSpeed,
    takeOffSecurityHeight: finalTakeOffSecurityHeight,
    droneEnumValue: finalDroneEnumValue,
    payloadParam,
    // pass the correctly named params
    frontOverlap: finalFrontOverlap ?? 80,
    sideOverlap: finalSideOverlap ?? 70,
    margin: Number(panel.margin ?? 0),
    finishAction
  });

  const waylinesWPML = buildWaylinesWPMLArea({
    waypoints,
    droneEnumValue: finalDroneEnumValue,
    droneSubEnumValue,
    payloadParam,
    takeOffSecurityHeight: finalTakeOffSecurityHeight,
    autoFlightSpeed: finalAutoFlightSpeed,
    globalHeight: finalGlobalHeight,
    actionIntervalSeconds: finalActionIntervalSeconds,
    finishAction
  });

  const zip = new JSZip();
  zip.file("template.kml", templateKML);
  zip.file("waylines.wpml", waylinesWPML);

  // embed exact panel snapshot (only editable fields) for traceability
  try {
    const editableSnapshot = extractEditablePanelFields(panel);
    zip.file("params.json", JSON.stringify(editableSnapshot, null, 2));
  } catch (e) {
    zip.file("params.json", "{}");
  }

  // include sweep meta for debugging / reproducibility
  try {
    if (sweepUsed && sweepUsed._meta) {
      zip.file("sweep-meta.json", JSON.stringify(sweepUsed._meta, null, 2));
    }
  } catch (e) {
    // ignore
  }

  const blob = await zip.generateAsync({ type: "blob" });

  if (finalAutoSave) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${finalName}.kmz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { 
    templateKML, 
    waylinesWPML, 
    blob, 
    waypoints, 
    sweepUsed, 
    templatePoints,
    panelParams: panel
  };
}

