// App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { Model3DProvider } from "./contexts/Model3DContext";
import Layout from "./layouts/Layout";
import Planner from "./pages/Planner";
import Stream from "./pages/Stream";
import Connection from "./pages/Connection";
import Model3D from "./pages/Model3D";
import ThermalAnomalyDetector from "./components/ThermalAnomalyDetector";

/**
 * App Component – The root component of the Drone Command application.
 *
 * This component sets up the global providers and defines the application's routing.
 * It wraps the entire application with:
 *   - WebSocketProvider: Provides a WebSocket connection to the drone platform,
 *     enabling real‑time communication and status updates across the app.
 *   - Model3DProvider: Provides state and persistence for the 3D model generation
 *     (WebODM) features, including authentication tokens, project lists, and task status.
 *   - BrowserRouter: Enables client‑side routing using React Router.
 *
 * The main layout (Layout) is rendered for all routes under the root path ("/").
 * Inside the layout, the appropriate page component is displayed based on the URL.
 *
 * @returns {JSX.Element} The root element of the application.
 */
export default function App() {
  // Configuration for the live stream page – these URLs would typically come from
  // environment variables or a backend service. Here they are placeholders.
  const streamConfig = {
    rtmpUrl: "rtmp://your-server/live/drone",   // RTMP ingest URL for the drone stream
    hlsUrl: "http://your-server:8081/hls/drone.m3u8" // HLS playback URL (if using HLS)
  };

  return (
    // Provide a global WebSocket connection to all descendant components.
    <WebSocketProvider>
      {/* Provide 3D model state (WebODM) to all descendant components. */}
      <Model3DProvider>
        {/* React Router setup */}
        <BrowserRouter>
          <Routes>
            {/* The Layout component renders the common navbar and sidebar,
                and its children (via <Outlet>) are determined by nested routes. */}
            <Route path="/" element={<Layout />}>
              {/* Index route (path "/") – the mission planner page. */}
              <Route index element={<Planner />} />

              {/* Live stream viewer page – expects streamConfig as props. */}
              <Route 
                path="stream" 
                element={
                  <Stream 
                    streamConfig={streamConfig}
                    type="auto"     // Automatically choose best playback method
                    muted={true}    // Mute by default (browsers often require user interaction for unmute)
                  />
                } 
              />

              {/* 3D model viewer page (WebODM integration) */}
              <Route path="model-3d" element={<Model3D />} />

              {/* Connection status / control page */}
              <Route path="connection" element={<Connection />} />

              {/* Thermal anomaly detection page – uses a separate AI model. */}
              <Route path="ThermalAnomalyDetector" element={<ThermalAnomalyDetector />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Model3DProvider>
    </WebSocketProvider>
  );
}
