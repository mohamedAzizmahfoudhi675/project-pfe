// area-route-kmz-with-drone-list.js
// Fully updated to match DJI WPML specification
// Generates KML/WPML and KMZ with waypoint action groups serialized into waylines.wpml / template.kml
import JSZip from "jszip";

// Haversine distance calculation (in meters)
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Updated drone enum mapping based on official specification
export const droneEnumMap = {
  "M300 RTK": 67,
  "M350 RTK": 75,
  "M30 Series": 67,
  "M30T": 67,
  "M3E": 60,
  "M3T": 60,
  "M3M": 60,
  "M3D": 76,
  "M3TD": 76,
  "M4E": 77,
  "M4T": 77,
  "Phantom 4 RTK": 44,
  "Mavic 3 Enterprise": 60,
  "Matrice 30 T": 67,
  "Mavic 2 Enterprise Advanced": 59,
  "Mavic 3 Thermal": 60,
  "Phantom 4 Pro V2.0": 43,
  "Inspire 2": 31,
  "Mavic 3 Classic": 60,
  "Mavic Air 2S": 58,
  "DJI Mini 4 Pro": 82,
  "DJI Air 3": 80,
};

// convenience: reverse map (enum -> model name)
export const droneEnumReverseMap = Object.entries(droneEnumMap).reduce((acc, [name, val]) => {
  acc[val] = acc[val] || name;
  return acc;
}, {});

// Updated camera payload mapping with correct enum values
export const cameraPayloadMap = {
  67: { // M300 RTK / M30 Series
    payloadEnumValue: 53, // M30T triple light camera
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    returnMode: 'singleReturnStrongest',
    samplingRate: 240000,
    scanningMode: 'nonRepetitive',
    modelColoringEnable: 0,
    imageFormat: 'wide,ir,zoom'
  },
  75: { // M350 RTK
    payloadEnumValue: 53, // Using M30T as default
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    returnMode: 'singleReturnStrongest',
    samplingRate: 240000,
    scanningMode: 'nonRepetitive',
    modelColoringEnable: 0,
    imageFormat: 'wide,ir,zoom'
  },
  60: { // Mavic 3 Enterprise series
    payloadEnumValue: 50,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    imageFormat: 'wide'
  },
  76: { // M3D/M3TD
    payloadEnumValue: 54,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    imageFormat: 'wide'
  },
  77: { // M4E/M4T
    payloadEnumValue: 55,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    imageFormat: 'wide'
  },
  44: { // Phantom 4 RTK
    payloadEnumValue: 41,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    imageFormat: 'wide'
  }
};

/**
 * UPDATED actionTypeMapping to match DJI WPML specification
 */
