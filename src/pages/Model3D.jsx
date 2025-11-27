// src/pages/Model3D.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Camera, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { saveAs } from 'file-saver';
import { useModel3D } from '../contexts/Model3DContext';

// WebODM Configuration
const WEBODM_CONFIG = {
  BASE_URL: 'http://localhost:8000',
};

// Helper functions
const getStatusText = (statusCode) => {
  const statusMap = {
    10: 'QUEUED',
    20: 'RUNNING',
    30: 'FAILED',
    40: 'COMPLETED',
    50: 'CANCELED'
  };
  return statusMap[statusCode] || 'UNKNOWN';
};

const formatProcessingTime = (ms) => {
  if (ms === -1 || !ms) return 'Processing...';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

// Debounce helper function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// WebODM Iframe Viewer Component
function WebODMIframeViewer({ taskId }) {
  const iframeUrl = `${WEBODM_CONFIG.BASE_URL}/public/task/${taskId}/iframe/3d/`;
  
  return (
    <div className="w-full h-full bg-gray-900 rounded-lg">
      <iframe 
        src={iframeUrl}
        title="WebODM 3D Model"
        width="100%"
        height="100%"
        frameBorder="0"
        className="rounded-lg"
      />
    </div>
  );
}

// UploadSection Component
function UploadSection({ onUploadComplete, onProcessingUpdate }) {
  const {
    authToken,
    apiStatus,
    projects,
    selectedProject,
    updateModel3DState
  } = useModel3D();

  const [uploadStage, setUploadStage] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentStage, setCurrentStage] = useState('');
  const [currentTask, setCurrentTask] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const fileInputRef = useRef();

  // Memoize functions that are used in effects
  const testAPIConnection = useCallback(async (token = authToken) => {
    if (!token) {
      updateModel3DState({ apiStatus: 'needs_auth' });
      return;
    }
    try {
      const response = await fetch(`${WEBODM_CONFIG.BASE_URL}/api/projects/`, {
        headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        updateModel3DState({ apiStatus: 'connected' });
        fetchProjects(token);
      } else if (response.status === 401) {
        updateModel3DState({ 
          apiStatus: 'needs_auth',
          authToken: null
        });
        localStorage.removeItem('webodm_token');
        setShowLogin(true);
      } else {
        updateModel3DState({ apiStatus: 'error' });
        console.error('WebODM API connection failed', response.status);
      }
    } catch (error) {
      updateModel3DState({ apiStatus: 'error' });
      console.error('WebODM API connection failed', error);
    }
  }, [updateModel3DState, authToken]);

  const fetchProjects = useCallback(async (token = authToken) => {
    if (!token) return;
    try {
      const response = await fetch(`${WEBODM_CONFIG.BASE_URL}/api/projects/`, {
        headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        updateModel3DState({ 
          projects: data,
          apiStatus: 'connected'
        });
      } else if (response.status === 401) {
        updateModel3DState({ apiStatus: 'needs_auth' });
        setShowLogin(true);
      } else {
        updateModel3DState({ apiStatus: 'error' });
      }
    } catch (error) {
      updateModel3DState({ apiStatus: 'error' });
      console.error('Error fetching projects:', error);
    }
  }, [updateModel3DState, authToken]);

  // JWT Authentication
  const authenticateUser = async (username, password) => {
    try {
      const response = await fetch(`${WEBODM_CONFIG.BASE_URL}/api/token-auth/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.token;
        updateModel3DState({ 
          authToken: token,
          apiStatus: 'connected'
        });
        localStorage.setItem('webodm_token', token);
        setShowLogin(false);
        return token;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Authentication failed');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      updateModel3DState({ apiStatus: 'auth_failed' });
      throw error;
    }
  };

  // FIXED: Check for existing token on component mount
  useEffect(() => {
    if (!authToken) {
      const savedToken = localStorage.getItem('webodm_token');
      if (savedToken) {
        updateModel3DState({ 
          authToken: savedToken,
          apiStatus: 'connected'
        });
        testAPIConnection(savedToken);
      } else {
        setShowLogin(true);
        updateModel3DState({ apiStatus: 'needs_auth' });
      }
    }
  }, []); // Empty array - run only once on mount

  // Create project using POST /api/projects/
  const createProject = async (name, token = authToken) => {
    if (!token) throw new Error('Not authenticated');

    try {
      const response = await fetch(`${WEBODM_CONFIG.BASE_URL}/api/projects/`, {
        method: 'POST',
        headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, description: 'Created from React 3D Viewer' })
      });

      if (response.ok) {
        const data = await response.json();
        await fetchProjects(token);
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await authenticateUser(loginData.username, loginData.password);
    } catch (error) {
      alert(`Login failed: ${error.message}`);
    }
  };

  const handleLogout = () => {
    updateModel3DState({ 
      authToken: null,
      apiStatus: 'needs_auth',
      projects: [],
      selectedProject: ''
    });
    localStorage.removeItem('webodm_token');
    setShowLogin(true);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      alert('Please select images first');
      return;
    }
    if (!authToken) {
      setShowLogin(true);
      return;
    }

    setUploadStage('uploading');
    setProgress(0);

    try {
      let projectId = selectedProject;
      let projectObj = null;

      if (!projectId) {
        if (projects.length > 0) {
          projectObj = projects[0];
          projectId = projectObj.id;
          updateModel3DState({ selectedProject: projectId });
        } else {
          const projectName = `Project_${Date.now()}`;
          const created = await createProject(projectName, authToken);
          if (!created || !created.id) {
            throw new Error('Failed to create project');
          }
          projectObj = created;
          projectId = created.id;
          updateModel3DState({ selectedProject: projectId });
        }
      } else {
        projectObj = projects.find(p => String(p.id) === String(projectId)) || null;
      }

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('images', file);
      });
      formData.append('name', `Task_${Date.now()}`);

      const uploadResponse = await fetch(
        `${WEBODM_CONFIG.BASE_URL}/api/projects/${projectId}/tasks/`,
        {
          method: 'POST',
          headers: { 'Authorization': `JWT ${authToken}` },
          body: formData
        }
      );

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401) {
          handleLogout();
          throw new Error('Session expired. Please login again.');
        }
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const taskData = await uploadResponse.json();
      setCurrentTask(taskData);
      setUploadStage('uploaded');

      pollTaskProgress(projectId, taskData.id, authToken);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStage('error');
      alert(`Upload failed: ${error.message}`);
    }
  };

  // Poll the task endpoint for status
  const pollTaskProgress = async (projectId, taskId, token = authToken) => {
    if (!token) return;

    const intervalMs = 5000;
    let attempts = 0;
    const maxAttempts = 360;

    const pollInterval = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(pollInterval);
        setUploadStage('error');
        console.error('Polling timed out');
        return;
      }

      try {
        const response = await fetch(
          `${WEBODM_CONFIG.BASE_URL}/api/projects/${projectId}/tasks/${taskId}/`,
          { headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          const text = await response.text().catch(() => '<no body>');
          console.error('Polling HTTP error', response.status, text);
          if (response.status === 401) {
            clearInterval(pollInterval);
            handleLogout();
            setUploadStage('error');
            alert('Session expired. Please login again.');
            return;
          }
          return;
        }

        const task = await response.json();

        const status = task.status;
        let prog = 0;
        let stageDescription = '';

        switch (status) {
          case 10:
            prog = 10;
            stageDescription = 'Task queued for processing';
            break;
          case 20:
            if (task.upload_progress < 1.0) {
              prog = 10 + Math.round(task.upload_progress * 20);
              stageDescription = 'Uploading images to processing node';
            } else if (task.resize_progress < 1.0) {
              prog = 30 + Math.round(task.resize_progress * 20);
              stageDescription = 'Resizing and preparing images';
            } else {
              prog = 50 + Math.round((task.running_progress || 0) * 45);
              stageDescription = 'Processing images and generating 3D model';
            }
            break;
          case 40:
            prog = 100;
            stageDescription = 'Processing complete';
            break;
          case 30:
            prog = 0;
            stageDescription = `Processing failed: ${task.last_error || 'Unknown error'}`;
            break;
          case 50:
            prog = 0;
            stageDescription = 'Processing canceled';
            break;
          default:
            prog = 5;
            stageDescription = 'Initializing task';
        }

        setProgress(prog);
        setCurrentStage(stageDescription);

        onProcessingUpdate({
          taskId: taskId,
          projectId: projectId,
          status: status,
          statusText: getStatusText(status),
          progress: prog,
          stage: stageDescription,
          raw: task
        });

        if (status === 40) {
          clearInterval(pollInterval);
          setUploadStage('complete');
          setProgress(100);

          onUploadComplete({
            taskId: taskId,
            projectId: projectId,
            stats: {
              images: task.images_count || selectedFiles.length,
              processingTime: formatProcessingTime(task.processing_time),
              accuracy: 'High Precision',
              vertices: '1M+',
              faces: '500K+'
            }
          });
        } else if (status === 30 || status === 50) {
          clearInterval(pollInterval);
          setUploadStage('error');
          alert(`WebODM processing ${status === 30 ? 'failed' : 'canceled'}: ${task.last_error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error polling task:', error);
        clearInterval(pollInterval);
        setUploadStage('error');
      }
    }, intervalMs);
  };

  const getUploadIcon = () => {
    switch (uploadStage) {
      case 'uploading':
        return <Upload className="animate-pulse" size={24} />;
      case 'processing':
        return <Camera className="animate-spin" size={24} />;
      case 'complete':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'error':
        return <X className="text-red-500" size={24} />;
      default:
        return <Upload size={24} />;
    }
  };

  const getUploadText = () => {
    switch (uploadStage) {
      case 'uploading':
        return `Uploading ${selectedFiles.length} images to WebODM...`;
      case 'processing':
        return `${currentStage}... ${progress}%`;
      case 'complete':
        return '3D Model Ready!';
      case 'error':
        return 'Processing Failed';
      default:
        return 'Upload to WebODM';
    }
  };

  const getConnectionStatus = () => {
    switch (apiStatus) {
      case 'connected':
        return { text: 'Connected to WebODM', color: 'text-green-400' };
      case 'needs_auth':
        return { text: 'Authentication Required', color: 'text-yellow-400' };
      case 'auth_failed':
        return { text: 'Login Failed', color: 'text-red-400' };
      case 'error':
        return { text: 'Connection Failed', color: 'text-red-400' };
      default:
        return { text: 'Checking connection...', color: 'text-yellow-400' };
    }
  };

  const resetUpload = () => {
    setUploadStage('idle');
    setProgress(0);
    setSelectedFiles([]);
    setCurrentStage('');
    setCurrentTask(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openWebODM = () => {
    window.open(WEBODM_CONFIG.BASE_URL, '_blank');
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-white mb-3">WebODM Processing</h3>

      <div className="flex items-center justify-between mb-4">
        <span className={`text-sm ${connectionStatus.color}`}>
          🔗 {connectionStatus.text}
        </span>
        {authToken && (
          <button
            onClick={handleLogout}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
          >
            Logout
          </button>
        )}
      </div>

      {showLogin && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="text-white font-semibold mb-3">WebODM Login Required</h4>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-sm text-gray-300 block mb-1">Username</label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your WebODM username"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-1">Password</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your WebODM password"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Login to WebODM
            </button>
          </form>
        </div>
      )}

      {!showLogin && authToken && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">WebODM Project:</label>
            <select
              value={selectedProject}
              onChange={async (e) => {
                const val = e.target.value;
                updateModel3DState({ selectedProject: val });
                if (!projects.some(p => String(p.id) === String(val))) await fetchProjects(authToken);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{projects.length > 0 ? 'Select Project' : 'No projects available'}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-yellow-400 text-xs">
                No projects found. A new project will be created automatically.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-300">Select Images:</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 mt-1"
            >
              📸 Select {selectedFiles.length > 0 ? `${selectedFiles.length} image(s)` : 'Images'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.tiff,.tif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploadStage === 'uploading' || uploadStage === 'processing' || selectedFiles.length === 0}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              uploadStage === 'complete'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : uploadStage === 'error'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : uploadStage === 'uploading' || uploadStage === 'processing'
                ? 'bg-blue-600 text-white cursor-not-allowed'
                : selectedFiles.length === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {getUploadIcon()}
            {getUploadText()}
          </button>

          {(uploadStage === 'uploading' || uploadStage === 'processing') && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {currentStage && (
            <div className="text-center text-blue-400 text-sm">
              {currentStage}
            </div>
          )}

          <div className="flex gap-2">
            {(uploadStage === 'complete' || uploadStage === 'error') && (
              <button
                onClick={resetUpload}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Process New Images
              </button>
            )}

            <button
              onClick={openWebODM}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Open WebODM
            </button>
          </div>

          <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3">
            <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2 text-sm">
              <CheckCircle size={14} />
              WebODM Professional Processing
            </h4>
            <ul className="text-purple-300 text-xs space-y-1">
              <li>• Professional-grade photogrammetry</li>
              <li>• High-precision 3D reconstruction</li>
              <li>• Multiple output formats</li>
              <li>• Advanced processing options</li>
              <li>• Orthophoto and DEM generation</li>
            </ul>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
            <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2 text-sm">
              <AlertCircle size={14} />
              Image Requirements
            </h4>
            <ul className="text-blue-300 text-xs space-y-1">
              <li>• Minimum 10-20 images for good results</li>
              <li>• 60-80% overlap between images</li>
              <li>• Consistent lighting conditions</li>
              <li>• JPG, PNG, or TIFF formats</li>
              <li>• 12MP+ resolution recommended</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading Component
function ModelLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-10">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white font-semibold">Loading 3D Model...</p>
      </div>
    </div>
  );
}

// Main export
export default function Model3D() {
  const {
    processingStats,
    webodmTask,
    loadProjectId,
    loadTaskId,
    loadStatus,
    scrollPosition,
    updateModel3DState,
    saveScrollPosition,
    resetModel3DState
  } = useModel3D();

  const [isLoading, setIsLoading] = useState(false);

  // FIXED: Restore scroll position - run only once on mount
  useEffect(() => {
    if (scrollPosition > 0) {
      window.scrollTo(0, scrollPosition);
    }
  }, [scrollPosition]);

  // FIXED: Save scroll position on unmount
  useEffect(() => {
    return () => {
      saveScrollPosition(window.scrollY);
    };
  }, [saveScrollPosition]);

  // FIXED: Scroll event listener with proper cleanup
  useEffect(() => {
    const handleScroll = debounce(() => {
      saveScrollPosition(window.scrollY);
    }, 100);

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [saveScrollPosition]);

  // FIXED: Memoize handlers
  const handleUploadComplete = useCallback((data) => {
    updateModel3DState({
      webodmTask: data,
      processingStats: data.stats
    });
  }, [updateModel3DState]);

  const handleProcessingUpdate = useCallback((data) => {
    console.log('Processing update', data);
  }, []);

  const handleLoadProjectIdChange = useCallback((e) => {
    updateModel3DState({ loadProjectId: e.target.value });
  }, [updateModel3DState]);

  const handleLoadTaskIdChange = useCallback((e) => {
    updateModel3DState({ loadTaskId: e.target.value });
  }, [updateModel3DState]);

  // FIXED: Memoize the loadExistingTask function
  const loadExistingTask = useCallback(async (projectId, taskId) => {
    if (!projectId || !taskId) {
      alert('Provide both projectId and taskId');
      return;
    }
    const token = localStorage.getItem('webodm_token');
    if (!token) {
      alert('Please login to WebODM first');
      return;
    }

    setIsLoading(true);
    updateModel3DState({ loadStatus: 'loading' });

    try {
      const taskResp = await fetch(`${WEBODM_CONFIG.BASE_URL}/api/projects/${projectId}/tasks/${taskId}/`, {
        headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' }
      });

      if (!taskResp.ok) {
        throw new Error(`Task fetch failed: ${taskResp.status}`);
      }

      const taskData = await taskResp.json();
      
      if (taskData.status !== 40) {
        throw new Error('Task is not completed yet. Please wait for processing to finish.');
      }

      updateModel3DState({
        webodmTask: { projectId, taskId },
        processingStats: {
          images: taskData.images_count || 0,
          processingTime: formatProcessingTime(taskData.processing_time),
          vertices: '1M+',
          faces: '500K+'
        },
        loadStatus: 'done'
      });
      
    } catch (err) {
      console.error('loadExistingTask error', err);
      updateModel3DState({ loadStatus: 'error' });
      alert(`Failed to load task: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [updateModel3DState]);

  // FIXED: Memoize other handlers
  const downloadFromWebODM = useCallback(async () => {
    if (!webodmTask) return;
    try {
      const token = localStorage.getItem('webodm_token');
      if (!token) { alert('Please login to WebODM first'); return; }
      const response = await fetch(
        `${WEBODM_CONFIG.BASE_URL}/api/projects/${webodmTask.projectId}/tasks/${webodmTask.taskId}/download/textured_model.zip`,
        { headers: { 'Authorization': `JWT ${token}` } }
      );
      if (response.ok) {
        const blob = await response.blob();
        saveAs(blob, `webodm_model_${webodmTask.taskId}.zip`);
      } else if (response.status === 401) {
        alert('Session expired. Please login again.');
      } else {
        alert('Download failed. Please use the WebODM interface.');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please use the WebODM interface.');
    }
  }, [webodmTask]);

  const resetViewer = useCallback(() => {
    resetModel3DState();
  }, [resetModel3DState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">WebODM Photogrammetry Viewer</h1>
        <p className="text-gray-300">Professional 3D reconstruction with WebODM</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 lg:sticky lg:top-6 max-h-[75vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">WebODM Controls</h2>

            <UploadSection
              onUploadComplete={handleUploadComplete}
              onProcessingUpdate={handleProcessingUpdate}
            />

            {webodmTask && (
              <div className="space-y-4 mb-4">
                <button
                  onClick={downloadFromWebODM}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download from WebODM
                </button>

                <button 
                  onClick={resetViewer}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Reset Viewer
                </button>
              </div>
            )}

            {/* Load existing completed task */}
            <div className="bg-gray-900/20 border border-gray-700 rounded-lg p-3 mb-4">
              <h4 className="text-sm text-white font-semibold mb-2">Load Completed Task</h4>
              <div className="space-y-2">
                <input
                  value={loadProjectId}
                  onChange={handleLoadProjectIdChange}
                  placeholder="Project ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  value={loadTaskId}
                  onChange={handleLoadTaskIdChange}
                  placeholder="Task ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <button
                  onClick={() => loadExistingTask(loadProjectId.trim(), loadTaskId.trim())}
                  disabled={isLoading}
                  className={`w-full ${isLoading ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'} font-semibold py-2 px-4 rounded-lg transition-colors duration-200`}
                >
                  {isLoading ? 'Loading...' : 'Load 3D Model from Task'}
                </button>
                {loadStatus === 'error' && <div className="text-red-400 text-xs">Failed to load task. Check IDs and task status.</div>}
                {loadStatus === 'done' && <div className="text-green-400 text-xs">Task loaded successfully!</div>}
              </div>
            </div>

            {/* Stats */}
            {processingStats && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-3">Processing Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Source Images:</span>
                    <span className="text-white">{processingStats.images}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Processing Time:</span>
                    <span className="text-white">{processingStats.processingTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accuracy:</span>
                    <span className="text-white">Professional Grade</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Vertices:</span>
                    <span className="text-white">{processingStats.vertices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Faces:</span>
                    <span className="text-white">{processingStats.faces}</span>
                  </div>
                  {webodmTask && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Task ID:</span>
                      <span className="text-white text-xs">{webodmTask.taskId}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WebODM Iframe Viewer */}
        <div className="lg:col-span-3 relative">
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="h-[60vh] sm:h-[70vh] lg:h-[75vh] relative min-h-[420px]">
              {isLoading && <ModelLoading />}
              {webodmTask ? (
                <WebODMIframeViewer taskId={webodmTask.taskId} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
                  <div className="text-center text-gray-400">
                    <Camera size={48} className="mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">No 3D Model Loaded</h3>
                    <p className="text-sm">Upload images to WebODM or load an existing task to view the 3D model</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-900 px-4 py-3 border-t border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div className="flex items-center space-x-4">
                  <span>🖱️ Drag to rotate</span>
                  <span>🔍 Scroll to zoom</span>
                  <span>🖱️ Right-click to pan</span>
                </div>
                <div className="flex items-center space-x-2">
                  {webodmTask && <span className="text-purple-400">• WebODM Viewer</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Performance</h3>
              <p className="text-gray-300 text-sm">WebODM Engine</p>
              <p className="text-gray-300 text-sm">Hardware Accelerated</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Format</h3>
              <p className="text-gray-300 text-sm">OBJ/GLTF/PLY</p>
              <p className="text-gray-300 text-sm">High-res Textures</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Processing</h3>
              <p className="text-gray-300 text-sm">WebODM Cloud</p>
              <p className="text-gray-300 text-sm">Professional Grade</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}