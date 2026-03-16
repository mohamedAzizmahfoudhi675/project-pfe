# Drone Projects Planner
A comprehensive React-based interface for planning autonomous drone routes, managing Waypoint & Area (Lawnmower) missions, connecting to real-time streams, and pushing routes to a backend mission server.

## Features
- **Waypoint Missions**: Plot detailed waypoint lines, control drone speeds, adjust gimbal pitch per waypoint.
- **Area Missions**: Draw polygons, generate automatic lawnmower paths with adjustable front/side overlap, optimal GSD calculation, and precise row spacing.
- **3D Modeling & Streaming**: Integrates 3D visualization and live streaming functionalities out of the box.
- **WebSocket Exporting**: Export paths locally as KML/KMZ or send them instantly via WebSocket to the Node/Python server stack for execution.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher recommended)
- [Python 3](https://www.python.org/downloads/) (for the backend server, if required)
- `npm` or `yarn`

### Installation
1. Clone the project or navigate into the root directory of this project.
2. Install the frontend dependencies:
   ```bash
   cd my-app
   npm install
   ```

### Running Locally
To run the frontend client (Vite Server):
```bash
npm run dev
```
Navigate to `http://localhost:5173/` in your browser.

*(If you are running the backend services in the `backend/` folder, ensure they are launched on their respective ports. Refer to the backend's README or start script.)*

## Project Structure
- `src/components/common`: Shared layout UI elements (Sidebar, Navbar, etc.)
- `src/components/map`: Map canvas implementations, Google Maps wrappers, Overlays.
- `src/components/panels`: Sidebar forms and UI panels controlling route parameters.
- `src/contexts`: Global state managers (WebSockets, Mission context, Planner state logic).
- `src/utils`: KML/KMZ export logic, geometry calculations, global parameter definitions.
- `src/pages`: Distinct features like Planner, Stream, Model3D, etc.

Detailed architectural diagrams and component relations can be found in `ARCHITECTURE.md`.
Detailed usage instructions can be found in `USER_GUIDE.md`.