const actionTypeMapping = {
  // Camera capture & recording - Updated to match specification
  "Take Photo": { 
    func: "takePhoto", 
    params: { 
      payloadPositionIndex: 0,
      fileSuffix: "DJI_YYYYMMDDhhmm_XXX",
      useGlobalPayloadLensIndex: 1
    } 
  },
  "Burst Photo": { 
    func: "takePhoto", 
    params: { 
      payloadPositionIndex: 0,
      fileSuffix: "DJI_YYYYMMDDhhmm_XXX",
      useGlobalPayloadLensIndex: 1,
      count: 3
    } 
  },
  "Start Recording": { 
    func: "startRecord", 
    params: { 
      payloadPositionIndex: 0,
      fileSuffix: "DJI_YYYYMMDDhhmm_XXX",
      useGlobalPayloadLensIndex: 1
    } 
  },
  "Stop Recording": { 
    func: "stopRecord", 
    params: { 
      payloadPositionIndex: 0
    } 
  },

  // Gimbal controls - Updated to match specification
  "Gimbal Rotate": { 
    func: "gimbalRotate", 
    params: { 
      payloadPositionIndex: 0,
      gimbalHeadingYawBase: "north",
      gimbalRotateMode: "absoluteAngle",
      gimbalPitchRotateEnable: 1,
      gimbalPitchRotateAngle: 0,
      gimbalRollRotateEnable: 0,
      gimbalRollRotateAngle: 0,
      gimbalYawRotateEnable: 0,
      gimbalYawRotateAngle: 0,
      gimbalRotateTimeEnable: 1,
      gimbalRotateTime: 1.0
    } 
  },
  "Gimbal Pitch": { 
    func: "gimbalRotate", 
    params: { 
      payloadPositionIndex: 0,
      gimbalHeadingYawBase: "north",
      gimbalRotateMode: "absoluteAngle",
      gimbalPitchRotateEnable: 1,
      gimbalPitchRotateAngle: 0,
      gimbalRollRotateEnable: 0,
      gimbalRollRotateAngle: 0,
      gimbalYawRotateEnable: 0,
      gimbalYawRotateAngle: 0,
      gimbalRotateTimeEnable: 1,
      gimbalRotateTime: 1.0
    } 
  },

  // Zoom - Updated to use focalLength instead of zoom factor
  "Camera Zoom": { 
    func: "zoom", 
    params: { 
      payloadPositionIndex: 0,
      focalLength: 4.5 // in mm
    } 
  },

  // Special capture modes
  "Timed Interval Shot": { 
    func: "takePhoto", 
    params: { 
      payloadPositionIndex: 0,
      fileSuffix: "DJI_YYYYMMDDhhmm_XXX",
      useGlobalPayloadLensIndex: 1,
      interval: 3
    } 
  },
  "Distance Interval Shot": { 
    func: "takePhoto", 
    params: { 
      payloadPositionIndex: 0,
      fileSuffix: "DJI_YYYYMMDDhhmm_XXX",
      useGlobalPayloadLensIndex: 1,
      distance: 10
    } 
  },

  // File management
  "Create Folder": { 
    func: "customDirName", 
    params: { 
      payloadPositionIndex: 0,
      directoryName: "NewFolder"
    } 
  },

  // Aircraft controls
  "Aircraft Rotate": { 
    func: "rotateYaw", 
    params: { 
      aircraftHeading: 0,
      aircraftPathMode: "clockwise"
    } 
  },

  // Hover action
  "Hover": { 
    func: "hover", 
    params: { 
      hoverTime: 5.0
    } 
  },

  // Panorama action
  "Panorama": { 
    func: "panoShot", 
    params: { 
      payloadPositionIndex: 0,
      panoShotSubMode: "panoShot_360",
      useGlobalPayloadLensIndex: 1
    } 
  },

  // Fixed Angle Shot
  "Fixed Angle Shot": { 
    func: "orientedShoot", 
    params: { 
      payloadPositionIndex: 0,
      gimbalPitchRotateAngle: -45,
      gimbalYawRotateAngle: 0,
      aircraftHeading: 0,
      useGlobalPayloadLensIndex: 1,
      accurateFrameValid: 0
    } 
  }
};

