// File: src/components/WaypointParamsPanel.jsx
import React, { useState, useEffect, useMemo } from "react";

/* ---------- Constants ---------- */
const aircraftYawModes = [
  { value: "route", label: "Along the Route", iconKey: "route" },
  { value: "manual", label: "Manual", iconKey: "manual" },
  { value: "lock", label: "Lock Yaw Axis", iconKey: "lock" },
];

const aircraftRotationModes = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
];

const waypointTypes = [
  { value: "straight_stop", label: "Straight route. Aircraft stops", iconKey: "straight_stop" },
  { value: "coordinated_turn", label: "Coordinated Turn (Skips Waypoint)", iconKey: "coordinated_turn" },
  { value: "curved_stop", label: "Curved route. Aircraft stops", iconKey: "curved_stop" },
  { value: "curved_continue", label: "Curved route. Aircraft continues", iconKey: "curved_continue" },
];

const gimbalPitchRange = { min: -120, max: 45 };
const gimbalYawRange = { min: -180, max: 180 };
const cameraZoomRange = { min: 2, max: 200 };

// EXPANDED ACTION_CONFIG matching DJI Pilot 2 interface
const ACTION_CONFIG = {
  // Camera capture & recording
  "Take Photo": {
    iconKey: "takePhoto",
    parameters: [
      { name: "fileName", type: "text", label: "File Name", defaultValue: "DJI_YYYYMMDDhhmm_XXX_Waypoint1" },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: false },
        { key: "followRoute", label: "Follow Route", defaultValue: false },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: true }
      ]},
      { name: "payloadPositionIndex", type: "number", label: "Payload Position", min: 0, max: 2, defaultValue: 0 },
    ],
  },
  "Burst Photo": {
    iconKey: "takePhoto",
    parameters: [
      { name: "fileName", type: "text", label: "File Name", defaultValue: "DJI_YYYYMMDDhhmm_XXX_Waypoint1" },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: false },
        { key: "followRoute", label: "Follow Route", defaultValue: false },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: true }
      ]},
      { name: "count", type: "number", label: "Burst Count", min: 2, max: 10, defaultValue: 3 },
    ],
  },
  "Start Recording": {
    iconKey: "startRecording",
    parameters: [
      { name: "fileName", type: "text", label: "File Name", defaultValue: "DJI_YYYYMMDDhhmm_XXX_Waypoint1" },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: true },
        { key: "followRoute", label: "Follow Route", defaultValue: false },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: true }
      ]},
    ],
  },
  "Stop Recording": { 
    iconKey: "stopRecording", 
    parameters: [] 
  },

  // Gimbal controls
  "Gimbal Pitch": { 
    iconKey: "gimbalPitch", 
    parameters: [
      { name: "pitch", type: "range", label: "Pitch Angle (°)", min: gimbalPitchRange.min, max: gimbalPitchRange.max, defaultValue: 0 },
    ] 
  },
  "Gimbal Yaw": { 
    iconKey: "gimbalYaw", 
    parameters: [
      { name: "yaw", type: "range", label: "Yaw Angle (°)", min: gimbalYawRange.min, max: gimbalYawRange.max, defaultValue: 0 },
    ] 
  },
  "Gimbal Pitch Rotation": {
    iconKey: "gimbalPitch",
    parameters: [
      { name: "pitch", type: "range", label: "Gimbal Pitch Rotation (°)", min: gimbalPitchRange.min, max: gimbalPitchRange.max, defaultValue: 0 },
      { name: "yaw", type: "range", label: "Gimbal Yaw (°)", min: gimbalYawRange.min, max: gimbalYawRange.max, defaultValue: 0 },
    ]
  },

  // Zoom & lens
  "Camera Zoom": { 
    iconKey: "cameraZoom", 
    parameters: [
      { name: "zoom", type: "range", label: "Camera Zoom (X)", min: cameraZoomRange.min, max: cameraZoomRange.max, defaultValue: 2 },
    ] 
  },

  // Special capture modes
  "Timed Interval Shot": { 
    iconKey: "timedInterval", 
    parameters: [
      { name: "interval", type: "range", label: "Timed Interval Shot (s)", min: 1, max: 30, defaultValue: 3 },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: false },
        { key: "followRoute", label: "Follow Route", defaultValue: true },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: false }
      ]},
    ] 
  },
  "Distance Interval Shot": { 
    iconKey: "distanceInterval", 
    parameters: [
      { name: "distance", type: "range", label: "Distance Interval (m)", min: 1, max: 100, defaultValue: 10 },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: false },
        { key: "followRoute", label: "Follow Route", defaultValue: false },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: false }
      ]},
    ] 
  },
  "Panorama": { 
    iconKey: "panorama", 
    parameters: [
      { name: "type", type: "select", label: "Panorama Type", options: ["sphere", "horizontal", "vertical", "180°", "wide"], defaultValue: "sphere" },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: false },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: false }
      ]},
    ] 
  },
  "Fixed Angle Shot": { 
    iconKey: "fixedAngle", 
    parameters: [
      { name: "angle", type: "select", label: "Fixed Angle", options: ["0°", "45°", "90°", "120°", "180°"], defaultValue: "0°" },
      { name: "storage", type: "checkbox-group", label: "Storage", options: [
        { key: "storage", label: "Storage", defaultValue: false },
        { key: "wide", label: "WIDE", defaultValue: true },
        { key: "zoom", label: "ZOOM", defaultValue: false }
      ]},
    ] 
  },

  // File management
  "Create Folder": { 
    iconKey: "createFolder", 
    parameters: [
      { name: "name", type: "text", label: "Folder Name", defaultValue: "Waypoint_Collection" }
    ] 
  },
  "Enter Folder": {
    iconKey: "createFolder",
    parameters: [
      { name: "name", type: "text", label: "Folder Name", defaultValue: "NewFolder" }
    ]
  },
  "Exit": { 
    iconKey: "exit", 
    parameters: [] 
  },

  // Aircraft controls  
  "Aircraft Rotate": { 
    iconKey: "aircraftRotate", 
    parameters: [
      { name: "angle", type: "range", label: "Rotation Angle (°)", min: -180, max: 180, defaultValue: 0 },
    ] 
  },
  "Hover": {
    iconKey: "followRoute",
    parameters: [
      { name: "duration", type: "number", label: "Hover Duration (s)", min: 1, max: 60, defaultValue: 5 }
    ]
  },
};

