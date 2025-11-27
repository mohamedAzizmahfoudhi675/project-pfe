import React, { useState } from "react";

function NumberInput({ value, onChange, step = 1, min, max, unit = "", ...props }) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
        type="button"
        disabled={min !== undefined && value - step < min}
        onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}
      >
        -
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 text-center"
        {...props}
      />
      <button
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
        type="button"
        disabled={max !== undefined && value + step > max}
        onClick={() => onChange(Math.min(max ?? Infinity, value + step))}
      >
        +
      </button>
      {unit && <span className="ml-2 text-xs text-gray-300">{unit}</span>}
    </div>
  );
}

export default function WaypointRouteParamsPanel({ params = {}, onChange }) {
  const [photoModes, setPhotoModes] = useState({
    wide: true,
    zoom: true,
    ir: true,
  });
  const [smartLowLight, setSmartLowLight] = useState(false);

  const toggleMode = (mode) =>
    setPhotoModes((prev) => ({ ...prev, [mode]: !prev[mode] }));

  const update = (field, value) => {
    onChange({ ...params, [field]: value });
  };

  const {
    waypointName = "",
    aircraft = "Matrice 30 T",
    altitudeMode = "relative",
    safeTakeoffAltitude = 20,
    climbToStartPoint = false,
    speed = 5,
    relativeAltitude = 100,
    aircraftYaw = "route",
    gimbalControl = "Manual",
    waypointType = "straight_stop",
    uponCompletion = "Return To Home",
    takeoffSpeed = 2.7,
    aircraftRotation = "auto",
    showWaypointNumber = true,
    showWaypointAltitude = true,
    showWaypointDistance = false,
    followRouteSpeed = false,
    followRouteRelativeAltitude = false,
    followRouteAircraftYaw = false,
    followRouteWaypointType = false,
    gimbalPitch = 0,
  } = params;

  return (
    <div className="flex flex-col gap-4">
      {/* Waypoint Name */}
      <div>
        <label className="font-semibold text-gray-300">Waypoint Name</label>
        <input
          type="text"
          value={waypointName}
          onChange={(e) => update("waypointName", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
          placeholder="Enter waypoint name"
        />
      </div>

      {/* Aircraft Selection */}
      <div>
        <label className="font-semibold text-gray-300">Select Aircraft</label>
        <select
          value={aircraft}
          onChange={(e) => update("aircraft", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
        >
          <option value="Matrice 300 RTK">Matrice 300 RTK</option>
          <option value="M30 Series">Matrice 30</option>
          <option value="Matrice 30 T">Matrice 30T</option>
          <option value="Phantom 4 RTK">Phantom 4 RTK</option>
          <option value="Mavic 3 Enterprise">Mavic 3 Enterprise</option>
        </select>
      </div>

      {/* Save Photo Section */}
      <div className="border-t border-gray-700 pt-3">
        <div className="text-sm font-semibold mb-2">Save Photo</div>
        <div className="flex gap-2">
          {["wide", "zoom", "ir"].map((mode) => (
            <button
              key={mode}
              onClick={() => toggleMode(mode)}
              className={`px-3 py-1.5 rounded-md border text-xs uppercase font-semibold transition ${
                photoModes[mode]
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Smart Low-Light */}
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <div className="text-sm font-semibold">Smart Low-Light</div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={smartLowLight}
            onChange={(e) => setSmartLowLight(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Altitude Mode */}
      <div>
        <label className="font-semibold text-gray-300">Altitude Mode</label>
        <select
          value={altitudeMode}
          onChange={(e) => update("altitudeMode", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 mt-1"
        >
          <option value="relative">Relative to Takeoff Point (m)</option>
          <option value="absolute">Absolute Altitude</option>
        </select>
      </div>

      {/* Route Controls */}
      <div className="mt-4 flex flex-col gap-3">
        {/* Safe Takeoff Altitude */}
        <div>
          <label className="font-semibold text-gray-300">Safe Takeoff Altitude (m)</label>
          <div className="flex gap-1 mt-1">
            <NumberInput
              value={safeTakeoffAltitude}
              onChange={(v) => update("safeTakeoffAltitude", v)}
              min={2}
              max={1500}
              step={1}
              unit="m"
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">(2–1500 m)</div>
        </div>

        {/* Climb to Start Point */}
        <div className="flex items-center gap-2">
          <label className="font-semibold text-gray-300">
            Climb to start point
          </label>
          <input
            type="checkbox"
            checked={!!climbToStartPoint}
            onChange={(e) => update("climbToStartPoint", e.target.checked)}
            className="accent-blue-600 w-4 h-4"
          />
        </div>

        {/* Speed */}
        <div>
          <label className="font-semibold text-gray-300">Speed (m/s)</label>
          <input
            type="range"
            min={1}
            max={15}
            step={0.1}
            value={speed}
            onChange={(e) => update("speed", Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-400">1</span>
            <span className="font-bold">{speed}</span>
            <span className="text-xs text-gray-400">15</span>
          </div>
          <label className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <input
              type="checkbox"
              checked={!!followRouteSpeed}
              onChange={(e) => update("followRouteSpeed", e.target.checked)}
              className="accent-blue-600"
            />
            Follow Route Speed
          </label>
        </div>

        {/* Relative Altitude */}
        <div>
          <label className="font-semibold text-gray-300">
            Relative Altitude (m)
          </label>
          <div className="flex gap-1 mt-1">
            <NumberInput
              value={relativeAltitude}
              onChange={(v) => update("relativeAltitude", v)}
              min={-1500}
              max={1500}
              step={1}
              unit="m"
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">(-1500 m – 1500 m)</div>
          <label className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <input
              type="checkbox"
              checked={!!followRouteRelativeAltitude}
              onChange={(e) =>
                update("followRouteRelativeAltitude", e.target.checked)
              }
              className="accent-blue-600"
            />
            Follow Route Altitude
          </label>
        </div>
      </div>

      {/* Aircraft Yaw */}
      <div>
        <label className="font-semibold text-gray-300">Aircraft Yaw</label>
        <select
          value={aircraftYaw}
          onChange={(e) => update("aircraftYaw", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 mt-1"
        >
          <option value="route">Along the Route</option>
          <option value="manual">Manual</option>
          <option value="lock">Lock Yaw Axis</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-400 mt-2">
          <input
            type="checkbox"
            checked={!!followRouteAircraftYaw}
            onChange={(e) => update("followRouteAircraftYaw", e.target.checked)}
            className="accent-blue-600"
          />
          Follow Route Yaw
        </label>
      </div>

      {/* Aircraft Rotation */}
      <div>
        <label className="font-semibold text-gray-300">Aircraft Rotation</label>
        <select
          value={aircraftRotation}
          onChange={(e) => update("aircraftRotation", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 mt-1"
        >
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Gimbal Control */}
      <div>
        <label className="font-semibold text-gray-300">Gimbal Control</label>
        <select
          value={gimbalControl}
          onChange={(e) => update("gimbalControl", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 mt-1"
        >
          <option value="Manual">Manual</option>
          <option value="Auto">Auto</option>
        </select>
      </div>

      {/* Gimbal Pitch */}
      <div>
        <label className="font-semibold text-gray-300">Gimbal Pitch (°)</label>
        <input
          type="range"
          min={-90}
          max={30}
          step={1}
          value={gimbalPitch}
          onChange={(e) => update("gimbalPitch", Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-400">-90</span>
          <span className="font-bold">{gimbalPitch}</span>
          <span className="text-xs text-gray-400">30</span>
        </div>
      </div>

      {/* Waypoint Type */}
      <div>
        <label className="font-semibold text-gray-300">Waypoint Type</label>
        <select
          value={waypointType}
          onChange={(e) => update("waypointType", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 mt-1"
        >
          <option value="straight_stop">Straight route. Aircraft stops</option>
          <option value="coordinated_turn">
            Coordinated Turn (Skips Waypoint)
          </option>
          <option value="curved_stop">Curved route. Aircraft stops</option>
          <option value="curved_continue">
            Curved route. Aircraft continues
          </option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-400 mt-2">
          <input
            type="checkbox"
            checked={!!followRouteWaypointType}
            onChange={(e) => update("followRouteWaypointType", e.target.checked)}
            className="accent-blue-600"
          />
          Follow Route Waypoint Type
        </label>
      </div>

      {/* Upon Completion */}
      <div>
        <label className="font-semibold text-gray-300">Upon Completion</label>
        <select
          value={uponCompletion}
          onChange={(e) => update("uponCompletion", e.target.value)}
          className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 mt-1"
        >
          <option value="Return To Home">Return To Home</option>
          <option value="Hover">Hover</option>
          <option value="Land">Land</option>
          <option value="Continue">Continue</option>
        </select>
      </div>

      {/* Takeoff Speed */}
      <div>
        <label className="font-semibold text-gray-300">Takeoff Speed (m/s)</label>
        <input
          type="range"
          min={1}
          max={15}
          step={0.1}
          value={takeoffSpeed}
          onChange={(e) => update("takeoffSpeed", Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-400">1</span>
          <span className="font-bold">{takeoffSpeed}</span>
          <span className="text-xs text-gray-400">15</span>
        </div>
      </div>

      {/* Display Options */}
      <div className="flex flex-wrap gap-4 mt-4">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={!!showWaypointNumber}
            onChange={(e) => update("showWaypointNumber", e.target.checked)}
            className="accent-blue-600"
          />
          Show Waypoint Number
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={!!showWaypointAltitude}
            onChange={(e) => update("showWaypointAltitude", e.target.checked)}
            className="accent-blue-600"
          />
          Show Waypoint Altitude
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={!!showWaypointDistance}
            onChange={(e) => update("showWaypointDistance", e.target.checked)}
            className="accent-blue-600"
          />
          Show Waypoint Distance
        </label>
      </div>
    </div>
  );
}