/** Convert React component actions to DJI WPML format */
function convertActionsToDJIFormat(actions, waypointParams = {}) {
  if (!actions || !Array.isArray(actions)) return [];

  // Normalize input
  const normalized = actions.map(a => {
    if (!a) return null;
    if (typeof a === "string") return { type: a, parameters: {} };
    // Handle both 'params' and 'parameters' property names
    return { 
      type: a.type, 
      parameters: a.parameters || a.params || {} 
    };
  }).filter(Boolean);

  return normalized.map((action) => {
    const mapping = actionTypeMapping[action.type] || null;

    if (!mapping) {
      // Custom function fallback
      const func = action.type;
      const params = { ...(action.parameters || {}) };
      return { func, params };
    }

    // Start with default params
    const params = { ...(mapping.params || {}) };

    // Merge action-specific parameters
    Object.assign(params, action.parameters || {});

    // Handle special parameter types from WaypointParamsPanel

    // 1. Storage checkbox-group handling
    if (action.parameters?.storage && typeof action.parameters.storage === 'object') {
      const storage = action.parameters.storage;
      // Convert checkbox group to actual parameters
      if (storage.wide !== undefined || storage.zoom !== undefined) {
        // Build image format string
        const formats = [];
        if (storage.wide) formats.push('wide');
        if (storage.zoom) formats.push('zoom');
        if (storage.ir) formats.push('ir');
        if (storage.narrow_band) formats.push('narrow_band');
        if (storage.visible) formats.push('visible');
        params.payloadLensIndex = formats.join(',') || 'wide';
      }
      // Remove the storage object itself
      delete params.storage;
    }

    // 2. Gimbal angle handling (from range sliders)
    if ((action.type === "Gimbal Rotate" || action.type === "Gimbal Pitch") && waypointParams) {
      if (action.parameters?.pitch != null) {
        params.gimbalPitchRotateEnable = 1;
        params.gimbalPitchRotateAngle = Number(action.parameters.pitch);
      }
      if (action.parameters?.yaw != null) {
        params.gimbalYawRotateEnable = 1;
        params.gimbalYawRotateAngle = Number(action.parameters.yaw);
      }
      // Also check waypoint-level values
      if (params.gimbalPitchRotateAngle == null && waypointParams.gimbalPitchAngle != null) {
        params.gimbalPitchRotateEnable = 1;
        params.gimbalPitchRotateAngle = waypointParams.gimbalPitchAngle;
      }
    }

    // 3. Camera zoom handling - convert zoom level to focal length
    if (action.type === "Camera Zoom") {
      if (action.parameters?.zoom != null) {
        // Convert zoom level to focal length in mm
        // This mapping depends on the specific camera - using M30T as reference
        const zoomToFocalLength = {
          1: 4.5,   // wide
          2: 12,    // 3x zoom
          3: 24,    // 6x zoom  
          4: 48,    // 12x zoom
          5: 200    // max zoom
        };
        params.focalLength = zoomToFocalLength[action.parameters.zoom] || 4.5;
        delete params.zoom; // Remove old parameter
      }
    }

    // 4. Timed interval handling
    if (action.type === "Timed Interval Shot") {
      if (action.parameters?.interval != null) {
        params.interval = Number(action.parameters.interval);
      }
    }

    // 5. Distance interval handling
    if (action.type === "Distance Interval Shot") {
      if (action.parameters?.distance != null) {
        params.distance = Number(action.parameters.distance);
      }
    }

    // 6. Aircraft rotate angle handling
    if (action.type === "Aircraft Rotate") {
      if (action.parameters?.angle != null) {
        params.aircraftHeading = Number(action.parameters.angle);
        delete params.angle; // Remove old parameter
      }
    }

    // 7. Hover duration handling
    if (action.type === "Hover") {
      if (action.parameters?.duration != null) {
        params.hoverTime = Number(action.parameters.duration);
        delete params.duration; // Remove old parameter
      }
    }

    // 8. Panorama type handling
    if (action.type === "Panorama") {
      if (action.parameters?.type != null) {
        params.panoShotSubMode = action.parameters.type;
      }
    }

    // 9. Fixed angle handling
    if (action.type === "Fixed Angle Shot") {
      if (action.parameters?.angle != null) {
        params.gimbalPitchRotateAngle = Number(action.parameters.angle);
      }
      if (action.parameters?.autoFrame !== undefined) {
        params.accurateFrameValid = action.parameters.autoFrame ? 1 : 0;
      }
    }

    // 10. File name handling for photos and recordings
    if ((action.type === "Take Photo" || action.type === "Burst Photo" || action.type === "Start Recording")) {
      if (action.parameters?.fileName != null) {
        params.fileSuffix = action.parameters.fileName;
        delete params.fileName; // Remove old parameter
      }
    }

    // 11. Folder name handling
    if (action.type === "Create Folder") {
      if (action.parameters?.name != null) {
        params.directoryName = action.parameters.name;
        delete params.name; // Remove old parameter
      }
    }

    // 12. Burst photo count handling
    if (action.type === "Burst Photo") {
      if (action.parameters?.count != null) {
        params.count = Number(action.parameters.count);
      }
    }

    return { func: mapping.func, params };
  }).filter(Boolean);
}