const AVAILABLE_ACTIONS = Object.keys(ACTION_CONFIG);

// Conversion
const mphToMs = (mph) => mph * 0.44704;
const ftToM = (ft) => ft * 0.3048;

/* ---------- SVG Icons ---------- */
const IconWrapper = ({ children }) => <span className="inline-flex items-center justify-center w-6 h-6">{children}</span>;

const CameraIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor"><path d="M4 7h3l2-2h6l2 2h3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </IconWrapper>
);
const VideoIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M23 7l-7 5 7 5V7z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="5" width="15" height="14" rx="2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </IconWrapper>
);
const SquareIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5"/></svg>
  </IconWrapper>
);
const RotateIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 0-3 6.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 3v6h-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </IconWrapper>
);
const GimbalIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M12 3v4" strokeWidth="1.5"/><path d="M7 8l5 5 5-5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </IconWrapper>
);
const ZoomIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="6" strokeWidth="1.5"/><path d="M21 21l-4.3-4.3" strokeWidth="1.5" strokeLinecap="round"/></svg>
  </IconWrapper>
);
const ClockIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="1.5"/><path d="M12 7v5l3 2" strokeWidth="1.5" strokeLinecap="round"/></svg>
  </IconWrapper>
);
const RulerIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M3 21l18-18" strokeWidth="1.5"/><path d="M8 3v5" strokeWidth="1.5"/><path d="M3 8v5" strokeWidth="1.5"/></svg>
  </IconWrapper>
);
const PanoramaIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.5"/><path d="M3 10h18" strokeWidth="1.2"/></svg>
  </IconWrapper>
);
const TargetIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="1.2"/><circle cx="12" cy="12" r="4" strokeWidth="1.5"/></svg>
  </IconWrapper>
);
const FolderIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M3 7h4l2 3h10v9a2 2 0 0 1-2 2H3z" strokeWidth="1.5"/></svg>
  </IconWrapper>
);
const ExitIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeWidth="1.5"/><path d="M16 17l5-5-5-5" strokeWidth="1.5"/><path d="M21 12H9" strokeWidth="1.5"/></svg>
  </IconWrapper>
);
const MapIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path d="M3 6l7-3 7 3 7-3v13l-7 3-7-3-7 3V6z" strokeWidth="1.2"/></svg>
  </IconWrapper>
);
const PayloadIcon = () => (
  <IconWrapper>
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.2"/><path d="M8 7v-2" strokeWidth="1.2"/></svg>
  </IconWrapper>
);

