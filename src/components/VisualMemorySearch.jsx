import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

const VisualMemorySearch = () => {
  const [screenshots, setScreenshots] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');
  const [imagePreviews, setImagePreviews] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({}); // Store actual file objects
  const [selectedImage, setSelectedImage] = useState(null); // For modal preview
  const [isDragOver, setIsDragOver] = useState(false); // For drag and drop
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false); // For loading state
  const [isDeleting, setIsDeleting] = useState(null); // For delete state (stores filename being deleted)
  const [isMigrating, setIsMigrating] = useState(false); // For migration state
  const [searchFilters, setSearchFilters] = useState({
    minConfidence: 0.0,
    sortBy: 'relevance' // 'relevance', 'date', 'filename', 'confidence'
  });
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef(null);

  const loadScreenshots = useCallback(async () => {
    console.log('🔄 Starting to load screenshots...');
    setIsLoadingScreenshots(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token found:', !!token);
      
      const response = await axios.get('/visual-memory/screenshots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('📡 API Response:', response.data);
      console.log('📸 Screenshots received:', response.data.screenshots?.length || 0);
      
      setScreenshots(response.data.screenshots || []);
      
      // Create previews from actual image data or placeholders
      const newPreviews = {};
      const screenshotsToProcess = response.data.screenshots || [];
      
      console.log('🎨 Creating previews for screenshots...');
      screenshotsToProcess.forEach((screenshot, index) => {
        console.log(`  ${index + 1}. Processing: ${screenshot.filename}`);
        if (!imagePreviews[screenshot.filename]) {
          if (screenshot.image_data) {
            // Use actual image data if available
            console.log(`    Using actual image data for: ${screenshot.filename}`);
            const imageDataUrl = `data:image/jpeg;base64,${screenshot.image_data}`;
            newPreviews[screenshot.filename] = imageDataUrl;
            console.log(`    Real image preview created for: ${screenshot.filename}`);
          } else {
            // Fallback to placeholder
            console.log(`    Creating placeholder for: ${screenshot.filename} (no image data)`);
            const placeholderDataUrl = createScreenshotPlaceholder(screenshot.filename);
            newPreviews[screenshot.filename] = placeholderDataUrl;
            console.log(`    Placeholder created: ${placeholderDataUrl.substring(0, 50)}...`);
          }
        } else {
          console.log(`    Preview already exists for: ${screenshot.filename}`);
        }
      });
      
      // Update image previews with new previews
      if (Object.keys(newPreviews).length > 0) {
        console.log(`🖼️ Updating ${Object.keys(newPreviews).length} new previews...`);
        setImagePreviews(prev => {
          const updated = { ...prev, ...newPreviews };
          console.log('📊 Total previews after update:', Object.keys(updated).length);
          return updated;
        });
      } else {
        console.log('ℹ️ No new previews to create');
      }
      
      console.log('✅ Screenshots loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load screenshots:', error);
      setError(`Failed to load screenshots: ${error.message}`);
    } finally {
      setIsLoadingScreenshots(false);
      console.log('🏁 Finished loading screenshots');
    }
  }, [imagePreviews]);

  // Load screenshots when component mounts
  useEffect(() => {
    console.log('🔄 Component mounted, loading screenshots...');
    loadScreenshots();
  }, [loadScreenshots]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log('📊 State updated:', {
      screenshotsCount: screenshots.length,
      previewsCount: Object.keys(imagePreviews).length,
      previews: Object.keys(imagePreviews)
    });
  }, [screenshots, imagePreviews]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadMessage('');

    try {
      // Generate previews and store files for all images
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          generateImagePreview(file);
          // Store the actual file object for later use
          setUploadedFiles(prev => ({
            ...prev,
            [file.name]: file
          }));
        }
      });

      const formData = new FormData();
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          formData.append('files', file);
        }
      });

      const token = localStorage.getItem('token');
      const response = await axios.post('/visual-memory/upload-screenshots', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadMessage(`Successfully processed ${response.data.results.length} screenshots`);
      setScreenshots(prev => [...prev, ...response.data.results]);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadMessage(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    console.log('🔍 Starting enhanced search for:', searchQuery);
    setIsSearching(true);
    setError('');
    setSearchResults([]); // Clear previous results
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      console.log('🔑 Token found, making enhanced search request...');
      const response = await axios.post('/visual-memory/enhanced-search', 
        { 
          text: searchQuery, 
          max_results: 5 // Backend now always returns 5 results
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `application/json`,
          },
        }
      );

      console.log('📡 Enhanced search response:', response.data);
      let results = response.data.results || [];
      
      // Apply confidence filter
      if (searchFilters.minConfidence > 0) {
        results = results.filter(result => result.confidence_score >= searchFilters.minConfidence);
      }
      
      // Apply sorting
      results = sortSearchResults(results, searchFilters.sortBy);
      
      setSearchResults(results);
      
      // Store image data from search results in imagePreviews for display
      const newPreviews = {};
      results.forEach(result => {
        if (result.image_data && !imagePreviews[result.filename]) {
          console.log(`🖼️ Storing image data for search result: ${result.filename}`);
          newPreviews[result.filename] = `data:image/jpeg;base64,${result.image_data}`;
        }
      });
      
      // Update image previews with new search result images
      if (Object.keys(newPreviews).length > 0) {
        setImagePreviews(prev => ({
          ...prev,
          ...newPreviews
        }));
      }
      
      if (results.length === 0) {
        setError('No screenshots found matching your criteria. Try adjusting your search or filters.');
        console.log('ℹ️ No search results found');
      } else {
        console.log(`✅ Found ${results.length} search results`);
        setError(''); // Clear any previous errors
      }
    } catch (error) {
      console.error('❌ Enhanced search error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Enhanced search failed. Please try again.';
      setError(errorMessage);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      console.log('🏁 Enhanced search completed');
    }
  };

  const sortSearchResults = (results, sortBy) => {
    const sortedResults = [...results];
    
    switch (sortBy) {
      case 'relevance':
        // Already sorted by confidence score from backend
        break;
      case 'date':
        sortedResults.sort((a, b) => new Date(b.upload_time) - new Date(a.upload_time));
        break;
      case 'filename':
        sortedResults.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case 'confidence':
        sortedResults.sort((a, b) => b.confidence_score - a.confidence_score);
        break;
      default:
        break;
    }
    
    return sortedResults;
  };

  const generateSearchSuggestions = (query) => {
    if (!query.trim()) {
      setSearchSuggestions([]);
      return;
    }
    
    // Generate suggestions based on common search patterns
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    // Add query variations
    if (queryLower.includes('error')) {
      suggestions.push('error message', 'bug report', 'issue details', 'problem description');
    }
    if (queryLower.includes('login')) {
      suggestions.push('login form', 'authentication', 'sign in', 'user credentials');
    }
    if (queryLower.includes('dashboard')) {
      suggestions.push('main page', 'overview', 'home screen', 'status page');
    }
    if (queryLower.includes('upload')) {
      suggestions.push('file upload', 'add file', 'import data', 'create new');
    }
    if (queryLower.includes('settings')) {
      suggestions.push('configuration', 'preferences', 'options', 'setup');
    }
    
    // Add common UI elements
    if (queryLower.includes('button')) {
      suggestions.push('click button', 'press button', 'action button', 'submit button');
    }
    if (queryLower.includes('form')) {
      suggestions.push('input form', 'data entry', 'submit form', 'validation');
    }
    if (queryLower.includes('table')) {
      suggestions.push('data table', 'grid view', 'list view', 'information display');
    }
    
    // Filter and limit suggestions
    const filteredSuggestions = suggestions
      .filter(suggestion => suggestion.toLowerCase().includes(queryLower))
      .slice(0, 5);
    
    setSearchSuggestions(filteredSuggestions);
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Generate search suggestions
    generateSearchSuggestions(value);
    
    // Clear error when user starts typing
    if (error && value.trim()) {
      setError('');
    }
    
    // Clear results when search query is empty
    if (!value.trim() && searchResults.length > 0) {
      setSearchResults([]);
    }
    
    // Show/hide suggestions
    setShowSuggestions(value.trim().length > 0 && searchSuggestions.length > 0);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setSearchSuggestions([]);
    // Automatically search with the selected suggestion
    setTimeout(() => handleSearch(), 100);
  };

  const handleFilterChange = (filterType, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    console.log('🧹 Search cleared');
  };

  const handleDeleteScreenshot = async (filename, index) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }
    
    console.log('🗑️ Starting deletion of screenshot:', filename);
    setIsDeleting(filename);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      console.log('🔑 Token found, deleting screenshot...');
      const response = await axios.delete(`/visual-memory/screenshots/${encodeURIComponent(filename)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Delete response:', response.data);
      
      // Remove from local state
      setScreenshots(prev => prev.filter((_, i) => i !== index));
      
      // Remove from image previews
      setImagePreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[filename];
        return newPreviews;
      });
      
      // Remove from uploaded files
      setUploadedFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[filename];
        return newFiles;
      });
      
      setUploadMessage(`Screenshot "${filename}" deleted successfully.`);
      setError(''); // Clear any previous errors
      
      console.log('✅ Screenshot deleted successfully');
    } catch (error) {
      console.error('❌ Delete error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete screenshot. Please try again.';
      setError(errorMessage);
    } finally {
      setIsDeleting(null);
      console.log('🏁 Delete operation completed');
    }
  };

  const migrateExistingScreenshots = async () => {
    console.log('🔄 Starting migration of existing screenshots...');
    setIsMigrating(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      console.log('🔑 Token found, starting migration...');
      const response = await axios.post('/visual-memory/migrate-existing-screenshots', {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Migration response:', response.data);
      
      if (response.data.processed > 0) {
        setUploadMessage(`Migration completed! ${response.data.processed} screenshots updated with real images.`);
        // Reload screenshots to show the new image data
        await loadScreenshots();
      } else {
        setUploadMessage('No screenshots needed migration. All screenshots already have image data.');
      }
      
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('❌ Migration error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Migration failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsMigrating(false);
      console.log('🏁 Migration completed');
    }
  };

  const generateImagePreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreviews(prev => ({
        ...prev,
        [file.name]: e.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageClick = (filename, imageSrc) => {
    setSelectedImage({ filename, src: imageSrc });
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Simulate file input change
      const event = { target: { files } };
      handleFileUpload(event);
    }
  };

  const formatUploadTime = (uploadTime) => {
    const now = new Date();
    const uploadDate = new Date(uploadTime);
    const diffInMinutes = Math.floor((now - uploadDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return uploadDate.toLocaleDateString();
  };

  const createScreenshotPlaceholder = (filename) => {
    try {
      // Check if canvas is supported
      if (typeof document === 'undefined' || !document.createElement) {
        console.warn('Canvas not supported, using fallback');
        return createFallbackPlaceholder(filename);
      }

      const canvas = document.createElement('canvas');
      if (!canvas.getContext) {
        console.warn('Canvas context not supported, using fallback');
        return createFallbackPlaceholder(filename);
      }

      canvas.width = 300;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.warn('Canvas 2D context not supported, using fallback');
        return createFallbackPlaceholder(filename);
      }
      
      // Create a modern screenshot-like background
      const gradient = ctx.createLinearGradient(0, 0, 300, 200);
      gradient.addColorStop(0, '#f8fafc');
      gradient.addColorStop(0.5, '#e2e8f0');
      gradient.addColorStop(1, '#cbd5e0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 300, 200);
      
      // Add a subtle border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 300, 200);
      
      // Add a mock browser bar
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 300, 30);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(0, 30, 300, 1);
      
      // Add mock browser buttons
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(20, 15, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(40, 15, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(60, 15, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add filename text
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Screenshot', 150, 80);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#64748b';
      ctx.fillText(filename.substring(0, 25), 150, 100);
      
      // Add a subtle icon
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('📸', 150, 140);
      
      const dataUrl = canvas.toDataURL();
      console.log(`✅ Created canvas placeholder for: ${filename}`);
      return dataUrl;
    } catch (error) {
      console.error('❌ Error creating canvas placeholder:', error);
      return createFallbackPlaceholder(filename);
    }
  };

  const createFallbackPlaceholder = (filename) => {
    // Create a simple SVG-based placeholder as fallback
    const svg = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#e2e8f0;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#cbd5e0;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="300" height="200" fill="url(#grad)" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="0" y="0" width="300" height="30" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
        <circle cx="20" cy="15" r="6" fill="#ef4444"/>
        <circle cx="40" cy="15" r="6" fill="#f59e0b"/>
        <circle cx="60" cy="15" r="6" fill="#10b981"/>
        <text x="150" y="80" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#475569">Screenshot</text>
        <text x="150" y="100" font-family="Arial" font-size="12" text-anchor="middle" fill="#64748b">${filename.substring(0, 25)}</text>
        <text x="100" y="140" font-family="Arial" font-size="24" text-anchor="middle" fill="#94a3b8">📸</text>
      </svg>
    `;
    
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    console.log(`✅ Created SVG fallback placeholder for: ${filename}`);
    return dataUrl;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-sm text-gray-500">
                Search Images
              </div>
            </div>
            <div className="text-sm text-gray-500">
              AI-Powered Screenshot Search
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-2xl font-bold text-blue-600">{screenshots.length}</div>
              <div className="text-sm text-gray-600">Total Screenshots</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-2xl font-bold text-green-600">{searchResults.length}</div>
              <div className="text-sm text-gray-600">Search Results</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-2xl font-bold text-purple-600">AI</div>
              <div className="text-sm text-gray-600">Powered by Claude</div>
            </div>
          </div>
          
          {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Add Screenshots</h2>
          <span className="text-sm text-gray-500">AI-powered analysis</span>
        </div>
        <div className="space-y-4">
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
            <div className="space-y-3">
              <svg className="mx-auto h-16 w-16 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-gray-600">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50 text-lg"
                >
                  Upload Screenshots
                </button>
                <span className="text-gray-500"> or drag and drop</span>
              </div>
              <p className="text-sm text-gray-500">PNG, JPG, GIF • Up to 10MB each</p>
            </div>
          </div>
          
          {isUploading && (
            <div className="flex items-center justify-center space-x-2 text-blue-600 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="font-medium">Processing screenshots with AI...</span>
            </div>
          )}
          
          {uploadMessage && (
            <div className={`p-4 rounded-lg text-center ${uploadMessage.includes('Error') ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
              {uploadMessage}
            </div>
          )}
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Search Screenshots</h2>
          <span className="text-sm text-gray-500">Natural language queries with AI-powered search</span>
        </div>
        <div className="space-y-4">
          {/* Search Input with Suggestions */}
          <div className="relative">
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  placeholder="Search for anything: 'blue button', 'error message', 'login form'..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => setShowSuggestions(searchQuery.trim().length > 0 && searchSuggestions.length > 0)}
                />
                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-gray-700"
                      >
                        <span className="text-blue-600">🔍</span> {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-colors"
              >
                {isSearching ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Searching...</span>
                  </div>
                ) : (
                  'Search'
                )}
              </button>
              {searchQuery.trim() && (
                <button
                  onClick={clearSearch}
                  disabled={isSearching}
                  className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  title="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Search Filters */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Min Confidence:</label>
                <select
                  value={searchFilters.minConfidence}
                  onChange={(e) => handleFilterChange('minConfidence', parseFloat(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0.0}>Any (0%)</option>
                  <option value={0.3}>Low (30%)</option>
                  <option value={0.5}>Medium (50%)</option>
                  <option value={0.7}>High (70%)</option>
                  <option value={0.8}>Very High (80%)</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Sort By:</label>
                <select
                  value={searchFilters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="relevance">Relevance</option>
                  <option value="confidence">Confidence</option>
                  <option value="date">Date</option>
                  <option value="filename">Filename</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Search Results</h2>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found</span>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 text-sm font-medium transition-colors"
                title="Search again with the same query"
              >
                {isSearching ? 'Searching...' : 'Search Again'}
              </button>
            </div>
          </div>
          
          {/* Results Summary */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-4 text-sm text-blue-800">
              <span>📊 Showing top 5 most relevant results</span>
              <span>🎯 Sorted by: {searchFilters.sortBy}</span>
              <span>🔍 Query: "{searchQuery}"</span>
              <span>✨ AI-powered relevance scoring</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {searchResults.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex space-x-4">
                  <div className="flex-shrink-0">
                    {result.image_data ? (
                      // Use actual image data from search result
                      <img 
                        src={`data:image/jpeg;base64,${result.image_data}`}
                        alt={result.filename}
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(result.filename, `data:image/jpeg;base64,${result.image_data}`)}
                      />
                    ) : imagePreviews[result.filename] ? (
                      // Fallback to stored previews
                      <img 
                        src={imagePreviews[result.filename]} 
                        alt={result.filename}
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(result.filename, imagePreviews[result.filename])}
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-xs text-center">Loading preview...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-gray-900">{result.filename}</h3>
                      <div className="flex items-center space-x-2">
                        {/* Confidence Score with Color Coding */}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.confidence_score >= 0.8 
                            ? 'bg-green-100 text-green-800' 
                            : result.confidence_score >= 0.6 
                            ? 'bg-blue-100 text-blue-800'
                            : result.confidence_score >= 0.4 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {Math.round(result.confidence_score * 100)}% match
                        </span>
                        {/* Result Rank */}
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {/* Text Content with Highlighting */}
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Content:</span> 
                        <span className="ml-2">
                          {result.text_content.length > 150 
                            ? `${result.text_content.substring(0, 150)}...` 
                            : result.text_content}
                        </span>
                      </div>
                      
                      {/* Visual Description */}
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Visual:</span> 
                        <span className="ml-2">
                          {result.visual_description.length > 100 
                            ? `${result.visual_description.substring(0, 100)}...` 
                            : result.visual_description}
                        </span>
                      </div>
                      
                      {/* Metadata Row */}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <span>📅 Uploaded {formatUploadTime(result.upload_time)}</span>
                        <span>📁 {result.filename.split('.').pop().toUpperCase()} file</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screenshots Gallery */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Screenshots</h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {screenshots.length} {screenshots.length === 1 ? 'screenshot' : 'screenshots'}
            </span>
          </div>
          <button
            onClick={loadScreenshots}
            disabled={isLoadingScreenshots}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoadingScreenshots ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading...</span>
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoadingScreenshots ? (
            // Loading skeleton
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="w-full h-48 bg-gray-200 rounded-lg mb-3"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))
          ) : screenshots.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No screenshots yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by uploading some screenshots above.</p>
            </div>
          ) : (
            screenshots.map((screenshot, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {/* Image Preview */}
                <div className="mb-3">
                  {imagePreviews[screenshot.filename] ? (
                    <img 
                      src={imagePreviews[screenshot.filename]} 
                      alt={screenshot.filename}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => handleImageClick(screenshot.filename, imagePreviews[screenshot.filename])}
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">No preview available</span>
                    </div>
                  )}
                </div>
                
                {/* Screenshot Info */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm truncate" title={screenshot.filename}>
                    {screenshot.filename}
                  </h3>
                  <div className="text-xs text-gray-500">
                    Uploaded: {formatUploadTime(screenshot.upload_time)}
                  </div>
                  {screenshot.text_content && (
                    <div className="text-xs text-gray-600 line-clamp-2">
                      {screenshot.text_content.substring(0, 100)}...
                    </div>
                  )}
                  
                  {/* File Info and Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <span className="capitalize">
                        {screenshot.filename.split('.').pop()?.toUpperCase() || 'Unknown'} file
                      </span>
                      {uploadedFiles[screenshot.filename] && (
                        <span>
                          {(uploadedFiles[screenshot.filename].size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteScreenshot(screenshot.filename, index)}
                      disabled={isDeleting === screenshot.filename}
                      className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors disabled:opacity-50"
                      title="Delete screenshot"
                    >
                      {isDeleting === screenshot.filename ? (
                        <div className="flex items-center space-x-1">
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-red-500"></div>
                          <span>Deleting...</span>
                        </div>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">{selectedImage.filename}</h3>
              <button
                onClick={closeImageModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <img
                src={selectedImage.src}
                alt={selectedImage.filename}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>AI-Powered Screenshot Analysis</p>
            <p className="mt-1">Built with React, FastAPI, and Claude AI</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualMemorySearch;
