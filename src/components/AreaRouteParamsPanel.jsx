import React, { useState, useMemo, useCallback } from "react";

// ========== CAMERA SPECIFICATIONS ==========
const CAMERA_SPECS = {
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

// ========== GSD CALCULATION ==========
function calculateGSDForDJI(altitudeMetersAGL, cameraModel, options = {}) {
  let specs = CAMERA_SPECS[cameraModel] || CAMERA_SPECS.M30T;
  
  // Handle dual camera setup (M30T Wide+IR)
  if (cameraModel === "M30T Wide+IR") {
    specs = CAMERA_SPECS["M30T Wide+IR"].wide;
  }
  
  const { sensorWidth: sensorWidth_mm, focalLength: baseFocal_mm, imageWidth: nativeImageWidth_px } = specs;
  
  // Zoom factor (for cameras with zoom capability)
  const zoom = Number(options.zoomFactor ?? 1);
  const imageWidth_px = Number(options.imageWidthOverride ?? nativeImageWidth_px);
  const focalEffective_mm = baseFocal_mm * Math.max(1, zoom);
  
  // Calculate slant distance for oblique imagery
  let H = Number(altitudeMetersAGL);
  if (options.useSlantDistance && typeof options.gimbalPitchDeg === "number") {
    const pitchRad = (Math.abs(options.gimbalPitchDeg) * Math.PI) / 180;
    const cosP = Math.cos(pitchRad) || 1;
    H = H / Math.max(1e-6, cosP);
  }
  
  // GSD = (H * pixel_pitch) / focal_length
  const pixelPitch_mm = sensorWidth_mm / imageWidth_px;
  const gsd_m = (H * pixelPitch_mm) / focalEffective_mm;
  const gsd_cm = gsd_m * 100;
  
  return Number(gsd_cm.toFixed(2));
}

// ========== REUSABLE INPUT COMPONENTS ==========
function NumberInput({ value = 0, onChange, step = 1, min, max, ...props }) {
  const safeNumber = useCallback((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }, []);

  const handleDecrease = useCallback(() => {
    const curr = safeNumber(value);
    const m = min ?? -Infinity;
    onChange(Math.max(m, curr - step));
  }, [value, min, step, onChange, safeNumber]);

  const handleIncrease = useCallback(() => {
    const curr = safeNumber(value);
    const M = max ?? Infinity;
    onChange(Math.min(M, curr + step));
  }, [value, max, step, onChange, safeNumber]);

  const handleInputChange = useCallback((e) => {
    const newVal = Number(e.target.value);
    onChange(Number.isFinite(newVal) ? newVal : 0);
  }, [onChange]);

  return (
    <div className="flex items-center gap-1">
      <button
        className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-gray-200 font-medium"
        type="button"
        onClick={handleDecrease}
        aria-label={`Decrease by ${step}`}
      >
        -
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={handleInputChange}
        className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition text-center"
        {...props}
      />
      <button
        className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-gray-200 font-medium"
        type="button"
        onClick={handleIncrease}
        aria-label={`Increase by ${step}`}
      >
        +
      </button>
    </div>
  );
}

function SelectInput({ value, onChange, options, className = "", ...props }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2.5 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition ${className}`}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({ value, onChange, className = "", ...props }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2.5 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition ${className}`}
      {...props}
    />
  );
}

// ========== OPTION CONSTANTS ==========
const AIRCRAFT_OPTIONS = [
  { value: "M30 Series", label: "M30 Series" },
  { value: "Matrice 300 RTK", label: "Matrice 300 RTK" },
  { value: "Phantom 4 RTK", label: "Phantom 4 RTK" },
  { value: "Mavic 3 Enterprise", label: "Mavic 3 Enterprise" }
];

const CAMERA_OPTIONS = [
  { value: "M30T", label: "M30T Wide" },
  { value: "M30T_Thermal", label: "M30T IR (Thermal)" },
  { value: "M30T Wide+IR", label: "M30T Wide+IR" },
  { value: "H20T", label: "H20T" },
  { value: "P4RTK Camera", label: "P4RTK Camera" },
  { value: "Mavic 3E Camera", label: "Mavic 3E Camera" }
];

const LENS_OPTIONS = [
  { value: "WIDE", label: "WIDE" },
  { value: "WIDE+IR", label: "WIDE+IR" },
  { value: "ZOOM", label: "ZOOM" },
  { value: "IR", label: "IR" }
];