/** Helper for serializing actions array (DJI style) */
function serializeActions(actions) {
  if (!actions || !Array.isArray(actions)) return '';
  return actions
    .filter(action => typeof action.func === "string" && action.func.length > 0)
    .map((action, aId) => {
      // For each param, convert nested objects/arrays to JSON string so XML tag contains single text node
      const paramsXML = Object.entries(action.params || {})
        .map(([key, value]) => {
          // Represent booleans/numbers/strings directly; objects/arrays stringify as JSON
          let outVal;
          if (value === null || value === undefined) {
            outVal = '';
          } else if (typeof value === 'object') {
            try {
              outVal = JSON.stringify(value);
            } catch (e) {
              outVal = String(value);
            }
          } else {
            outVal = String(value);
          }
          // Escape XML-unfriendly characters minimally (replace & < >) to avoid breaking KML
          outVal = outVal.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
          return `<wpml:${key}>${outVal}</wpml:${key}>`;
        }).join('\n          ');
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

/** Get default payload configuration for a drone */
function getDefaultPayload(droneEnumValue) {
  return cameraPayloadMap[droneEnumValue] || {
    payloadEnumValue: 0,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    focusMode: 'firstPoint',
    meteringMode: 'average',
    dewarpingEnable: 0,
    returnMode: 'singleReturnStrongest',
    samplingRate: 120000,
    scanningMode: 'nonRepetitive',
    modelColoringEnable: 0,
    imageFormat: 'wide'
  };
}

/* ---------- Drone list utilities ---------- */

/** Return array of available drone model names (useful for UI selects) */
export function availableDroneModels() {
  return Object.keys(droneEnumMap);
}

/** Case-insensitive & substring-aware pick of drone enum by model string */
export function pickDroneEnumByName(nameOrPartial) {
  if (!nameOrPartial) return null;
  const s = String(nameOrPartial).trim().toLowerCase();
  // exact match
  for (const key of Object.keys(droneEnumMap)) {
    if (key.toLowerCase() === s) return { droneEnumValue: droneEnumMap[key], droneModelName: key };
  }
  // substring match
  for (const key of Object.keys(droneEnumMap)) {
    if (key.toLowerCase().includes(s) || s.includes(key.toLowerCase())) return { droneEnumValue: droneEnumMap[key], droneModelName: key };
  }
  // token match
  const tokens = s.split(/\W+/).filter(Boolean);
  for (const t of tokens) {
    for (const key of Object.keys(droneEnumMap)) {
      if (key.toLowerCase().includes(t) && t.length >= 2) return { droneEnumValue: droneEnumMap[key], droneModelName: key };
    }
  }
  return null;
}

/** Resolve drone enum & model name from provided params (panel / pathParams) */
export function resolveDroneFromParams(params = {}) {
  let droneSubEnumValue = 1; // Default sub-enum

  // 1) numeric explicit override
  if (params.droneEnumValue != null && !Number.isNaN(Number(params.droneEnumValue))) {
    const droneEnum = Number(params.droneEnumValue);
    // For M30 series, set appropriate sub-enum
    if (droneEnum === 67) {
      const modelName = (params.aircraftModel || params.droneModel || '').toLowerCase();
      droneSubEnumValue = modelName.includes('m30t') ? 1 : 0;
    }
    return {
      resolvedDroneEnumValue: droneEnum,
      resolvedDroneModelName: params.aircraftModel || params.droneModel || droneEnumReverseMap[droneEnum] || null,
      resolvedDroneSubEnumValue: droneSubEnumValue
    };
  }

  // 2) try model name fields
  const modelCandidates = [params.aircraftModel, params.droneModel, params.model, params.aircraft];
  for (const cand of modelCandidates) {
    if (!cand || typeof cand !== 'string') continue;
    const pick = pickDroneEnumByName(cand);
    if (pick) {
      // For M30 series, set appropriate sub-enum
      if (pick.droneEnumValue === 67) {
        droneSubEnumValue = cand.toLowerCase().includes('m30t') ? 1 : 0;
      }
      return { 
        resolvedDroneEnumValue: pick.droneEnumValue, 
        resolvedDroneModelName: pick.droneModelName,
        resolvedDroneSubEnumValue: droneSubEnumValue
      };
    }
  }

  // 3) fallback default (first entry in droneEnumMap)
  const defaultKey = Object.keys(droneEnumMap)[0];
  const defaultEnum = droneEnumMap[defaultKey];
  // For M30 series, set appropriate sub-enum
  if (defaultEnum === 67) {
    droneSubEnumValue = defaultKey.toLowerCase().includes('m30t') ? 1 : 0;
  }
  return { 
    resolvedDroneEnumValue: defaultEnum, 
    resolvedDroneModelName: defaultKey || "Unknown",
    resolvedDroneSubEnumValue: droneSubEnumValue
  };
}

/* ---------- KML/WPML builders ---------- */

export function buildTemplateKML({
  name = "Route",
  droneEnumValue = null,
  droneSubEnumValue = 1,
  payloadInfo = null,
  payloadParam = null,
  autoFlightSpeed = 12.8,
  globalHeight = 53,
  globalTransitionalSpeed = 10.9,
  takeOffSecurityHeight = 66,
  path = [],
  createTime,
  updateTime,
  waypointHeadingMode = "followWayline",
  waypointTurnMode = "toPointAndStopWithDiscontinuityCurvature",
  gimbalPitchMode = "manual",
  caliFlightEnable = 0,
  globalUseStraightLine = 1,
  panelParams = {}
} = {}) {
  const now = Date.now();

  // resolve drone if not provided
  let resolved = resolveDroneFromParams(panelParams || {});
  if (droneEnumValue == null) {
    droneEnumValue = resolved.resolvedDroneEnumValue;
    droneSubEnumValue = resolved.resolvedDroneSubEnumValue;
  }

  const defaultPayload = getDefaultPayload(droneEnumValue);

  if (payloadInfo === null) {
    payloadInfo = {
      payloadEnumValue: defaultPayload.payloadEnumValue,
      payloadSubEnumValue: defaultPayload.payloadSubEnumValue,
      payloadPositionIndex: defaultPayload.payloadPositionIndex
    };
  }

  if (payloadParam === null) {
    payloadParam = {
      payloadPositionIndex: defaultPayload.payloadPositionIndex,
      focusMode: defaultPayload.focusMode,
      meteringMode: defaultPayload.meteringMode,
      dewarpingEnable: defaultPayload.dewarpingEnable,
      returnMode: defaultPayload.returnMode,
      samplingRate: defaultPayload.samplingRate,
      scanningMode: defaultPayload.scanningMode,
      modelColoringEnable: defaultPayload.modelColoringEnable,
      imageFormat: defaultPayload.imageFormat
    };
  }

  let actionGroupCounter = 0;
  const placemarks = path
    .map((p, i) => {
      const useGlobalSpeed = p.speed == null ? 1 : 0;
      const useGlobalHeadingParam = p.waypointHeadingMode == null ? 1 : 0;
      const useGlobalTurnParam = p.waypointTurnMode == null ? 1 : 0;
      const useStraightLine = p.useStraightLine ?? 1;
      const height = p.alt ?? globalHeight;

      // Convert actions to DJI WPML format using robust converter
      const djiActions = convertActionsToDJIFormat(p.actions, p);

      let placemarkStr = `
      <Placemark>
        <Point>
          <coordinates>
            ${p.lng},${p.lat}
          </coordinates>
        </Point>
        <wpml:index>${i}</wpml:index>
        <wpml:ellipsoidHeight>${height}</wpml:ellipsoidHeight>
        <wpml:height>${height}</wpml:height>
        <wpml:useGlobalHeight>1</wpml:useGlobalHeight>
        <wpml:useGlobalSpeed>${useGlobalSpeed}</wpml:useGlobalSpeed>
        <wpml:useGlobalHeadingParam>${useGlobalHeadingParam}</wpml:useGlobalHeadingParam>
        <wpml:useGlobalTurnParam>${useGlobalTurnParam}</wpml:useGlobalTurnParam>
        <wpml:useStraightLine>${useStraightLine}</wpml:useStraightLine>
        <wpml:isRisky>${p.isRisky ?? 0}</wpml:isRisky>`;
      if (p.speed != null) placemarkStr += `\n        <wpml:waypointSpeed>${p.speed}</wpml:waypointSpeed>`;
      placemarkStr += `
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${p.waypointHeadingMode || waypointHeadingMode}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${p.waypointHeadingAngle ?? 0}</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>${p.waypointPoiPoint ?? '0.000000,0.000000,0.000000'}</wpml:waypointPoiPoint>
          <wpml:waypointHeadingPathMode>${p.waypointHeadingPathMode || 'followBadArc'}</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>${p.waypointHeadingPoiIndex ?? 0}</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${p.waypointTurnMode || waypointTurnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>${p.waypointTurnDampingDist ?? 0}</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>`;
      if (djiActions && djiActions.length > 0) {
        placemarkStr += `
        <wpml:actionGroup>
          <wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${i}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${i}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
${serializeActions(djiActions)}
        </wpml:actionGroup>`;
      }
      placemarkStr += `\n      </Placemark>`;
      return placemarkStr;
    })
    .join("\n");

  const payloadInfoStr = `
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>${payloadInfo.payloadEnumValue}</wpml:payloadEnumValue>
        <wpml:payloadSubEnumValue>${payloadInfo.payloadSubEnumValue}</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>${payloadInfo.payloadPositionIndex}</wpml:payloadPositionIndex>
      </wpml:payloadInfo>`;

  const payloadParamStr = `
      <wpml:payloadParam>
        <wpml:payloadPositionIndex>${payloadParam.payloadPositionIndex}</wpml:payloadPositionIndex>
        <wpml:focusMode>${payloadParam.focusMode}</wpml:focusMode>
        <wpml:meteringMode>${payloadParam.meteringMode}</wpml:meteringMode>
        <wpml:dewarpingEnable>${payloadParam.dewarpingEnable}</wpml:dewarpingEnable>
        <wpml:returnMode>${payloadParam.returnMode}</wpml:returnMode>
        <wpml:samplingRate>${payloadParam.samplingRate}</wpml:samplingRate>
        <wpml:scanningMode>${payloadParam.scanningMode}</wpml:scanningMode>
        <wpml:modelColoringEnable>${payloadParam.modelColoringEnable}</wpml:modelColoringEnable>
        <wpml:imageFormat>${payloadParam.imageFormat}</wpml:imageFormat>
      </wpml:payloadParam>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:createTime>${createTime ?? now}</wpml:createTime>
    <wpml:updateTime>${updateTime ?? now}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${globalTransitionalSpeed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>${payloadInfoStr}
    </wpml:missionConfig>
    <Folder>
      <wpml:templateType>waypoint</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
        <wpml:positioningType>GPS</wpml:positioningType>
      </wpml:waylineCoordinateSysParam>
      <wpml:autoFlightSpeed>${autoFlightSpeed}</wpml:autoFlightSpeed>
      <wpml:globalHeight>${globalHeight}</wpml:globalHeight>
      <wpml:caliFlightEnable>${caliFlightEnable}</wpml:caliFlightEnable>
      <wpml:gimbalPitchMode>${gimbalPitchMode}</wpml:gimbalPitchMode>
      <wpml:globalWaypointHeadingParam>
        <wpml:waypointHeadingMode>${waypointHeadingMode}</wpml:waypointHeadingMode>
        <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
        <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
        <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
      </wpml:globalWaypointHeadingParam>
      <wpml:globalWaypointTurnMode>${waypointTurnMode}</wpml:globalWaypointTurnMode>
      <wpml:globalUseStraightLine>${globalUseStraightLine}</wpml:globalUseStraightLine>
      ${placemarks}${payloadParamStr}
    </Folder>
  </Document>
</kml>`;
}

/** Build waylines.wpml string for DJI waypoint mission */
export function buildWaylinesWPML({
  path = [],
  droneEnumValue = null,
  droneSubEnumValue = 1,
  payloadInfo = null,
  payloadParam = null,
  takeOffSecurityHeight = 66,
  globalTransitionalSpeed = 10.9,
  autoFlightSpeed = 12.8,
  globalHeight = path[0]?.alt ?? 53,
  waypointHeadingMode = "followWayline",
  waypointTurnMode = "toPointAndStopWithDiscontinuityCurvature",
  gimbalPitchAngle = 0,
  gimbalYawAngle = 0,
  panelParams = {}
} = {}) {
  let resolved = resolveDroneFromParams(panelParams || {});
  if (droneEnumValue == null) {
    droneEnumValue = resolved.resolvedDroneEnumValue;
    droneSubEnumValue = resolved.resolvedDroneSubEnumValue;
  }

  const defaultPayload = getDefaultPayload(droneEnumValue);

  if (!payloadInfo) {
    payloadInfo = {
      payloadEnumValue: defaultPayload.payloadEnumValue,
      payloadSubEnumValue: defaultPayload.payloadSubEnumValue,
      payloadPositionIndex: defaultPayload.payloadPositionIndex,
    };
  }

  if (!payloadParam) {
    payloadParam = {
      payloadPositionIndex: defaultPayload.payloadPositionIndex,
      focusMode: defaultPayload.focusMode,
      meteringMode: defaultPayload.meteringMode,
      dewarpingEnable: defaultPayload.dewarpingEnable,
      returnMode: defaultPayload.returnMode,
      samplingRate: defaultPayload.samplingRate,
      scanningMode: defaultPayload.scanningMode,
      modelColoringEnable: defaultPayload.modelColoringEnable,
      imageFormat: defaultPayload.imageFormat,
    };
  }

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += haversine(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  const duration = autoFlightSpeed > 0 ? totalDistance / autoFlightSpeed : 0;

  let actionGroupCounter = 0;
  const placemarks = path.map((p, i) => {
    const headingMode = p.waypointHeadingMode ?? waypointHeadingMode;
    const turnMode = p.waypointTurnMode ?? waypointTurnMode;
    const headingAngleEnable = p.waypointHeadingAngleEnable ?? 0;
    const turnDampingDist = p.waypointTurnDampingDist ?? 0;
    const pitchAngle = p.gimbalPitchAngle ?? gimbalPitchAngle;
    const yawAngle = p.gimbalYawAngle ?? gimbalYawAngle;

    // Convert actions to DJI WPML format using robust converter
    const djiActions = convertActionsToDJIFormat(p.actions, p);

    return `
      <Placemark>
        <Point>
          <coordinates>${p.lng},${p.lat}</coordinates>
        </Point>
        <wpml:index>${i}</wpml:index>
        <wpml:executeHeight>${p.alt ?? globalHeight}</wpml:executeHeight>
        <wpml:waypointSpeed>${p.speed ?? autoFlightSpeed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${p.waypointHeadingAngle ?? 0}</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>${p.waypointPoiPoint ?? '0.000000,0.000000,0.000000'}</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>${p.waypointHeadingPathMode || 'followBadArc'}</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>${p.waypointHeadingPoiIndex ?? 0}</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>${turnDampingDist}</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>1</wpml:useStraightLine>
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>${pitchAngle}</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>${yawAngle}</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
        <wpml:isRisky>${p.isRisky ?? 0}</wpml:isRisky>
        <wpml:waypointWorkType>${p.waypointWorkType ?? 0}</wpml:waypointWorkType>
        ${djiActions && djiActions.length > 0 ? `
        <wpml:actionGroup>
          <wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${i}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${i}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
${serializeActions(djiActions)}
        </wpml:actionGroup>` : ''}
      </Placemark>`;
  }).join("\n");

  const payloadInfoStr = `
    <wpml:payloadInfo>
      <wpml:payloadEnumValue>${payloadInfo.payloadEnumValue}</wpml:payloadEnumValue>
      <wpml:payloadSubEnumValue>${payloadInfo.payloadSubEnumValue}</wpml:payloadSubEnumValue>
      <wpml:payloadPositionIndex>${payloadInfo.payloadPositionIndex}</wpml:payloadPositionIndex>
    </wpml:payloadInfo>`;

  const payloadParamStr = `
    <wpml:payloadParam>
      <wpml:payloadPositionIndex>${payloadParam.payloadPositionIndex}</wpml:payloadPositionIndex>
      <wpml:focusMode>${payloadParam.focusMode}</wpml:focusMode>
      <wpml:meteringMode>${payloadParam.meteringMode}</wpml:meteringMode>
      <wpml:dewarpingEnable>${payloadParam.dewarpingEnable}</wpml:dewarpingEnable>
      <wpml:returnMode>${payloadParam.returnMode}</wpml:returnMode>
      <wpml:samplingRate>${payloadParam.samplingRate}</wpml:samplingRate>
      <wpml:scanningMode>${payloadParam.scanningMode}</wpml:scanningMode>
      <wpml:modelColoringEnable>${payloadParam.modelColoringEnable}</wpml:modelColoringEnable>
      <wpml:imageFormat>${payloadParam.imageFormat}</wpml:imageFormat>
    </wpml:payloadParam>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${globalTransitionalSpeed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>${payloadInfoStr}
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>${totalDistance.toFixed(9)}</wpml:distance>
      <wpml:duration>${duration.toFixed(9)}</wpml:duration>
      <wpml:autoFlightSpeed>${autoFlightSpeed}</wpml:autoFlightSpeed>
      ${placemarks}${payloadParamStr}
    </Folder>
  </Document>
</kml>`;
}

/** Trigger download of plain KML */
export function exportKMLFile({ name = "route", path, ...rest }) {
  const kml = buildTemplateKML({ name, path, ...rest });
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.kml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generate KMZ as Blob without downloading */
export async function generateKMZBlob(params = {}) {
  try {
    const zip = new JSZip();

    // Resolve drone from params to ensure payloads and metadata
    const resolved = resolveDroneFromParams(params.panelParams || params || {});
    const paramsWithResolved = {
      ...params,
      droneEnumValue: params.droneEnumValue ?? resolved.resolvedDroneEnumValue,
      droneSubEnumValue: params.droneSubEnumValue ?? resolved.resolvedDroneSubEnumValue,
      panelParams: params.panelParams ?? params
    };

    const templateKML = buildTemplateKML(paramsWithResolved);
    const waylinesWPML = buildWaylinesWPML(paramsWithResolved);

    const ensureXmlHeader = (s) => {
      const without = s.replace(/^\s*<\?xml[^>]*>\s*/i, '');
      return `<?xml version="1.0" encoding="UTF-8"?>\n${without}`;
    };

    zip.file("template.kml", ensureXmlHeader(templateKML));
    zip.file("waylines.wpml", ensureXmlHeader(waylinesWPML));

    // params.json: include resolved drone info + panel snapshot
    try {
      const meta = Object.assign({}, params.panelParams || {}, {
        resolvedDroneEnumValue: paramsWithResolved.droneEnumValue,
        resolvedDroneSubEnumValue: paramsWithResolved.droneSubEnumValue,
        resolvedDroneModelName: resolved.resolvedDroneModelName || params.panelParams?.aircraftModel || null
      });
      zip.file("params.json", JSON.stringify(meta, null, 2));
      // also add a dedicated drone.json that explicitly records model and enum
      zip.file("drone.json", JSON.stringify({
        droneModelName: meta.resolvedDroneModelName,
        droneEnumValue: meta.resolvedDroneEnumValue,
        droneSubEnumValue: meta.resolvedDroneSubEnumValue,
        droneEnumMapKeys: availableDroneModels()
      }, null, 2));
    } catch (e) {
      // ignore
    }

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    console.log(`Generated KMZ file: ${blob.size} bytes`);
    return blob;
  } catch (error) {
    console.error("Error generating KMZ blob:", error);
    throw error;
  }
}

/** Build and download KMZ */
export async function exportKMZFile(params = {}) {
  try {
    const blob = await generateKMZBlob(params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${params.name || "route"}.kmz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return blob;
  } catch (error) {
    console.error("Error exporting KMZ file:", error);
    throw error;
  }
}

// WebSocket sending functions

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function calculateTotalDistance(path) {
  if (!path || path.length < 2) return 0;
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += haversine(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  return totalDistance;
}

function calculateEstimatedDuration(path, speed) {
  const totalDistance = calculateTotalDistance(path);
  return speed > 0 ? totalDistance / speed : 0;
}

/** Send KML file to server via WebSocket */
export async function sendKMLToServer({
  name = "mission.kml",
  pathParams = {},
  websocket,
  onProgress
} = {}) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket not open");
  }

  try {
    const resolved = resolveDroneFromParams(pathParams.panelParams || pathParams || {});
    const droneEnum = pathParams.droneEnumValue ?? resolved.resolvedDroneEnumValue;
    const droneSubEnum = pathParams.droneSubEnumValue ?? resolved.resolvedDroneSubEnumValue;

    const kml = buildTemplateKML({ 
      name, 
      ...pathParams, 
      droneEnumValue: droneEnum,
      droneSubEnumValue: droneSubEnum
    });

    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    const base64Data = await blobToBase64(blob);
    const waypointCount = pathParams.path ? pathParams.path.length : 0;

    const uploadMessage = {
      type: "file_upload",
      filename: name.endsWith('.kml') ? name : `${name}.kml`,
      fileData: base64Data,
      metadata: {
        missionName: name.replace('.kml', ''),
        waypointCount,
        fileSize: blob.size,
        fileType: 'kml',
        droneEnumValue: droneEnum,
        droneSubEnumValue: droneSubEnum,
        droneModelName: resolved.resolvedDroneModelName,
        timestamp: new Date().toISOString()
      }
    };

    websocket.send(JSON.stringify(uploadMessage));

    console.log(`✅ KML file sent to server: ${name} (${blob.size} bytes, ${waypointCount} waypoints)`);

    if (onProgress) onProgress(100);

    return { success: true, name, size: blob.size, waypointCount };
  } catch (error) {
    console.error("❌ Error sending KML to server:", error);
    throw error;
  }
}

/** Send KMZ to server */
export async function sendKMZToServer({
  name = "mission.kmz",
  pathParams = {},
  websocket,
  onProgress
} = {}) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket not open");
  }

  try {
    const resolved = resolveDroneFromParams(pathParams.panelParams || pathParams || {});
    const droneEnum = pathParams.droneEnumValue ?? resolved.resolvedDroneEnumValue;
    const droneSubEnum = pathParams.droneSubEnumValue ?? resolved.resolvedDroneSubEnumValue;

    const blob = await generateKMZBlob({ 
      ...pathParams, 
      droneEnumValue: droneEnum,
      droneSubEnumValue: droneSubEnum
    });
    const base64Data = await blobToBase64(blob);
    const waypointCount = pathParams.path ? pathParams.path.length : 0;

    const uploadMessage = {
      type: "file_upload",
      filename: name.endsWith('.kmz') ? name : `${name}.kmz`,
      fileData: base64Data,
      metadata: {
        missionName: name.replace('.kmz', ''),
        waypointCount,
        fileSize: blob.size,
        fileType: 'kmz',
        droneEnumValue: droneEnum,
        droneSubEnumValue: droneSubEnum,
        droneModelName: resolved.resolvedDroneModelName,
        totalDistance: calculateTotalDistance(pathParams.path || []),
        estimatedDuration: calculateEstimatedDuration(pathParams.path || [], pathParams.autoFlightSpeed || 12.8),
        timestamp: new Date().toISOString()
      }
    };

    websocket.send(JSON.stringify(uploadMessage));

    console.log(`✅ KMZ file sent to server: ${name} (${blob.size} bytes, ${waypointCount} waypoints)`);

    if (onProgress) onProgress(100);

    return { success: true, name, size: blob.size, waypointCount };
  } catch (error) {
    console.error("❌ Error sending KMZ to server:", error);
    throw error;
  }
}