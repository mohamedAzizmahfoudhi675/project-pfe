import { NavLink } from "react-router-dom";
import { Map, Video, Wifi, Box, Thermometer, ChevronDown } from "lucide-react";

/**
 * Navbar Component
 *
 * Renders the top navigation bar for the Drone Command professional UAV platform.
 * It provides branding, main navigation links, and a connection status indicator.
 *
 * Features:
 * - Logo and application title.
 * - Navigation links for Mission Planner, 3D Visualization, Connection, and Thermal Detection.
 * - Active link highlighting with gradient background and icon scaling.
 * - Hover effects and status indicator.
 * - Responsive design using Tailwind CSS.
 *
 * The component uses NavLink from react-router-dom to enable client-side routing
 * and automatically applies active styles based on the current URL.
 */
export default function Navbar() {
  /**
   * Navigation items configuration.
   * Each item contains:
   * - path: The route URL.
   * - label: Display text.
   * - icon: Lucide icon component.
   * - end: Optional flag for exact matching of the root path.
   */
  const navItems = [
    { path: "/", label: "Mission Planner", icon: Map, end: true },
    // Note: The commented "Live Feed" item can be uncommented later.
    // { path: "/live", label: "Live Feed", icon: Video },
    { path: "/model-3d", label: "3D Visualization", icon: Box },
    { path: "/connection", label: "Connection", icon: Wifi },
    { path: "/ThermalAnomalyDetector", label: "Thermal Detection", icon: Thermometer }
  ];

  return (
    <nav className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* ----- Logo/Brand Section ----- */}
          <div className="flex items-center gap-3">
            {/* Icon container with gradient background and live indicator dot */}
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                <Map size={22} className="text-white" strokeWidth={2.5} />
              </div>
              {/* Animated green dot indicating system online status */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse"></div>
            </div>
            {/* App title and tagline */}
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Drone Command
              </h1>
              <p className="text-xs text-gray-400 font-medium">Professional UAV Platform</p>
            </div>
          </div>

          {/* ----- Navigation Links ----- */}
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `
                    group relative flex items-center gap-2 px-4 py-2.5 rounded-lg
                    font-medium text-sm transition-all duration-300 ease-out
                    ${isActive 
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50" 
                      : "text-gray-300 hover:text-white hover:bg-gray-700/50"
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {/* Icon with scaling effect on hover/active */}
                      <Icon 
                        size={18} 
                        className={`transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      
                      {/* Link label */}
                      <span className="whitespace-nowrap">
                        {item.label}
                      </span>
                      
                      {/* Active indicator: a subtle glowing line below the link */}
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-white to-transparent rounded-full"></div>
                      )}
                      
                      {/* Hover glow effect for inactive links */}
                      {!isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity duration-300"></div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* ----- Status Indicator and Menu ----- */}
          <div className="flex items-center gap-3">
            {/* Online status badge with pulsing dot */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
              <span className="text-xs font-semibold text-green-400">ONLINE</span>
            </div>
            
            {/* Dropdown menu button (placeholder for future user menu) */}
            <button className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white">
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Subtle gradient line at the bottom of the navbar */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
    </nav>
  );
}