const defaultIcons = {
  takePhoto: CameraIcon,
  startRecording: VideoIcon,
  stopRecording: SquareIcon,
  gimbalPitch: GimbalIcon,
  gimbalYaw: RotateIcon,
  cameraZoom: ZoomIcon,
  timedInterval: ClockIcon,
  distanceInterval: RulerIcon,
  panorama: PanoramaIcon,
  fixedAngle: TargetIcon,
  createFolder: FolderIcon,
  exit: ExitIcon,
  followRoute: MapIcon,
  aircraftRotate: RotateIcon,
  payload: PayloadIcon,
  route: MapIcon,
  manual: TargetIcon,
  lock: TargetIcon,
  straight_stop: MapIcon,
  coordinated_turn: RotateIcon,
  curved_stop: MapIcon,
  curved_continue: MapIcon,
  targetIcon: TargetIcon,
  clockIcon: ClockIcon,
};

/* ---------- Component ---------- */
export default function WaypointParamsPanel({ params = {}, routeParams = {}, onChange = () => {}, actionIcons = {} }) {
  const [actions, setActions] = useState(params.actions || []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const minSpeed = mphToMs(2.3);
  const maxSpeed = mphToMs(33.5);
  const defaultSpeed = mphToMs(11.2);
  const defaultAlt = ftToM(328.1);
  const altStep = ftToM(10);

  useEffect(() => {
    setActions(params.actions || []);
  }, [params.actions]);

  const updateActions = (next) => {
    setActions(next);
    onChange({ ...params, actions: next });
  };

  const mergedIcons = useMemo(() => ({ ...defaultIcons, ...actionIcons }), [actionIcons]);

  const IconFor = ({ iconKey }) => {
    const Comp = mergedIcons[iconKey];
    return Comp ? <Comp /> : <span className="w-6 h-6 inline-block" />;
  };

  const addAction = (type) => {
    const config = ACTION_CONFIG[type];
    const defaultParams = {};
    if (config.parameters) {
      config.parameters.forEach(p => {
        // Parse select values (remove prefixes like "0 - Wide")
        let value = p.defaultValue;
        if (p.type === "select" && typeof value === "string" && value.includes(" - ")) {
          value = value.split(" - ")[0];
        }
        // Initialize checkbox-group with default values
        if (p.type === "checkbox-group" && p.options) {
          value = {};
          p.options.forEach(opt => {
            value[opt.key] = opt.defaultValue;
          });
        }
        defaultParams[p.name] = value;
      });
    }
    const next = [...actions, { id: Date.now(), type, parameters: defaultParams, expanded: true }];
    updateActions(next);
    setMenuOpen(false);
    setSearchTerm("");
  };

  const removeAction = (id) => updateActions(actions.filter(a => a.id !== id));

  const updateActionParameters = (actionId, newParameters) => {
    const next = actions.map(a => (a.id === actionId ? { ...a, parameters: { ...a.parameters, ...newParameters } } : a));
    updateActions(next);
  };

  const toggleActionExpanded = (actionId) => {
    const next = actions.map(a => (a.id === actionId ? { ...a, expanded: !a.expanded } : a));
    updateActions(next);
  };

  const toggleFollowRoute = (key) => {
    const followKey = `followRoute${key}`;
    const nextFollow = !params[followKey];
    let nextParams = { ...params, [followKey]: nextFollow };
    if (nextFollow) {
      const routeKey = key.toLowerCase();
      nextParams[routeKey] = routeParams[routeKey];
    }
    onChange(nextParams);
  };

  const getValue = (key, defaultValue) => {
    const followKey = `followRoute${key}`;
    const valueKey = key.toLowerCase();
    return params[followKey] ? routeParams[valueKey] ?? defaultValue : params[valueKey] ?? defaultValue;
  };

  const handleChange = (key, value) => {
    const followKey = `followRoute${key}`;
    if (!params[followKey]) onChange({ ...params, [key.toLowerCase()]: value });
  };

  const renderParameterInput = (param, action) => {
    const value = action.parameters?.[param.name] ?? param.defaultValue;
    
    switch (param.type) {
      case "range":
        return (
          <div>
            <input 
              type="range" 
              min={param.min} 
              max={param.max} 
              step={param.step || 1} 
              value={value} 
              onChange={(e) => updateActionParameters(action.id, { [param.name]: Number(e.target.value) })} 
              className="w-full accent-blue-500" 
            />
            <div className="text-center text-sm text-gray-400 mt-1">
              {value}{['pitch','yaw','rotation','roll','angle','ev','exposureCompensation'].includes(param.name) ? '°' : param.name === 'factor' || param.name === 'zoom' ? 'X' : param.name === 'interval' ? 's' : ''}
            </div>
          </div>
        );
      case "number":
        return (
          <input 
            type="number" 
            min={param.min} 
            max={param.max} 
            value={value} 
            onChange={(e) => updateActionParameters(action.id, { [param.name]: Number(e.target.value) })} 
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none" 
          />
        );
      case "select":
        return (
          <select 
            value={value} 
            onChange={(e) => {
              let newValue = e.target.value;
              if (newValue.includes(" - ")) {
                newValue = newValue.split(" - ")[0];
              }
              updateActionParameters(action.id, { [param.name]: newValue });
            }} 
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case "checkbox-group":
        const checkboxValues = value || {};
        return (
          <div className="flex flex-wrap gap-2 items-center">
            {param.options.map(opt => (
              <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={checkboxValues[opt.key] ?? opt.defaultValue}
                  onChange={(e) => {
                    const newValues = { ...checkboxValues, [opt.key]: e.target.checked };
                    updateActionParameters(action.id, { [param.name]: newValues });
                  }}
                  className="rounded accent-blue-500" 
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        );
      case "text":
        return (
          <input 
            type="text" 
            value={value} 
            onChange={(e) => updateActionParameters(action.id, { [param.name]: e.target.value })} 
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono" 
            placeholder={param.placeholder} 
          />
        );
      default:
        return null;
    }
  };

  const filteredActions = AVAILABLE_ACTIONS.filter(a => a.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-[480px] max-w-full shadow-lg space-y-6 overflow-y-auto max-h-[95vh]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{params.name ? `Waypoint — ${params.name}` : 'Waypoint Settings'}</h2>
      </div>

      {/* Speed */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-semibold">Speed (m/s)</label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={params.followRouteSpeed || false} onChange={() => toggleFollowRoute('Speed')} className="rounded" />
            <span className="text-gray-400">Follow Route</span>
          </label>
        </div>
        <input type="range" min={minSpeed.toFixed(1)} max={maxSpeed.toFixed(1)} step={0.1} value={getValue('Speed', defaultSpeed)} disabled={params.followRouteSpeed} onChange={(e) => handleChange('Speed', Number(e.target.value))} className="w-full accent-blue-500" />
        <div className="text-center mt-1 text-sm">{getValue('Speed', defaultSpeed).toFixed(1)} m/s</div>
      </div>

      {/* Altitude */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-semibold">Relative Altitude (m)</label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={params.followRouteRelativeAltitude || false} onChange={() => toggleFollowRoute('RelativeAltitude')} className="rounded" />
            <span className="text-gray-400">Follow Route</span>
          </label>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <button disabled={params.followRouteRelativeAltitude} onClick={() => handleChange('RelativeAltitude', Math.max(-1500, getValue('RelativeAltitude', defaultAlt) - altStep))} className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">-{altStep.toFixed(1)}</button>
          <input className="w-24 bg-transparent border border-gray-700 rounded px-2 py-1 text-white text-center" value={getValue('RelativeAltitude', defaultAlt).toFixed(1)} readOnly />
          <button disabled={params.followRouteRelativeAltitude} onClick={() => handleChange('RelativeAltitude', Math.min(1500, getValue('RelativeAltitude', defaultAlt) + altStep))} className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50">+{altStep.toFixed(1)}</button>
        </div>
      </div>

      {/* Aircraft Yaw */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-semibold">Aircraft Yaw</label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={params.followRouteAircraftYaw || false} onChange={() => toggleFollowRoute('AircraftYaw')} className="rounded" />
            <span className="text-gray-400">Follow Route</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-gray-800 px-3 py-2 rounded border border-gray-700">
            <IconFor iconKey={aircraftYawModes.find(m => m.value === getValue('AircraftYaw', aircraftYawModes[0].value))?.iconKey} />
            <span className="text-sm">{aircraftYawModes.find(m => m.value === getValue('AircraftYaw', aircraftYawModes[0].value))?.label}</span>
          </div>
          <select className="flex-1 p-2 rounded bg-gray-800 text-white border border-gray-700" value={getValue('AircraftYaw', aircraftYawModes[0].value)} disabled={params.followRouteAircraftYaw} onChange={(e) => handleChange('AircraftYaw', e.target.value)}>
            {aircraftYawModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="font-semibold mb-2 block">Aircraft Rotation</label>
        <select className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700" value={params.aircraftRotation || 'auto'} onChange={(e) => onChange({ ...params, aircraftRotation: e.target.value })}>
          {aircraftRotationModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Waypoint Type */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-semibold">Waypoint Type</label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={params.followRouteWaypointType || false} onChange={() => toggleFollowRoute('WaypointType')} className="rounded" />
            <span className="text-gray-400">Follow Route</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-gray-800 px-3 py-2 rounded border border-gray-700">
            <IconFor iconKey={waypointTypes.find(w => w.value === getValue('WaypointType', waypointTypes[0].value))?.iconKey} />
            <span className="text-sm">{waypointTypes.find(w => w.value === getValue('WaypointType', waypointTypes[0].value))?.label}</span>
          </div>
          <select className="flex-1 p-2 rounded bg-gray-800 text-white border border-gray-700" value={getValue('WaypointType', waypointTypes[0].value)} disabled={params.followRouteWaypointType} onChange={(e) => handleChange('WaypointType', e.target.value)}>
            {waypointTypes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Gimbal Pitch */}
      <div>
        <label className="font-semibold mb-2 block">Gimbal Pitch (°)</label>
        <input type="range" min={gimbalPitchRange.min} max={gimbalPitchRange.max} step={1} value={params.gimbalPitch ?? 0} onChange={(e) => onChange({ ...params, gimbalPitch: Number(e.target.value) })} className="w-full accent-blue-500" />
        <div className="text-center mt-1">{params.gimbalPitch ?? 0}°</div>
      </div>

      {/* Actions */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-semibold">Actions ({actions.length})</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition-colors">
              <span className="text-lg font-bold">+</span>
              <span>{menuOpen ? 'Close' : 'Add Action'}</span>
            </button>
            <button onClick={() => updateActions([])} title="Clear all actions" className="bg-gray-800 hover:bg-gray-700 px-2 py-1.5 rounded text-sm transition-colors">Clear</button>
          </div>
        </div>

        <div className="space-y-2 mb-2">
          {actions.length === 0 && <div className="border border-dashed border-gray-700 rounded px-2 py-8 text-sm text-gray-400 text-center">No Actions Added<br/><span className="text-xs">Click "Add Action" to configure waypoint actions</span></div>}

          {actions.map(action => (
            <div key={action.id} className="bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => toggleActionExpanded(action.id)}>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-900 p-2 rounded">
                    <IconFor iconKey={ACTION_CONFIG[action.type]?.iconKey} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{action.type}</div>
                    <div className="text-xs text-gray-400">
                      {ACTION_CONFIG[action.type]?.parameters?.length || 0} parameters
                      {Object.keys(action.parameters || {}).length > 0 && ` • ${Object.keys(action.parameters).length} configured`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); removeAction(action.id); }} className="p-1.5 rounded hover:bg-gray-700 text-red-400 hover:text-red-300 transition-colors text-sm">Remove</button>
                  <div className="text-gray-400 text-xs">{action.expanded ? '▲' : '▼'}</div>
                </div>
              </div>

              {action.expanded && ACTION_CONFIG[action.type]?.parameters && ACTION_CONFIG[action.type].parameters.length > 0 && (
                <div className="p-3 border-t border-gray-700 space-y-3 bg-gray-850">
                  {ACTION_CONFIG[action.type].parameters.map(param => (
                    <div key={param.name}>
                      <label className="text-sm text-gray-300 mb-1.5 block font-medium">{param.label}</label>
                      {renderParameterInput(param, action)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Action Menu */}
        {menuOpen && (
          <div className="bg-gray-800 rounded border border-gray-700 p-3 max-h-[280px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search actions..." 
                className="flex-1 p-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" 
              />
              <button onClick={() => setSearchTerm('')} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors text-sm">Clear</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filteredActions.length === 0 && (
                <div className="col-span-2 text-center text-gray-400 py-4 text-sm">No actions found</div>
              )}
              {filteredActions.map(action => (
                <button 
                  key={action} 
                  onClick={() => addAction(action)} 
                  className="flex items-center gap-2 text-left px-3 py-2.5 hover:bg-gray-700 rounded transition-colors group"
                >
                  <div className="w-7 text-blue-400 group-hover:text-blue-300">
                    <IconFor iconKey={ACTION_CONFIG[action].iconKey} />
                  </div>
                  <div className="text-sm flex-1">{action}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coordinates & Summary */}
      <div className="pt-4 border-t border-gray-700">
        <label className="font-semibold block mb-2">Coordinates</label>
        <div className="space-y-2">
          <div>
            <label className="text-sm text-gray-400">Longitude</label>
            <input className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700" value={params.lng != null ? Number(params.lng).toFixed(6) : ''} readOnly />
          </div>
          <div>
            <label className="text-sm text-gray-400">Latitude</label>
            <input className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700" value={params.lat != null ? Number(params.lat).toFixed(6) : ''} readOnly />
          </div>
        </div>

        <div className="pt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Actions Count</div>
            <div className="font-semibold text-blue-400">{actions.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Photos Configured</div>
            <div className="font-semibold text-green-400">{actions.filter(a => a.type === 'Take Photo' || a.type === 'Timed Interval Shot' || a.type === 'Burst Photo').length}</div>
          </div>
          <div>
            <div className="text-gray-400">Gimbal Actions</div>
            <div className="font-semibold">{actions.filter(a => a.type.includes('Gimbal')).length}</div>
          </div>
          <div>
            <div className="text-gray-400">Recording Actions</div>
            <div className="font-semibold">{actions.filter(a => a.type.includes('Recording')).length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}