const COMPLETION_OPTIONS = [
  { value: "Return To Home", label: "Return To Home" },
  { value: "Exit Route Mode", label: "Exit Route Mode" },
  { value: "Land", label: "Land" },
  { value: "Return to start point and hover", label: "Return to Start Point and Hover" }
];

const ALTITUDE_MODE_OPTIONS = [
  { value: "relative", label: "Relative to Takeoff Point (ALT)" },
  { value: "absolute", label: "Absolute Altitude" }
];

const PHOTO_MODE_OPTIONS = [
  { value: "Timed Interval Shot", label: "Timed Interval Shot" },
  { value: "Distance Interval Shot", label: "Distance Interval Shot" }
];

// ========== DEFAULT PARAMETERS ==========
const DEFAULT_PARAMS = {
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
  // ADDED: Flight line spacing parameters
  flightLineSpacing: 20,
  photoInterval: 10,
};

// ========== SECTION COMPONENT ==========
const Section = React.memo(({ title, children, className = "" }) => {
  return (
    <div className={`bg-gray-800/50 rounded-xl p-4 ${className}`}>
      <h4 className="font-semibold text-gray-200 mb-3 text-sm uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
});

Section.displayName = 'Section';

// ========== LABEL WITH UNIT ==========
const LabelWithUnit = React.memo(({ children, unit }) => {
  return (
    <div className="flex items-center gap-1 mb-2">
      <span className="text-gray-300 font-medium">{children}</span>
      {unit && <span className="text-sm text-gray-400">({unit})</span>}
    </div>
  );
});

LabelWithUnit.displayName = 'LabelWithUnit';

// ========== GSD DISPLAY COMPONENT ==========
const GSDDisplay = React.memo(({ gsd, footprint, type = "Ortho" }) => {
  const getQualityLevel = useCallback((gsd) => {
    if (gsd < 1) return { label: "Survey Grade", color: "text-green-400", bg: "bg-green-900/20" };
    if (gsd < 3) return { label: "Engineering", color: "text-blue-400", bg: "bg-blue-900/20" };
    if (gsd < 5) return { label: "Mapping", color: "text-yellow-400", bg: "bg-yellow-900/20" };
    return { label: "Reconnaissance", color: "text-orange-400", bg: "bg-orange-900/20" };
  }, []);

  const quality = useMemo(() => getQualityLevel(gsd), [gsd, getQualityLevel]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border ${quality.bg} border-gray-600`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 font-medium">{type} GSD</span>
            <span className={`text-sm font-semibold ${quality.color}`}>
              {quality.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white text-center">
            {gsd.toFixed(2)} <span className="text-sm text-gray-400">cm/px</span>
          </div>
        </div>
        
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
          <div className="text-gray-300 font-medium mb-2">Image Footprint</div>
          <div className="text-lg font-semibold text-white text-center">
            {footprint.width} × {footprint.height} <span className="text-sm text-gray-400">m</span>
          </div>
          <div className="text-xs text-gray-400 text-center mt-1">
            Ground coverage per photo
          </div>
        </div>
      </div>
      
      {/* Professional GSD Reference */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="text-center p-2 bg-green-900/20 rounded border border-green-800">
          <div className="font-semibold text-green-400">{"<1 cm"}</div>
          <div className="text-gray-300">Survey Grade</div>
        </div>
        <div className="text-center p-2 bg-blue-900/20 rounded border border-blue-800">
          <div className="font-semibold text-blue-400">1-3 cm</div>
          <div className="text-gray-300">Engineering</div>
        </div>
        <div className="text-center p-2 bg-yellow-900/20 rounded border border-yellow-800">
          <div className="font-semibold text-yellow-400">3-5 cm</div>
          <div className="text-gray-300">Mapping</div>
        </div>
        <div className="text-center p-2 bg-orange-900/20 rounded border border-orange-800">
          <div className="font-semibold text-orange-400">{">5 cm"}</div>
          <div className="text-gray-300">Reconnaissance</div>
        </div>
      </div>
    </div>
  );
});

GSDDisplay.displayName = 'GSDDisplay';

// ========== MAIN PANEL COMPONENT ==========
export default function AreaRouteParamsPanel({ params = {}, onChange = () => {} }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // IMPROVED: Memoize merged params to prevent unnecessary recalculations
  const merged = useMemo(() => {
    return { ...DEFAULT_PARAMS, ...params };
  }, [params]);
  
  // IMPROVED: Memoized update function
  const update = useCallback((key, val) => {
    onChange({ ...merged, [key]: val });
  }, [merged, onChange]);

  // IMPROVED: Toggle advanced settings
  const toggleAdvanced = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  // REAL-TIME GSD CALCULATION with error handling
  const { calculatedGSD, footprint, calculationError } = useMemo(() => {
    try {
      const gsd = calculateGSDForDJI(merged.routeAltitude, merged.cameraModel, {
        useSlantDistance: merged.collectionMode === "Oblique",
        gimbalPitchDeg: merged.gimbalPitchOblique
      });
      
      let specs = CAMERA_SPECS[merged.cameraModel] || CAMERA_SPECS.M30T;
      
      // Handle dual camera setup
      if (merged.cameraModel === "M30T Wide+IR") {
        specs = CAMERA_SPECS["M30T Wide+IR"].wide;
      }
      
      const gsd_m = gsd / 100; // Convert to meters
      
      return {
        calculatedGSD: gsd,
        footprint: {
          width: (specs.imageWidth * gsd_m).toFixed(1),
          height: (specs.imageHeight * gsd_m).toFixed(1)
        },
        calculationError: null
      };
    } catch (error) {
      console.error("GSD calculation error:", error);
      return {
        calculatedGSD: 0,
        footprint: { width: "N/A", height: "N/A" },
        calculationError: error.message
      };
    }
  }, [merged.routeAltitude, merged.cameraModel, merged.collectionMode, merged.gimbalPitchOblique]);

  // IMPROVED: Calculate recommended flight line spacing based on GSD and overlap
  const recommendedSpacing = useMemo(() => {
    const gsd_m = calculatedGSD / 100;
    let specs = CAMERA_SPECS[merged.cameraModel] || CAMERA_SPECS.M30T;
    if (merged.cameraModel === "M30T Wide+IR") {
      specs = CAMERA_SPECS["M30T Wide+IR"].wide;
    }
    
    const imageHeightMeters = specs.imageHeight * gsd_m;
    const overlapFraction = merged.sideOverlap / 100;
    const spacing = imageHeightMeters * (1 - overlapFraction);
    
    return Math.max(1, Math.round(spacing));
  }, [calculatedGSD, merged.cameraModel, merged.sideOverlap]);

  // IMPROVED: Calculate photo interval based on GSD and front overlap
  const recommendedPhotoInterval = useMemo(() => {
    const gsd_m = calculatedGSD / 100;
    let specs = CAMERA_SPECS[merged.cameraModel] || CAMERA_SPECS.M30T;
    if (merged.cameraModel === "M30T Wide+IR") {
      specs = CAMERA_SPECS["M30T Wide+IR"].wide;
    }
    
    const imageWidthMeters = specs.imageWidth * gsd_m;
    const overlapFraction = merged.frontOverlap / 100;
    const interval = imageWidthMeters * (1 - overlapFraction);
    
    return Math.max(1, Math.round(interval));
  }, [calculatedGSD, merged.cameraModel, merged.frontOverlap]);

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      {/* Header */}
      <div className="text-center border-b border-gray-700 pb-4">
        <h2 className="font-bold text-blue-400 text-xl mb-1">
          📐 Professional Area Route Configuration
        </h2>
        <p className="text-sm text-gray-400">
          Real-time GSD calculation based on camera specs and altitude
        </p>
      </div>

      {/* Route Name */}
      <Section title="🏷️ Route Information">
        <div>
          <LabelWithUnit>Area Route Name</LabelWithUnit>
          <TextInput
            value={merged.areaRouteName}
            onChange={e => update("areaRouteName", e.target.value)}
            placeholder="Enter route name (e.g., Survey Site A)"
            aria-label="Area Route Name"
          />
          <div className="text-xs text-gray-400 mt-1">
            Used for file naming and mission identification
          </div>
        </div>
      </Section>

      {/* Equipment */}
      <Section title="🛸 Equipment Configuration">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <LabelWithUnit>Aircraft</LabelWithUnit>
            <SelectInput
              value={merged.aircraftModel}
              onChange={e => update("aircraftModel", e.target.value)}
              options={AIRCRAFT_OPTIONS}
              aria-label="Select aircraft model"
            />
          </div>
          <div>
            <LabelWithUnit>Camera</LabelWithUnit>
            <SelectInput
              value={merged.cameraModel}
              onChange={e => update("cameraModel", e.target.value)}
              options={CAMERA_OPTIONS}
              aria-label="Select camera model"
            />
          </div>
          <div>
            <LabelWithUnit>Lens</LabelWithUnit>
            <SelectInput
              value={merged.lens}
              onChange={e => update("lens", e.target.value)}
              options={LENS_OPTIONS}
              aria-label="Select lens type"
            />
          </div>
        </div>
      </Section>

      {/* Real-time GSD Display */}
      <Section title="📊 Image Quality Analysis">
        {calculationError ? (
          <div className="bg-red-900/20 border border-red-600 p-4 rounded-lg">
            <div className="text-red-400 font-semibold mb-1">⚠️ Calculation Error</div>
            <div className="text-sm text-red-300">{calculationError}</div>
          </div>
        ) : (
          <GSDDisplay 
            gsd={calculatedGSD} 
            footprint={footprint}
            type={merged.collectionMode} 
          />
        )}
      </Section>

      {/* Collection Mode with Altitude Control */}
      <Section title="📷 Collection Settings">
        <div className="space-y-4">
          <div>
            <LabelWithUnit>Collection Mode</LabelWithUnit>
            <div className="grid grid-cols-2 gap-3">
              {["Ortho", "Oblique"].map(mode => (
                <button
                  key={mode}
                  onClick={() => update("collectionMode", mode)}
                  type="button"
                  className={`px-4 py-3 rounded-lg transition-all ${
                    merged.collectionMode === mode
                      ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                      : "bg-gray-700 hover:bg-gray-600"
                  } font-medium`}
                  aria-pressed={merged.collectionMode === mode}
                >
                  {mode === "Ortho" ? "⬇️ " : "📐 "}
                  {mode}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {merged.collectionMode === "Ortho" 
                ? "Nadir (straight down) imagery for mapping and orthomosaics"
                : "Angled imagery for 3D models and oblique views"}
            </div>
          </div>

          {/* Altitude Control with GSD Feedback */}
          <div className="space-y-3">
            <LabelWithUnit unit="m">Flight Altitude (AGL)</LabelWithUnit>
            <NumberInput 
              value={merged.routeAltitude} 
              onChange={v => update("routeAltitude", v)} 
              step={1} 
              min={12} 
              max={1500}
              aria-label="Flight altitude"
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                Current GSD: <strong className="text-blue-400">{calculatedGSD.toFixed(2)} cm/px</strong>
              </span>
              <span className={`font-semibold ${
                calculatedGSD < 1 ? "text-green-400" :
                calculatedGSD < 3 ? "text-blue-400" :
                calculatedGSD < 5 ? "text-yellow-400" : "text-orange-400"
              }`}>
                {calculatedGSD < 1 ? "Survey Grade" :
                 calculatedGSD < 3 ? "Engineering" :
                 calculatedGSD < 5 ? "Mapping" : "Reconnaissance"}
              </span>
            </div>
          </div>

          {/* Gimbal Pitch for Oblique */}
          {merged.collectionMode === "Oblique" && (
            <div>
              <LabelWithUnit unit="°">Gimbal Pitch (Oblique)</LabelWithUnit>
              <NumberInput 
                value={merged.gimbalPitchOblique} 
                onChange={v => update("gimbalPitchOblique", v)} 
                step={1} 
                min={-85} 
                max={40}
                aria-label="Gimbal pitch angle"
              />
              <div className="text-sm text-gray-400 mt-1">
                📐 Camera tilt affects slant distance and GSD calculation
              </div>
            </div>
          )}

          {/* ADDED: Flight Line Spacing */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <LabelWithUnit unit="m">Flight Line Spacing</LabelWithUnit>
              <button
                type="button"
                onClick={() => update("flightLineSpacing", recommendedSpacing)}
                className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition"
                title="Apply recommended spacing based on GSD and overlap"
              >
                Use Recommended ({recommendedSpacing}m)
              </button>
            </div>
            <NumberInput 
              value={merged.flightLineSpacing || 20} 
              onChange={v => update("flightLineSpacing", v)} 
              step={1} 
              min={1} 
              max={500}
              aria-label="Flight line spacing"
            />
            <div className="text-xs text-gray-400 mt-1">
              Distance between parallel flight lines (affects side overlap)
            </div>
          </div>

          {/* ADDED: Photo Interval */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <LabelWithUnit unit="m">Photo Interval</LabelWithUnit>
              <button
                type="button"
                onClick={() => update("photoInterval", recommendedPhotoInterval)}
                className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition"
                title="Apply recommended interval based on GSD and overlap"
              >
                Use Recommended ({recommendedPhotoInterval}m)
              </button>
            </div>
            <NumberInput 
              value={merged.photoInterval || 10} 
              onChange={v => update("photoInterval", v)} 
              step={1} 
              min={1} 
              max={200}
              aria-label="Photo interval"
            />
            <div className="text-xs text-gray-400 mt-1">
              Distance between consecutive photos (affects front overlap)
            </div>
          </div>
        </div>
      </Section>

      {/* Flight Parameters */}
      <Section title="✈️ Flight Parameters">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <LabelWithUnit>Altitude Mode</LabelWithUnit>
              <SelectInput
                value={merged.altitudeMode}
                onChange={e => update("altitudeMode", e.target.value)}
                options={ALTITUDE_MODE_OPTIONS}
                aria-label="Select altitude mode"
              />
            </div>
            <div>
              <LabelWithUnit unit="m">Safe Takeoff Altitude</LabelWithUnit>
              <NumberInput 
                value={merged.safeTakeoffAltitude} 
                onChange={v => update("safeTakeoffAltitude", v)} 
                step={1} 
                min={1} 
                max={500}
                aria-label="Safe takeoff altitude"
              />
            </div>
          </div>

          {/* Elevation Optimization */}
          <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
            <input
              type="checkbox"
              id="elevation-optimization"
              checked={merged.elevationOptimization}
              onChange={e => update("elevationOptimization", e.target.checked)}
              className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <label htmlFor="elevation-optimization" className="text-gray-300 font-medium cursor-pointer flex-1">
              🗻 Elevation Optimization (terrain following)
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <LabelWithUnit unit="m/s">Flight Speed</LabelWithUnit>
              <NumberInput 
                value={merged.speed} 
                onChange={v => update("speed", v)} 
                step={0.1} 
                min={1} 
                max={15}
                aria-label="Flight speed"
              />
              <div className="text-xs text-gray-400 mt-1">
                ⚡ Slower = better image quality & sharpness
              </div>
            </div>
            <div>
              <LabelWithUnit unit="°">Course Angle</LabelWithUnit>
              <NumberInput 
                value={merged.courseAngle} 
                onChange={v => update("courseAngle", v)} 
                step={1} 
                min={0} 
                max={359}
                aria-label="Course angle"
              />
              <div className="text-xs text-gray-400 mt-1">
                🧭 Flight direction relative to North
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Completion Settings */}
      <Section title="🏁 Completion Settings">
        <div>
          <LabelWithUnit>Upon Completion</LabelWithUnit>
          <SelectInput
            value={merged.uponCompletion}
            onChange={e => update("uponCompletion", e.target.value)}
            options={COMPLETION_OPTIONS}
            aria-label="Select action upon completion"
          />
          <div className="text-xs text-gray-400 mt-1">
            Action to perform when survey mission is complete
          </div>
        </div>
      </Section>

      {/* Advanced Settings */}
      <div className="border-t border-gray-700 pt-4">
        <button
          onClick={toggleAdvanced}
          className="w-full bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-lg flex justify-between items-center transition group"
          aria-expanded={showAdvanced}
          aria-controls="advanced-settings"
        >
          <span className="font-semibold text-gray-200">
            ⚙️ Advanced Survey Parameters
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${
              showAdvanced ? "rotate-180" : ""
            } group-hover:text-white`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div id="advanced-settings" className="mt-4 p-4 bg-gray-800/30 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LabelWithUnit unit="m">Target Surface Elevation</LabelWithUnit>
                <NumberInput 
                  value={merged.targetSurfaceToTakeoff} 
                  onChange={v => update("targetSurfaceToTakeoff", v)} 
                  step={1} 
                  min={-1000}
                  max={5000}
                  aria-label="Target surface elevation"
                />
                <div className="text-xs text-gray-400 mt-1">
                  📏 Elevation difference from takeoff point
                </div>
              </div>
              <div>
                <LabelWithUnit unit="%">Front Overlap</LabelWithUnit>
                <NumberInput 
                  value={merged.frontOverlap} 
                  onChange={v => update("frontOverlap", v)} 
                  step={1} 
                  min={60} 
                  max={95}
                  aria-label="Front overlap percentage"
                />
                <div className="text-xs text-gray-400 mt-1">
                  📸 Higher = better 3D reconstruction
                </div>
              </div>
              <div>
                <LabelWithUnit unit="%">Side Overlap</LabelWithUnit>
                <NumberInput 
                  value={merged.sideOverlap} 
                  onChange={v => update("sideOverlap", v)} 
                  step={1} 
                  min={60} 
                  max={95}
                  aria-label="Side overlap percentage"
                />
                <div className="text-xs text-gray-400 mt-1">
                  🔍 Higher = more complete coverage
                </div>
              </div>
              <div>
                <LabelWithUnit unit="m">Safety Margin</LabelWithUnit>
                <NumberInput 
                  value={merged.margin} 
                  onChange={v => update("margin", v)} 
                  step={1} 
                  min={0} 
                  max={100}
                  aria-label="Safety margin"
                />
                <div className="text-xs text-gray-400 mt-1">
                  🛡️ Buffer inside survey area boundary
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LabelWithUnit>Photo Capture Mode</LabelWithUnit>
                <SelectInput
                  value={merged.photoMode}
                  onChange={e => update("photoMode", e.target.value)}
                  options={PHOTO_MODE_OPTIONS}
                  aria-label="Select photo mode"
                />
                <div className="text-xs text-gray-400 mt-1">
                  {merged.photoMode === "Timed Interval Shot" 
                    ? "📅 Capture based on time intervals" 
                    : "📏 Capture based on distance traveled"}
                </div>
              </div>
              <div>
                <LabelWithUnit unit="m/s">Takeoff Speed</LabelWithUnit>
                <NumberInput 
                  value={merged.takeoffSpeed} 
                  onChange={v => update("takeoffSpeed", v)} 
                  step={0.1} 
                  min={1} 
                  max={8}
                  aria-label="Takeoff speed"
                />
                <div className="text-xs text-gray-400 mt-1">
                  🚁 Speed during takeoff and initial climb
                </div>
              </div>
            </div>

            {/* Coverage Statistics */}
            <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-lg mt-4">
              <div className="font-semibold text-blue-400 mb-3">📊 Coverage Statistics</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">Recommended Spacing:</div>
                  <div className="text-white font-mono">{recommendedSpacing}m</div>
                </div>
                <div>
                  <div className="text-gray-400">Recommended Interval:</div>
                  <div className="text-white font-mono">{recommendedPhotoInterval}m</div>
                </div>
                <div>
                  <div className="text-gray-400">Image Footprint:</div>
                  <div className="text-white font-mono">{footprint.width} × {footprint.height}m</div>
                </div>
                <div>
                  <div className="text-gray-400">GSD Quality:</div>
                  <div className={`font-mono ${
                    calculatedGSD < 1 ? "text-green-400" :
                    calculatedGSD < 3 ? "text-blue-400" :
                    calculatedGSD < 5 ? "text-yellow-400" : "text-orange-400"
                  }`}>
                    {calculatedGSD.toFixed(2)} cm/px
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Tips */}
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <div className="font-semibold text-gray-300 mb-2">💡 Professional Tips</div>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Survey Grade (&lt;1 cm): Best for engineering surveys, precise measurements</li>
                <li>• Engineering (1-3 cm): Ideal for construction site monitoring, volumetric analysis</li>
                <li>• Mapping (3-5 cm): Good for general mapping, orthomosaics, and GIS</li>
                <li>• Reconnaissance (&gt;5 cm): Quick area assessments, large area coverage</li>
                <li>• Higher overlap (80%+) improves 3D model quality but increases flight time</li>
                <li>• Lower flight speed reduces motion blur and improves image sharpness</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions Summary */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700 p-4 rounded-lg">
        <div className="font-semibold text-blue-400 mb-2">📋 Mission Summary</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400">Altitude:</span>
            <span className="text-white ml-2 font-mono">{merged.routeAltitude}m</span>
          </div>
          <div>
            <span className="text-gray-400">Speed:</span>
            <span className="text-white ml-2 font-mono">{merged.speed}m/s</span>
          </div>
          <div>
            <span className="text-gray-400">Camera:</span>
            <span className="text-white ml-2">{merged.cameraModel}</span>
          </div>
          <div>
            <span className="text-gray-400">Mode:</span>
            <span className="text-white ml-2">{merged.collectionMode}</span>
          </div>
          <div>
            <span className="text-gray-400">Front/Side:</span>
            <span className="text-white ml-2 font-mono">{merged.frontOverlap}%/{merged.sideOverlap}%</span>
          </div>
          <div>
            <span className="text-gray-400">GSD:</span>
            <span className={`ml-2 font-mono font-semibold ${
              calculatedGSD < 1 ? "text-green-400" :
              calculatedGSD < 3 ? "text-blue-400" :
              calculatedGSD < 5 ? "text-yellow-400" : "text-orange-400"
            }`}>
              {calculatedGSD.toFixed(2)} cm/px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== EXPORTS ==========
export { calculateGSDForDJI, CAMERA_SPECS };