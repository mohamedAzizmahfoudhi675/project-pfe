import React, { useState } from "react";

// Usage:
// <RouteParamsPanel
//   initialParams={routeParams}
//   onSave={handleSave}
//   onCancel={handleCancel}
// />

export default function RouteParamsPanel({
  initialParams = {},
  onSave,
  onCancel,
}) {
  const [safeTakeoffAltitude, setSafeTakeoffAltitude] = useState(initialParams.safeTakeoffAltitude || 66);
  const [climbToStartPoint, setClimbToStartPoint] = useState(initialParams.climbToStartPoint || false);
  const [speed, setSpeed] = useState(initialParams.speed || 11.2);
  const [relativeAltitude, setRelativeAltitude] = useState(initialParams.relativeAltitude || 328.1);
  const [yaw, setYaw] = useState(initialParams.yaw || "route");
  const [gimbalControl, setGimbalControl] = useState(initialParams.gimbalControl || "Manual");
  const [waypointType, setWaypointType] = useState(initialParams.waypointType || "straight_stop");
  const [uponCompletion, setUponCompletion] = useState(initialParams.uponCompletion || "Return To Home");
  const [takeoffSpeed, setTakeoffSpeed] = useState(initialParams.takeoffSpeed || 6);

  const handleSave = () => {
    onSave({
      safeTakeoffAltitude,
      climbToStartPoint,
      speed,
      relativeAltitude,
      yaw,
      gimbalControl,
      waypointType,
      uponCompletion,
      takeoffSpeed,
    });
  };

  return (
    <div className="bg-gray-900 text-white p-5 rounded-lg w-[400px] shadow-xl">
      <h2 className="font-bold text-lg mb-4">Route Parameters</h2>
      <div className="mb-3">
        <label>Safe Takeoff Altitude</label>
        <input
          type="number"
          min={7}
          max={4921}
          value={safeTakeoffAltitude}
          onChange={e => setSafeTakeoffAltitude(Number(e.target.value))}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        />
      </div>
      <div className="mb-3 flex items-center">
        <label>Climb to start point</label>
        <input
          type="checkbox"
          checked={climbToStartPoint}
          onChange={e => setClimbToStartPoint(e.target.checked)}
          className="ml-2 accent-blue-600"
        />
      </div>
      <div className="mb-3">
        <label>Speed (mph)</label>
        <input
          type="number"
          min={2.3}
          max={33.5}
          step={0.1}
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        />
      </div>
      <div className="mb-3">
        <label>Relative Altitude (ft)</label>
        <input
          type="number"
          min={-4921.2}
          max={4921.2}
          step={0.1}
          value={relativeAltitude}
          onChange={e => setRelativeAltitude(Number(e.target.value))}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        />
      </div>
      <div className="mb-3">
        <label>Aircraft Yaw</label>
        <select
          value={yaw}
          onChange={e => setYaw(e.target.value)}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        >
          <option value="route">Along the Route</option>
          <option value="manual">Manual</option>
        </select>
      </div>
      <div className="mb-3">
        <label>Gimbal Control</label>
        <select
          value={gimbalControl}
          onChange={e => setGimbalControl(e.target.value)}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        >
          <option value="Manual">Manual</option>
          <option value="Auto">Auto</option>
        </select>
      </div>
      <div className="mb-3">
        <label>Waypoint Type</label>
        <select
          value={waypointType}
          onChange={e => setWaypointType(e.target.value)}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        >
          <option value="straight_stop">Straight route. Aircraft stops</option>
          <option value="curve">Curve route</option>
        </select>
      </div>
      <div className="mb-3">
        <label>Upon Completion</label>
        <select
          value={uponCompletion}
          onChange={e => setUponCompletion(e.target.value)}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        >
          <option value="Return To Home">Return To Home</option>
          <option value="Hover">Hover</option>
        </select>
      </div>
      <div className="mb-3">
        <label>Takeoff Speed (mph)</label>
        <input
          type="number"
          min={2.3}
          max={33.5}
          step={0.1}
          value={takeoffSpeed}
          onChange={e => setTakeoffSpeed(Number(e.target.value))}
          className="w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700"
        />
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSave}
          className="bg-blue-600 px-4 py-2 rounded text-white font-bold hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-600 px-4 py-2 rounded text-white font-bold hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}