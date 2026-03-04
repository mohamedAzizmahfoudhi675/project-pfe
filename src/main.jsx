/**
 * Main Entry Point – React application bootstrap.
 *
 * This file is the entry point for the React application. It renders the root
 * <App /> component inside the DOM element with id "root".
 *
 * Key responsibilities:
 * - Imports the global CSS file (index.css) which contains Tailwind directives
 *   and any other global styles.
 * - Uses ReactDOM.createRoot to enable Concurrent Mode (React 18+).
 * - Wraps the app in <React.StrictMode> to highlight potential problems during
 *   development.
 *
 * @module main
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'   // Critical: imports Tailwind CSS and global styles

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
