import React from "react";

// Helper for increment/decrement controls
function NumberInput({ value, onChange, step = 1, min, max, unit = "", ...props }) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
        onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}
      >-</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 px-2 py-1 rounded bg-gray-800 text-white border border-gray-700"
        {...props}
      />
      <button
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
        onClick={() => onChange(Math.min(max ?? Infinity, value + step))}
      >+</button>
      {unit && <span className="ml-2 text-xs text-gray-300">{unit}</span>}
    </div>
  );
}

export default function AreaRouteParamsPanel({ params, onChange }) {
  // Destructure params for easier access
  const {
    areaRouteName,
    aircraftModel,
    cameraModel,
    lens,
    collectionMode,
    orthoGSD,
    obliqueGSD,
    altitudeMode,
    routeAltitude,
    elevationOptimization,
    safeTakeoffAltitude,
    speed,
    courseAngle,
    uponCompletion,
    gimbalPitchOblique,
  } = params;

  // Handler for updating param fields
  const update = (field, value) => onChange({ ...params, [field]: value });

  return (
    <div className="flex flex-col gap-4">
      {/* Area Route Name */}
      <div>
        <label className="font-semibold text-gray-300">Area Route</label>
        <input
          type="text"
          value={areaRouteName}
          onChange={e => update("areaRouteName", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
        />
      </div>

      {/* Aircraft/Camera */}
      <div className="flex gap-2">
        <div>
          <label className="font-semibold text-gray-300">Aircraft</label>
          <select
            value={aircraftModel}
            onChange={e => update("aircraftModel", e.target.value)}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
          >
            <option value="M30 Series">M30 Series</option>
            {/* Add more options if needed */}
          </select>
        </div>
        <div>
          <label className="font-semibold text-gray-300">Camera</label>
          <select
            value={cameraModel}
            onChange={e => update("cameraModel", e.target.value)}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
          >
            <option value="M30T">M30T</option>
            {/* Add more options */}
          </select>
        </div>
        {/* Lens selector */}
        <div>
          <label className="font-semibold text-gray-300">Lens</label>
          <select
            value={lens}
            onChange={e => update("lens", e.target.value)}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
          >
            <option value="WIDE">WIDE</option>
            <option value="WIDE+IR">WIDE+IR</option>
          </select>
        </div>
      </div>

      {/* Collection Mode Tabs */}
      <div className="flex gap-2">
        <button
          className={`flex-1 px-3 py-1 rounded ${collectionMode === "Ortho" ? "bg-blue-600" : "bg-gray-700"}`}
          onClick={() => update("collectionMode", "Ortho")}
        >Ortho Collection</button>
        <button
          className={`flex-1 px-3 py-1 rounded ${collectionMode === "Oblique" ? "bg-blue-600" : "bg-gray-700"}`}
          onClick={() => update("collectionMode", "Oblique")}
        >Oblique Collection</button>
      </div>

      {/* Ortho GSD (and Oblique if Oblique tab active) */}
      <div>
        <label className="font-semibold text-gray-300">Ortho GSD</label>
        <NumberInput value={orthoGSD} onChange={v => update("orthoGSD", v)} step={0.1} min={0} unit="cm/pixel" />
        {collectionMode === "Oblique" && (
          <>
            <label className="font-semibold text-gray-300 mt-2">Oblique GSD</label>
            <NumberInput value={obliqueGSD} onChange={v => update("obliqueGSD", v)} step={0.1} min={0} unit="cm/pixel" />
            <label className="font-semibold text-gray-300 mt-2">Gimbal Pitch (Oblique)</label>
            <NumberInput value={gimbalPitchOblique} onChange={v => update("gimbalPitchOblique", v)} step={1} min={-85} max={40} unit="°" />
          </>
        )}
      </div>

      {/* Altitude Mode */}
      <div>
        <label className="font-semibold text-gray-300">Altitude Mode</label>
        <select
          value={altitudeMode}
          onChange={e => update("altitudeMode", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
        >
          <option value="relative">Relative to Takeoff Point (ALT)</option>
          <option value="absolute">Absolute Altitude</option>
        </select>
      </div>

      {/* Route Altitude */}
      <div>
        <label className="font-semibold text-gray-300">Route Altitude</label>
        <NumberInput value={routeAltitude} onChange={v => update("routeAltitude", v)} step={1} min={39} max={4921} unit="ft" />
      </div>

      {/* Elevation Optimization */}
      <div className="flex items-center gap-2">
        <label className="font-semibold text-gray-300">Elevation Optimization</label>
        <input
          type="checkbox"
          checked={!!elevationOptimization}
          onChange={e => update("elevationOptimization", e.target.checked)}
          className="ml-2 accent-blue-600"
        />
      </div>

      {/* Safe Takeoff Altitude */}
      <div>
        <label className="font-semibold text-gray-300">Safe Takeoff Altitude</label>
        <NumberInput value={safeTakeoffAltitude} onChange={v => update("safeTakeoffAltitude", v)} step={1} min={7} max={4921} unit="ft" />
      </div>

      {/* Speed & Course Angle */}
      <div className="flex gap-2">
        <div>
          <label className="font-semibold text-gray-300">Speed</label>
          <NumberInput value={speed} onChange={v => update("speed", v)} step={0.1} min={0.3} max={5.7} unit="mph" />
        </div>
        <div>
          <label className="font-semibold text-gray-300">Course Angle</label>
          <NumberInput value={courseAngle} onChange={v => update("courseAngle", v)} step={1} min={0} max={359} unit="°" />
        </div>
      </div>

      {/* Upon Completion */}
      <div>
        <label className="font-semibold text-gray-300">Upon Completion</label>
        <select
          value={uponCompletion}
          onChange={e => update("uponCompletion", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
        >
          <option value="Return To Home">Return To Home</option>
          <option value="Hover">Hover</option>
          {/* Add more options as needed */}
        </select>
      </div>

      {/* Advanced Settings */}
      <details className="mt-2">
        <summary className="font-semibold text-gray-400 cursor-pointer">Advanced Settings</summary>
        {/* Add any advanced fields here */}
      </details>
    </div>
  );
}