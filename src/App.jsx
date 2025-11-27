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

export default function App() {
  const streamConfig = {
    rtmpUrl: "rtmp://your-server/live/drone",
    hlsUrl: "http://your-server:8081/hls/drone.m3u8"
  };

  return (
    <WebSocketProvider>
      <Model3DProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Planner />} />
              <Route 
                path="stream" 
                element={
                  <Stream 
                    streamConfig={streamConfig}
                    type="auto"
                    muted={true}
                  />
                } 
              />
              <Route path="model-3d" element={<Model3D />} />
              <Route path="connection" element={<Connection />} />
              {/* Add Thermal Detection as a nested route */}
              <Route path="ThermalAnomalyDetector" element={<ThermalAnomalyDetector />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Model3DProvider>
    </WebSocketProvider>
  );
}