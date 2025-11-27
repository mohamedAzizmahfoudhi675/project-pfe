// src/contexts/Model3DContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const Model3DContext = createContext();

export const useModel3D = () => {
  const context = useContext(Model3DContext);
  if (!context) {
    throw new Error('useModel3D must be used within a Model3DProvider');
  }
  return context;
};

export const Model3DProvider = ({ children }) => {
  const [model3DState, setModel3DState] = useState(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem('model3DState');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          processingStats: parsed.processingStats || null,
          webodmTask: parsed.webodmTask || null,
          loadProjectId: parsed.loadProjectId || '',
          loadTaskId: parsed.loadTaskId || '',
          loadStatus: parsed.loadStatus || 'idle',
          scrollPosition: parsed.scrollPosition || 0,
          authToken: parsed.authToken || null,
          apiStatus: parsed.apiStatus || 'unknown',
          projects: parsed.projects || [],
          selectedProject: parsed.selectedProject || '',
          lastUpdated: parsed.lastUpdated || Date.now()
        };
      }
    } catch (error) {
      console.warn('Failed to restore Model3D state:', error);
    }
    return {
      processingStats: null,
      webodmTask: null,
      loadProjectId: '',
      loadTaskId: '',
      loadStatus: 'idle',
      scrollPosition: 0,
      authToken: null,
      apiStatus: 'unknown',
      projects: [],
      selectedProject: '',
      lastUpdated: Date.now()
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('model3DState', JSON.stringify({
        ...model3DState,
        lastUpdated: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save Model3D state:', error);
    }
  }, [model3DState]);

  // FIXED: Memoize updateModel3DState to prevent infinite re-renders
  const updateModel3DState = useCallback((updates) => {
    setModel3DState(prev => ({
      ...prev,
      ...updates
    }));
  }, []); // Empty dependency array - this function never changes

  // FIXED: Memoize saveScrollPosition
  const saveScrollPosition = useCallback((position) => {
    updateModel3DState({ scrollPosition: position });
  }, [updateModel3DState]);

  // FIXED: Memoize resetModel3DState
  const resetModel3DState = useCallback(() => {
    setModel3DState(prev => ({
      processingStats: null,
      webodmTask: null,
      loadProjectId: '',
      loadTaskId: '',
      loadStatus: 'idle',
      scrollPosition: 0,
      authToken: prev.authToken, // Keep auth token
      apiStatus: prev.apiStatus, // Keep API status
      projects: prev.projects, // Keep projects
      selectedProject: prev.selectedProject, // Keep selected project
      lastUpdated: Date.now()
    }));
  }, []); // Empty dependency array

  const value = {
    ...model3DState,
    updateModel3DState,
    saveScrollPosition,
    resetModel3DState
  };

  return (
    <Model3DContext.Provider value={value}>
      {children}
    </Model3DContext.Provider>
  );
};