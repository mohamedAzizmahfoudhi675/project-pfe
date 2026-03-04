import React, { useState, useRef } from 'react';
import axios from 'axios';
import './ThermalAnomaly.css';

/**
 * Base URL for API endpoints.
 * Using relative path because Flask serves both frontend and API from the same origin.
 * @constant {string}
 */
const API_BASE = '/api';

/**
 * ThermalAnomaly Component
 *
 * This component provides a user interface for thermal anomaly detection using a YOLOv8 model.
 * Users can upload a thermal image, adjust the confidence threshold, and receive processed images
 * with bounding boxes around detected anomalies. It also displays detection statistics and allows
 * downloading the result.
 *
 * Features:
 * - Upload thermal image (PNG, JPG, JPEG, BMP, TIFF) up to 16MB.
 * - Adjust confidence threshold slider.
 * - Send image to Flask API for detection.
 * - Display original and processed images side by side.
 * - Show detection statistics (count, average confidence, classes).
 * - Download processed image.
 * - Check server health on load.
 *
 * @returns {JSX.Element} The rendered component.
 */
export default function ThermalAnomaly() {
  // ========== State ==========
  /** @type {[string|null, Function]} Base64‑encoded original image data. */
  const [selectedImage, setSelectedImage] = useState(null);

  /** @type {[string|null, Function]} Base64‑encoded processed image with bounding boxes. */
  const [processedImage, setProcessedImage] = useState(null);

  /** @type {[Array, Function]} List of detection objects (class, confidence, bbox). */
  const [detections, setDetections] = useState([]);

  /** @type {[boolean, Function]} Loading flag during API call. */
  const [loading, setLoading] = useState(false);

  /** @type {[number, Function]} Confidence threshold (0.1 to 0.9). */
  const [confidence, setConfidence] = useState(0.3);

  /** @type {[Object|null, Function]} Statistics object (total, avgConfidence, maxConfidence, classes). */
  const [stats, setStats] = useState(null);

  /** @type {[string|null, Function]} Error message to display. */
  const [error, setError] = useState(null);

  /** @type {[string, Function]} Server health status: 'checking', 'healthy', 'no-model', 'offline'. */
  const [serverStatus, setServerStatus] = useState('checking');

  /** @type {React.RefObject} Reference to the hidden file input element. */
  const fileInputRef = useRef(null);

  // ========== Effects ==========
  /**
   * Check server health on component mount.
   */
  React.useEffect(() => {
    checkServerHealth();
  }, []);

  // ========== API Interaction ==========
  /**
   * Checks the health of the backend server.
   * Sets serverStatus based on response or error.
   */
  const checkServerHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE}/health`);
      if (response.data.model_loaded) {
        setServerStatus('healthy');
      } else {
        setServerStatus('no-model');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setServerStatus('offline');
    }
  };

  /**
   * Sends the selected image to the /detect endpoint for processing.
   * Updates processedImage, detections, and stats on success.
   * Handles various error conditions (timeout, connection, server error).
   */
  const processImage = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);

    try {
      // Convert base64 image to a Blob for FormData.
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('image', blob, 'thermal_image.jpg');
      formData.append('confidence', confidence.toString());

      const result = await axios.post(`${API_BASE}/detect`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });

      const data = result.data;

      if (data.success) {
        setProcessedImage(data.processed_image);
        setDetections(data.detections || []);

        // Calculate statistics from detections.
        if (data.detections && data.detections.length > 0) {
          const confidences = data.detections.map(d => d.confidence);
          const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
          const maxConfidence = Math.max(...confidences);
          const classes = [...new Set(data.detections.map(d => d.class_name))];

          setStats({
            totalDetections: data.detections.length,
            avgConfidence,
            maxConfidence,
            classes,
            timestamp: data.timestamp
          });
        }
      } else {
        setError(data.error || 'Failed to process image');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.code === 'ECONNABORTED') {
        setError('Request timeout. Please try again.');
      } else if (error.response) {
        // Server responded with an error status.
        setError(error.response.data.error || 'Server error occurred');
      } else if (error.request) {
        // Request was made but no response received.
        setError('Cannot connect to server. Make sure the Flask server is running.');
      } else {
        // Something else happened.
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // ========== UI Handlers ==========
  /**
   * Handles file selection from the hidden file input.
   * Reads the file as a data URL (base64) and sets selectedImage.
   * Also resets processed results and clears any error.
   * Performs a file size check (max 16 MB) to match server limit.
   *
   * @param {Event} event - The file input change event.
   */
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (max 16MB - matches your Flask config)
      if (file.size > 16 * 1024 * 1024) {
        setError('File size too large. Please select an image under 16MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setProcessedImage(null);
        setDetections([]);
        setStats(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Programmatically clicks the hidden file input to open the file picker.
   */
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  /**
   * Resets the entire component state to its initial values.
   * Also clears the file input value.
   */
  const resetAll = () => {
    setSelectedImage(null);
    setProcessedImage(null);
    setDetections([]);
    setStats(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Downloads the processed image (with bounding boxes) as a JPG file.
   * Creates a temporary link and triggers a download.
   */
  const downloadProcessedImage = () => {
    if (processedImage) {
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = `thermal_anomaly_detection_${new Date().getTime()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ========== Helper Functions ==========
  /**
   * Returns a status message and type based on serverStatus.
   * Used to display a badge in the header.
   * @returns {Object} { message: string, type: string } – type can be 'success', 'warning', 'error', 'info'.
   */
  const getStatusMessage = () => {
    switch (serverStatus) {
      case 'healthy':
        return { message: '✅ Server is running and model is loaded', type: 'success' };
      case 'no-model':
        return { message: '⚠️ Server is running but no model loaded', type: 'warning' };
      case 'offline':
        return { message: '❌ Cannot connect to server', type: 'error' };
      case 'checking':
        return { message: '🔍 Checking server status...', type: 'info' };
      default:
        return { message: '❓ Unknown server status', type: 'error' };
    }
  };

  const status = getStatusMessage();

  // ========== Render ==========
  return (
    <div className="thermal-anomaly-page">
      {/* Header with title and status badge */}
      <div className="page-header">
        <h1>🔥 Thermal Anomaly Detection</h1>
        <p>AI-powered thermal image analysis using YOLOv8</p>
        <div className={`status-badge status-${status.type}`}>
          {status.message}
        </div>
      </div>

      <div className="page-content">
        {/* Server Status Troubleshooting */}
        {serverStatus !== 'healthy' && (
          <div className="status-card">
            <h3>Server Connection</h3>
            <p>{status.message}</p>
            {serverStatus === 'offline' && (
              <div className="troubleshooting">
                <h4>To start the server:</h4>
                <ol>
                  <li>Ensure your trained model is at: <code>models/best.pt</code></li>
                  <li>Run: <code>python app.py</code></li>
                  <li>Wait for "✅ Thermal Anomaly Model Loaded Successfully!" message</li>
                </ol>
              </div>
            )}
            {serverStatus === 'no-model' && (
              <div className="troubleshooting">
                <h4>Model not loaded:</h4>
                <p>Please ensure <code>models/best.pt</code> exists and is a valid YOLO model.</p>
              </div>
            )}
          </div>
        )}

        {/* Upload and Confidence Controls */}
        <div className="controls-card">
          <div className="upload-section">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button 
              onClick={triggerFileInput} 
              className="btn btn-primary"
              disabled={serverStatus !== 'healthy'}
            >
              📁 Upload Thermal Image
            </button>
            
            {selectedImage && (
              <div className="confidence-control">
                <label>Confidence Threshold: <strong>{confidence}</strong></label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  <span>More Sensitive (0.1)</span>
                  <span>More Strict (0.9)</span>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons (Detect, Download, Reset) */}
          {selectedImage && (
            <div className="action-buttons">
              <button 
                onClick={processImage} 
                disabled={loading || serverStatus !== 'healthy'}
                className="btn btn-detect"
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Processing...
                  </>
                ) : (
                  '🚀 Detect Anomalies'
                )}
              </button>
              
              {processedImage && (
                <button onClick={downloadProcessedImage} className="btn btn-download">
                  💾 Download Result
                </button>
              )}
              
              <button onClick={resetAll} className="btn btn-secondary">
                🔄 Reset
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Image Display Section */}
        {selectedImage && (
          <div className="image-container">
            <div className="image-section">
              <div className="image-wrapper">
                <h3>Original Image</h3>
                <img src={selectedImage} alt="Original thermal" className="image-preview" />
                {selectedImage && (
                  <div className="image-info">
                    <small>Supported formats: PNG, JPG, JPEG, BMP, TIFF</small>
                  </div>
                )}
              </div>
              
              <div className="image-wrapper">
                <h3>Detection Results</h3>
                {processedImage ? (
                  <>
                    <img src={processedImage} alt="Processed with detections" className="image-preview" />
                    {stats && (
                      <div className="image-stats">
                        <div className="stat-item">
                          <span className="stat-label">Detections:</span>
                          <span className="stat-value">{stats.totalDetections}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Confidence:</span>
                          <span className="stat-value">{(stats.avgConfidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Classes Found:</span>
                          <span className="stat-value">{stats.classes.join(', ')}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="placeholder">
                    {loading ? (
                      <div className="loading-placeholder">
                        <div className="spinner large"></div>
                        <p>AI is analyzing the image for thermal anomalies...</p>
                        <small>This may take a few seconds</small>
                      </div>
                    ) : (
                      <div className="placeholder-text">
                        <p>Click "Detect Anomalies" to analyze this thermal image</p>
                        <small>AI will identify and highlight thermal anomalies with bounding boxes</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detection Results and Statistics */}
        {detections.length > 0 && (
          <div className="results-section">
            <h3>📊 Detection Results</h3>
            
            {/* Statistics Cards */}
            {stats && (
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-number">{stats.totalDetections}</div>
                  <div className="stat-label">Total Detections</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{(stats.avgConfidence * 100).toFixed(1)}%</div>
                  <div className="stat-label">Average Confidence</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{(stats.maxConfidence * 100).toFixed(1)}%</div>
                  <div className="stat-label">Highest Confidence</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats.classes.length}</div>
                  <div className="stat-label">Classes Detected</div>
                </div>
              </div>
            )}
            
            {/* Detections List */}
            <div className="detections-list">
              <h4>Detected Anomalies:</h4>
              {detections.map((detection, index) => (
                <div key={index} className="detection-item">
                  <div className="detection-header">
                    <span className="detection-class">
                      {detection.class_name}
                    </span>
                    <span className="detection-confidence">
                      {(detection.confidence * 100).toFixed(1)}% confidence
                    </span>
                  </div>
                  <div className="detection-details">
                    <span>Bounding Box: </span>
                    <code>
                      [{detection.bbox.map(coord => coord.toFixed(0)).join(', ')}]
                    </code>
                  </div>
                </div>
              ))}
            </div>

            {stats?.timestamp && (
              <div className="timestamp">
                Analysis completed: {new Date(stats.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Welcome Section (shown when no image is selected) */}
        {!selectedImage && serverStatus === 'healthy' && (
          <div className="welcome-section">
            <div className="welcome-card">
              <h2>Thermal Anomaly Detection</h2>
              <p>Advanced AI-powered detection of thermal anomalies using YOLOv8 deep learning</p>
              
              <div className="instructions">
                <h3>🚀 How to Use:</h3>
                <ol>
                  <li><strong>Upload</strong> a thermal image (PNG, JPG, JPEG, BMP, TIFF)</li>
                  <li><strong>Adjust</strong> the confidence threshold to balance sensitivity vs precision</li>
                  <li><strong>Click</strong> "Detect Anomalies" to analyze with AI</li>
                  <li><strong>View</strong> detected anomalies with bounding boxes and confidence scores</li>
                  <li><strong>Download</strong> the annotated result image for reporting</li>
                </ol>
              </div>
              
              <div className="model-info">
                <h3>🤖 AI Model Information</h3>
                <div className="model-stats">
                  <div className="model-stat">
                    <span className="label">Model Architecture:</span>
                    <span className="value">YOLOv8</span>
                  </div>
                  <div className="model-stat">
                    <span className="label">Input Resolution:</span>
                    <span className="value">640×640px</span>
                  </div>
                  <div className="model-stat">
                    <span className="label">Supported Formats:</span>
                    <span className="value">PNG, JPG, JPEG, BMP, TIFF</span>
                  </div>
                  <div className="model-stat">
                    <span className="label">Max File Size:</span>
                    <span className="value">16 MB</span>
                  </div>
                </div>
              </div>

              <div className="api-info">
                <h3>🔧 API Endpoints</h3>
                <div className="endpoints">
                  <div className="endpoint">
                    <code>POST /api/detect</code>
                    <span>Process image and detect anomalies</span>
                  </div>
                  <div className="endpoint">
                    <code>GET /api/health</code>
                    <span>Check server and model status</span>
                  </div>
                  <div className="endpoint">
                    <code>GET /api/info</code>
                    <span>Get model information</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
