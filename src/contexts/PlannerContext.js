// src/context/PlannerContext.js

import { createContext } from "react";

/**
 * PlannerContext - A React context for sharing mission planning state across components.
 *
 * This context is intended to hold global state related to the mission planner,
 * such as waypoints, flight parameters, and UI state. It is initially `null`
 * and should be provided by a `<PlannerProvider>` component at a higher level
 * in the component tree.
 *
 * Usage:
 *   import { useContext } from 'react';
 *   import { PlannerContext } from '../context/PlannerContext';
 *
 *   const plannerState = useContext(PlannerContext);
 *   // plannerState will be the value provided by the nearest <PlannerProvider>.
 *
 * @type {React.Context<Object|null>}
 */
export const PlannerContext = createContext(null);
