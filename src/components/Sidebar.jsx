import React from "react";
import { useWebSocket } from "../contexts/WebSocketContext"; // Add this import
import WaypointRouteParamsPanel from "./WaypointRouteParamsPanel";
import AreaRouteParamsPanel from "./AreaRouteParamsPanel";
import { exportKMLFile, exportKMZFile, droneEnumMap, sendKMLToServer, sendKMZToServer } from "../utils/ExportKML";
import { generateAreaKMZ } from "../utils/area-route-kmz";

export default function Sidebar({
  routeType,
  setRouteType,
  routeParams,
  setRouteParams,
  areaParams,
  setAreaParams,
  generatePath,
  clearAll,
  waypoints = [],
  path = [],
  onOpenAreaParams,
  missionAnalytics,
  warnings = [],
  currentGSD,
  polygonVertices = [],
  // Remove websocket prop since we'll get it from context
}) {
  // Get WebSocket from global context
  const { websocket, isConnected, connectionStatus } = useWebSocket();

  // Use polygonVertices for area routes, waypoints for other routes
  const displayWaypoints = routeType === "area" ? polygonVertices : waypoints;
  const exportPath = (path && path.length > 0) ? path : displayWaypoints;

  function getDroneEnum(params) {
    if (!params) return 68;
    return droneEnumMap[params.aircraftModel] ?? droneEnumMap[params.aircraft] ?? 68;
  }

  // Transform advanced area params to compatible format
  const getCompatibleAreaParams = (params) => {
    return {
      routeAltitude: params.routeAltitude || 120,
      speed: params.speed || 5,
      flightLineSpacing: params.flightLineSpacing || 20,
      photoInterval: params.photoInterval || 10,
      overlap: params.sideOverlap || 70,
      cameraModel: params.cameraModel || "GenericCam",
      
      ...params,
      
      waypointName: params.areaRouteName || "area_route",
      relativeAltitude: params.routeAltitude || 120,
      safeTakeoffAltitude: params.safeTakeoffAltitude || 66,
      lineSpacing: params.flightLineSpacing || 20,
      pointSpacing: params.photoInterval || 10,
      direction: params.courseAngle || 0,
    };
  };

  const handleExport = async (type) => {
    if (!exportPath || exportPath.length === 0) {
      alert("No waypoints to export");
      return;
    }

    try {
      if (routeType === "waypoint") {
        const params = routeParams || {};
        const droneEnumValue = getDroneEnum(params);

        const exportData = {
          name: params.waypointName || "route",
          path: exportPath.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            alt: p.alt ?? params.relativeAltitude ?? params.routeAltitude ?? 100,
            speed: p.speed ?? params.speed ?? params.takeoffSpeed ?? 5,
            actions: p.actions ?? p.actionsList ?? [],
            waypointHeadingMode: params.aircraftYaw === "route" ? "followWayline" : "manual",
            waypointTurnMode:
              params.waypointType === "straight_stop"
                ? "toPointAndStopWithDiscontinuityCurvature"
                : "coordinateTurn",
            gimbalPitchAngle: params.gimbalPitch ?? params.gimbalPitchOblique ?? 0,
          })),
          droneEnumValue,
          droneSubEnumValue: params.droneSubEnumValue ?? 0,
          takeOffSecurityHeight: params.safeTakeoffAltitude ?? 66,
          globalTransitionalSpeed: params.takeoffSpeed ?? params.speed ?? 15,
          autoFlightSpeed: params.speed ?? 5,
          globalHeight: params.relativeAltitude ?? params.routeAltitude ?? 100,
          waypointHeadingMode: params.aircraftYaw === "route" ? "followWayline" : "manual",
          waypointTurnMode:
            params.waypointType === "straight_stop"
              ? "toPointAndStopWithDiscontinuityCurvature"
              : "coordinateTurn",
          gimbalPitchMode: (params.gimbalControl || "manual").toLowerCase(),
        };

        if (type === "kml") {
          exportKMLFile(exportData);
        } else {
          await exportKMZFile(exportData);
        }

        return;
      }

      // area route export
      if (routeType === "area") {
        const params = getCompatibleAreaParams(areaParams || {});
        
        const polygon = polygonVertices.length >= 3 
          ? polygonVertices.map(p => ({ lat: p.lat, lng: p.lng }))
          : exportPath.map(p => ({ lat: p.lat, lng: p.lng }));

        if (!Array.isArray(polygon) || polygon.length < 3) {
          alert("Area export requires a polygon with at least 3 points");
          return;
        }

        const sweep = {
          lineSpacing: params.flightLineSpacing || params.lineSpacing || 20,
          pointSpacing: params.photoInterval || params.pointSpacing || 10,
          angleDeg: params.courseAngle || params.direction || 0,
          alt: params.routeAltitude || params.relativeAltitude || 120,
          alternate: true,
          frontOverlap: params.frontOverlap || 80,
          sideOverlap: params.sideOverlap || 70,
          collectionMode: params.collectionMode || "Ortho",
          gimbalPitch: params.gimbalPitchOblique || -45,
        };

        console.log("Exporting area route with params:", {
          polygonPoints: polygon.length,
          altitude: sweep.alt,
          lineSpacing: sweep.lineSpacing,
          camera: params.cameraModel,
          collectionMode: sweep.collectionMode
        });

        await generateAreaKMZ({
          name: params.areaRouteName || params.waypointName || "area_route",
          polygon,
          sweep,
          droneEnumValue: getDroneEnum(params),
          droneSubEnumValue: params.droneSubEnumValue ?? 0,
          payloadEnumValue: params.payloadEnumValue ?? 53,
          payloadSubEnumValue: params.payloadSubEnumValue ?? 0,
          payloadPositionIndex: params.payloadPositionIndex ?? 0,
          autoFlightSpeed: params.speed ?? params.autoFlightSpeed ?? 5,
          globalHeight: sweep.alt,
          takeOffSecurityHeight: params.safeTakeoffAltitude ?? 66,
          actionIntervalSeconds: params.actionIntervalSeconds ?? 2.0,
        });

        return;
      }

      alert("Unknown route type. Set routeType to 'waypoint' or 'area'.");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. See console for details.");
    }
  };

  // Handle sending files to server
  const handleSendToServer = async (type) => {
    if (!isConnected || !websocket) {
      alert("Not connected to server. Please check WebSocket connection.");
      return;
    }

    if (!exportPath || exportPath.length === 0) {
      alert("No waypoints to send");
      return;
    }

    try {
      if (routeType === "waypoint") {
        const params = routeParams || {};
        const droneEnumValue = getDroneEnum(params);

        const exportData = {
          name: params.waypointName || "route",
          path: exportPath.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            alt: p.alt ?? params.relativeAltitude ?? params.routeAltitude ?? 100,
            speed: p.speed ?? params.speed ?? params.takeoffSpeed ?? 5,
            actions: p.actions ?? p.actionsList ?? [],
            waypointHeadingMode: params.aircraftYaw === "route" ? "followWayline" : "manual",
            waypointTurnMode:
              params.waypointType === "straight_stop"
                ? "toPointAndStopWithDiscontinuityCurvature"
                : "coordinateTurn",
            gimbalPitchAngle: params.gimbalPitch ?? params.gimbalPitchOblique ?? 0,
          })),
          droneEnumValue,
          droneSubEnumValue: params.droneSubEnumValue ?? 0,
          takeOffSecurityHeight: params.safeTakeoffAltitude ?? 66,
          globalTransitionalSpeed: params.takeoffSpeed ?? params.speed ?? 15,
          autoFlightSpeed: params.speed ?? 5,
          globalHeight: params.relativeAltitude ?? params.routeAltitude ?? 100,
          waypointHeadingMode: params.aircraftYaw === "route" ? "followWayline" : "manual",
          waypointTurnMode:
            params.waypointType === "straight_stop"
              ? "toPointAndStopWithDiscontinuityCurvature"
              : "coordinateTurn",
          gimbalPitchMode: (params.gimbalControl || "manual").toLowerCase(),
        };

        if (type === "kml") {
          await sendKMLToServer({
            name: exportData.name + ".kml",
            pathParams: exportData,
            websocket: websocket
          });
          alert("KML sent to server successfully!");
        } else {
          await sendKMZToServer({
            name: exportData.name + ".kmz", 
            pathParams: exportData,
            websocket: websocket
          });
          alert("KMZ sent to server successfully!");
        }
        return;
      }

      // Handle area route sending
      if (routeType === "area") {
        const params = getCompatibleAreaParams(areaParams || {});
        
        const polygon = polygonVertices.length >= 3 
          ? polygonVertices.map(p => ({ lat: p.lat, lng: p.lng }))
          : exportPath.map(p => ({ lat: p.lat, lng: p.lng }));

        if (!Array.isArray(polygon) || polygon.length < 3) {
          alert("Area route requires a polygon with at least 3 points");
          return;
        }

        const sweep = {
          lineSpacing: params.flightLineSpacing || params.lineSpacing || 20,
          pointSpacing: params.photoInterval || params.pointSpacing || 10,
          angleDeg: params.courseAngle || params.direction || 0,
          alt: params.routeAltitude || params.relativeAltitude || 120,
          alternate: true,
          frontOverlap: params.frontOverlap || 80,
          sideOverlap: params.sideOverlap || 70,
          collectionMode: params.collectionMode || "Ortho",
          gimbalPitch: params.gimbalPitchOblique || -45,
        };

        const areaExportData = {
          name: params.areaRouteName || params.waypointName || "area_route",
          polygon,
          sweep,
          droneEnumValue: getDroneEnum(params),
          droneSubEnumValue: params.droneSubEnumValue ?? 0,
          payloadEnumValue: params.payloadEnumValue ?? 53,
          payloadSubEnumValue: params.payloadSubEnumValue ?? 0,
          payloadPositionIndex: params.payloadPositionIndex ?? 0,
          autoFlightSpeed: params.speed ?? params.autoFlightSpeed ?? 5,
          globalHeight: sweep.alt,
          takeOffSecurityHeight: params.safeTakeoffAltitude ?? 66,
          actionIntervalSeconds: params.actionIntervalSeconds ?? 2.0,
        };

        // For area routes, we can only send KMZ since KML doesn't support area missions
        if (type === "kmz") {
          await sendKMZToServer({
            name: areaExportData.name + ".kmz",
            pathParams: areaExportData,
            websocket: websocket
          });
          alert("Area KMZ sent to server successfully!");
        } else {
          alert("Area routes can only be sent as KMZ files");
        }
        return;
      }

      alert("Unknown route type for sending.");
    } catch (err) {
      console.error("Send to server failed:", err);
      alert("Failed to send to server. See console for details.");
    }
  };

  // Enhanced mission status for area routes
  const renderMissionStatus = () => {
    if (!missionAnalytics && warnings.length === 0) return null;

    return (
      <div className="mb-4 space-y-2">
        {missionAnalytics && (
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-green-400">Mission Ready</span>
              {missionAnalytics.estimatedFlightTime && (
                <span className="text-sm text-gray-300">
                  Est. Time: {missionAnalytics.estimatedFlightTime}min
                </span>
              )}
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              {currentGSD && (
                <div>GSD: {currentGSD} cm/px</div>
              )}
              <div>
                {routeType === "area" ? "Polygon Vertices" : "Waypoints"}: {displayWaypoints.length}
              </div>
              {missionAnalytics.photoPoints && (
                <div>Photo Points: {missionAnalytics.photoPoints}</div>
              )}
              {areaParams?.cameraModel && areaParams.cameraModel !== "GenericCam" && (
                <div>Camera: {areaParams.cameraModel}</div>
              )}
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700 p-3 rounded-lg">
            <div className="font-semibold text-yellow-400 mb-1">
              {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
            </div>
            <div className="text-sm text-yellow-300">
              {warnings.slice(0, 2).map((warning, i) => (
                <div key={i}>• {warning}</div>
              ))}
              {warnings.length > 2 && (
                <div>• ...and {warnings.length - 2} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Enhanced connection status display
  const renderConnectionStatus = () => {
    const getStatusConfig = () => {
      switch (connectionStatus) {
        case 'connected':
          return { color: 'green', text: 'Connected to Server', icon: '✅' };
        case 'connecting':
          return { color: 'yellow', text: 'Connecting...', icon: '🔄' };
        case 'error':
          return { color: 'red', text: 'Connection Error', icon: '❌' };
        default:
          return { color: 'red', text: 'Disconnected', icon: '❌' };
      }
    };

    const config = getStatusConfig();

    return (
      <div className={`mb-4 p-3 rounded-lg border border-${config.color}-500 bg-${config.color}-900/20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>{config.icon}</span>
            <span className={`text-${config.color}-400 font-semibold`}>
              {config.text}
            </span>
          </div>
          {connectionStatus === 'connected' && (
            <span className="text-xs text-green-300">
              Ready to send
            </span>
          )}
        </div>
        {connectionStatus !== 'connected' && (
          <div className="text-xs text-yellow-300 mt-1">
            Mission files cannot be sent to mobile devices
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="h-full bg-gray-900 text-white flex flex-col p-4"
      style={{ maxHeight: "120vh", overflowY: "auto" }}
    >
      <h2 className="text-lg font-bold mb-4">Route Planner</h2>

      {/* Connection Status */}
      {renderConnectionStatus()}

      {renderMissionStatus()}

      <div className="mb-4 flex flex-row gap-2">
        <button
          className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-500 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={generatePath}
          disabled={routeType === "area" ? displayWaypoints.length < 3 : displayWaypoints.length < 1}
        >
          Generate Path
        </button>
        <button
          className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 font-semibold"
          onClick={clearAll}
        >
          Clear All
        </button>
      </div>

      {/* Export and Send Buttons Section */}
      <div className="mb-4 space-y-3">
        {/* Export Buttons */}
        <div className="flex flex-row gap-2">
          <button
            className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            disabled={exportPath.length === 0}
            onClick={() => handleExport("kml")}
          >
            Export KML
          </button>
          
          <button
            className="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            disabled={exportPath.length === 0}
            onClick={() => handleExport("kmz")}
          >
            Export KMZ
          </button>
        </div>

        {/* Send to Server Buttons */}
        <div className="flex flex-row gap-2">
          <button
            className="bg-orange-600 px-4 py-2 rounded hover:bg-orange-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            disabled={exportPath.length === 0 || !isConnected}
            onClick={() => handleSendToServer("kml")}
            title={!isConnected ? "Connect to server to send files" : "Send KML to connected devices"}
          >
            Send KML
          </button>
          
          <button
            className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            disabled={exportPath.length === 0 || !isConnected}
            onClick={() => handleSendToServer("kmz")}
            title={!isConnected ? "Connect to server to send files" : "Send KMZ to connected devices"}
          >
            Send KMZ
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="font-semibold mb-2">Route Type</div>
        <div className="flex gap-2 flex-wrap">
          {["waypoint", "area"].map((type) => (
            <button
              key={type}
              className={`px-3 py-1 rounded text-sm ${
                routeType === type ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
              }`}
              onClick={() => setRouteType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {routeType === "waypoint" && (
        <WaypointRouteParamsPanel params={routeParams} onChange={setRouteParams} />
      )}

      {routeType === "area" && (
        <AreaRouteParamsPanel params={areaParams} onChange={setAreaParams} />
      )}

      {/* Enhanced Waypoint Count Display */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-sm text-gray-400">
          {routeType === "area" ? "Polygon Vertices" : "Waypoints"}: 
          <span className="text-white font-semibold ml-1">{displayWaypoints.length}</span>
        </div>
        {routeType === "area" && (
          <div className="text-xs text-gray-500 mt-1">
            {displayWaypoints.length < 3 
              ? "Need at least 3 vertices for area coverage" 
              : `Ready to generate ${displayWaypoints.length}-sided polygon`}
          </div>
        )}
        {areaParams?.areaRouteName && (
          <div className="text-xs text-blue-400 mt-1">
            Mission: {areaParams.areaRouteName}
          </div>
        )}
      </div>
    </div>
  );
}