import React, { useState, useRef, useEffect } from 'react';

const ThermalAnomalyDetector = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  const rgbImageRef = useRef(null);
  const thermalImageRef = useRef(null);
  const rgbUploadRef = useRef(null);
  const thermalUploadRef = useRef(null);

  // Server configuration
  const API_BASE = process.env.NODE_ENV === 'production' 
    ? 'https://your-flask-api.com' 
    : 'http://localhost:5000';

  const PHOTO_SERVER_BASE = process.env.NODE_ENV === 'production'
    ? 'https://your-websocket-server.com'
    : 'http://localhost:8080';

  // Fetch photos from server
  const fetchPhotos = async () => {
    try {
      setPhotosLoading(true);
      const response = await fetch(`${PHOTO_SERVER_BASE}/photos`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      
      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos from server');
    } finally {
      setPhotosLoading(false);
    }
  };

  // Load photos when component mounts
  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleImageUpload = (event, imageType) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (imageType === 'rgb') {
          rgbImageRef.current.src = e.target.result;
        } else {
          thermalImageRef.current.src = e.target.result;
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const runPrediction = async () => {
    if (!rgbImageRef.current.src || !thermalImageRef.current.src) {
      setError('Please upload both RGB and thermal images');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResults(null);

      const requestData = {
        rgb_image: rgbImageRef.current.src,
        thermal_image: thermalImageRef.current.src
      };

      const response = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Prediction failed');
      }

      setResults(data);

    } catch (err) {
      console.error('Prediction error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${PHOTO_SERVER_BASE}/health`);
      const data = await response.json();
      alert(`Server: ${data.status}\nModel: ${data.model_loaded ? 'Loaded' : 'Not Loaded'}`);
    } catch (err) {
      alert('Server not responding');
    }
  };

  const getVisualizationTitle = (key) => {
    const titles = {
      'original_rgb': 'Original RGB',
      'original_thermal': 'Original Thermal',
      'rgb_reconstruction': 'RGB Reconstruction',
      'thermal_reconstruction': 'Thermal Reconstruction',
      'reconstruction_error': 'Error Map',
      'segmentation_mask': 'Segmentation Mask',
      'anomaly_mask': 'Anomaly Mask',
      'anomaly_overlay': 'Anomaly Overlay'
    };
    return titles[key] || key;
  };

  const getVisualizationDescription = (key) => {
    const descriptions = {
      'original_rgb': 'Uploaded RGB image',
      'original_thermal': 'Uploaded thermal image',
      'rgb_reconstruction': 'Model RGB reconstruction',
      'thermal_reconstruction': 'Model thermal reconstruction',
      'reconstruction_error': 'Combined reconstruction error',
      'segmentation_mask': 'Model segmentation output',
      'anomaly_mask': 'Detected anomaly regions',
      'anomaly_overlay': 'Anomalies overlaid on RGB'
    };
    return descriptions[key] || '';
  };

  const openPhotoModal = (photo) => {
    setSelectedPhoto(photo);
  };

  const closePhotoModal = () => {
    setSelectedPhoto(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="h-screen overflow-auto bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h1 className="text-4xl font-bold text-center mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Thermal Anomaly Detector
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Complete visualization - All outputs like Colab notebook
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={checkServerHealth}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
            >
              Check Server Status
            </button>
            <button
              onClick={fetchPhotos}
              disabled={photosLoading}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed"
            >
              {photosLoading ? 'Refreshing...' : 'Refresh Photos'}
            </button>
          </div>
        </div>

        {/* Photos Gallery Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-full p-3 mr-3">
                <span className="text-2xl">📸</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">Recent Photos</h2>
            </div>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              {photos.length} photos
            </span>
          </div>

          {photosLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading photos...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <span className="text-6xl mb-4 block">📷</span>
              <p className="text-gray-600 text-lg">No photos available</p>
              <p className="text-gray-500 text-sm mt-2">Photos from drone missions will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <div 
                  key={photo.filename} 
                  className="bg-gray-50 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105"
                  onClick={() => openPhotoModal(photo)}
                >
                  <div className="relative">
                    <img
                      src={`${PHOTO_SERVER_BASE}${photo.url}`}
                      alt={photo.filename}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5YzljOWMiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjM1ZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      {formatFileSize(photo.size)}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-800 truncate" title={photo.filename}>
                      {photo.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(photo.mtime)}
                    </p>
                    {photo.metadata && (
                      <div className="mt-2 text-xs text-gray-600">
                        {photo.metadata.missionName && (
                          <p>Mission: {photo.metadata.missionName}</p>
                        )}
                        {photo.metadata.cameraIndex !== undefined && (
                          <p>Camera: {photo.metadata.cameraIndex}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rest of your existing component remains the same */}
        {/* Image Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-blue-100 rounded-full p-3">
                <span className="text-2xl">🎨</span>
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2 text-center text-gray-800">RGB Image</h2>
            <input
              type="file"
              ref={rgbUploadRef}
              onChange={(e) => handleImageUpload(e, 'rgb')}
              accept="image/*"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
            />
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-2 bg-gray-50">
              <img
                ref={rgbImageRef}
                className="w-full h-64 object-cover rounded-lg"
                alt="RGB input"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-orange-100 rounded-full p-3">
                <span className="text-2xl">🌡️</span>
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2 text-center text-gray-800">Thermal Image</h2>
            <input
              type="file"
              ref={thermalUploadRef}
              onChange={(e) => handleImageUpload(e, 'thermal')}
              accept="image/*"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 mb-4"
            />
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-2 bg-gray-50">
              <img
                ref={thermalImageRef}
                className="w-full h-64 object-cover rounded-lg"
                alt="Thermal input"
              />
            </div>
          </div>
        </div>

        {/* Prediction Button */}
        <div className="text-center mb-8">
          <button
            onClick={runPrediction}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 px-12 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing All Visualizations...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Generate All Visualizations
              </span>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong className="text-red-800 font-semibold">Error:</strong>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {results && (
          <div className="space-y-8">
            {/* Anomaly Results Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-green-100 rounded-full p-3 mr-3">
                  <span className="text-2xl">🔬</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-800">Detection Results</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">Anomaly Score</h3>
                  <p className="text-4xl font-bold text-blue-600 mb-2">
                    {results.anomaly_score?.toFixed(4)}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(results.anomaly_score * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className={`rounded-xl p-6 ${
                  results.has_anomaly 
                    ? 'bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500' 
                    : 'bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500'
                }`}>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">Status</h3>
                  <p className={`text-2xl font-bold mb-2 ${
                    results.has_anomaly ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {results.has_anomaly ? 'ANOMALY DETECTED' : 'NO ANOMALY'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {results.has_anomaly ? 'Anomalies detected in images' : 'No significant anomalies'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">Anomaly Coverage</h3>
                  <p className="text-4xl font-bold text-purple-600 mb-2">
                    {results.anomaly_percentage?.toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    Percentage of image with anomalies
                  </p>
                </div>
              </div>
            </div>

            {/* All Visualizations - 2x4 Grid like Colab */}
            {results.visualizations && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center justify-center mb-6">
                  <div className="bg-purple-100 rounded-full p-3 mr-3">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800">Complete Visualizations</h2>
                </div>

                <p className="text-center text-gray-600 mb-8">
                  {results.visualization_count} visualization images generated
                </p>

                {/* First Row: Original Images and Reconstructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {['original_rgb', 'original_thermal', 'rgb_reconstruction', 'thermal_reconstruction'].map(key => (
                    results.visualizations[key] && (
                      <div key={key} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 shadow-md">
                        <h3 className="font-bold text-lg text-gray-800 mb-2 text-center">
                          {getVisualizationTitle(key)}
                        </h3>
                        <p className="text-xs text-gray-500 text-center mb-3">
                          {getVisualizationDescription(key)}
                        </p>
                        <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                          <img
                            src={results.visualizations[key]}
                            alt={getVisualizationTitle(key)}
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      </div>
                    )
                  ))}
                </div>

                {/* Second Row: Results and Masks */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['reconstruction_error', 'segmentation_mask', 'anomaly_mask', 'anomaly_overlay'].map(key => (
                    results.visualizations[key] && (
                      <div key={key} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 shadow-md">
                        <h3 className="font-bold text-lg text-gray-800 mb-2 text-center">
                          {getVisualizationTitle(key)}
                        </h3>
                        <p className="text-xs text-gray-500 text-center mb-3">
                          {getVisualizationDescription(key)}
                        </p>
                        <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                          <img
                            src={results.visualizations[key]}
                            alt={getVisualizationTitle(key)}
                            className="w-full h-48 object-cover"
                          />
                        </div>
                        {key === 'reconstruction_error' && (
                          <p className="text-xs text-center mt-2 text-blue-600">
                            Score: {results.anomaly_score?.toFixed(4)}
                          </p>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photo Modal */}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl max-h-full overflow-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">{selectedPhoto.filename}</h3>
                  <button
                    onClick={closePhotoModal}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <img
                  src={`${PHOTO_SERVER_BASE}${selectedPhoto.url}`}
                  alt={selectedPhoto.filename}
                  className="w-full h-auto max-h-96 object-contain rounded-lg"
                />
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Size:</strong> {formatFileSize(selectedPhoto.size)}
                  </div>
                  <div>
                    <strong>Date:</strong> {formatDate(selectedPhoto.mtime)}
                  </div>
                  {selectedPhoto.metadata && (
                    <>
                      {selectedPhoto.metadata.missionName && (
                        <div>
                          <strong>Mission:</strong> {selectedPhoto.metadata.missionName}
                        </div>
                      )}
                      {selectedPhoto.metadata.cameraIndex !== undefined && (
                        <div>
                          <strong>Camera Index:</strong> {selectedPhoto.metadata.cameraIndex}
                        </div>
                      )}
                      {selectedPhoto.metadata.source && (
                        <div>
                          <strong>Source:</strong> {selectedPhoto.metadata.source}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🔬</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Processing Images</h3>
              <p className="text-gray-600">Generating complete visualizations...</p>
              <div className="mt-4 text-sm text-gray-500">
                8 visualization outputs like Colab notebook
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-gray-500 text-sm">
          <p>Complete Thermal Anomaly Detection • Colab-style Outputs</p>
        </div>
      </div>
    </div>
  );
};

export default ThermalAnomalyDetector;