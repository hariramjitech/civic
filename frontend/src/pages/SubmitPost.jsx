import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { 
  MapContainer, TileLayer, Marker, useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Camera, MapPin, EyeOff, Radio, AlertTriangle, 
  Upload, Sparkles, Check, Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';

// Leaflet marker fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map Click Listener
function MapClickHandler({ setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function SubmitPost() {
  const navigate = useNavigate();
  const { isSignedIn } = useCivic();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  
  // Location
  const [position, setPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([13.0827, 80.2707]); // Default Chennai
  const [addressPreview, setAddressPreview] = useState('');
  const [districtPreview, setDistrictPreview] = useState('');

  // Images
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);

  // AI Classification Preview
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Form submission loader
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Sync current location on load
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(coords);
          setMapCenter([coords.lat, coords.lng]);
        },
        (err) => console.log('Geolocation prompt ignored/denied')
      );
    }
  }, []);

  // Whenever position changes, fetch reverse geocode info
  useEffect(() => {
    if (!position) return;
    const lookupAddress = async () => {
      try {
        const res = await api.get(`/contacts/by-location?lat=${position.lat}&lng=${position.lng}`);
        setAddressPreview(res.data.address || '');
        setDistrictPreview(res.data.district || '');
      } catch (err) {
        console.error('Error reverse geocoding location:', err);
      }
    };
    lookupAddress();
  }, [position]);

  // Handle files
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setSelectedFiles(files);
    
    // Set previews
    const filePreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(filePreviews);

    // Trigger AI classification using first image
    analyzeImageWithAI(files[0]);
  };

  const analyzeImageWithAI = async (file) => {
    try {
      setAiLoading(true);
      setAiResult(null);
      
      const formData = new FormData();
      formData.append('image', file);
      if (description) formData.append('description', description);

      const res = await api.post('/ai/classify', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setAiResult(res.data);
      setCategory(res.data.category || 'other');
      toast.success(`AI Classification complete: Category detected as "${res.data.category}"`);
    } catch (err) {
      console.error('AI classification failed:', err);
      toast.error('AI classification failed. You can categorize manually.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast.error('You must join the platform to submit reports.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required.');
      return;
    }
    if (!position) {
      toast.error('Please select the issue coordinates on the map.');
      return;
    }

    try {
      setSubmitting(true);
      
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('lat', position.lat);
      formData.append('lng', position.lng);
      formData.append('category', category);

      selectedFiles.forEach((file) => {
        formData.append('images', file);
      });

      const res = await api.post('/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Anonymous report filed successfully!');
      
      // If AI flagged as duplicate
      if (res.data.post?.isDuplicate) {
        toast.custom((t) => (
          <div className="bg-amber-950 border border-amber-800 text-amber-300 p-4 rounded-xl text-xs flex flex-col gap-2">
            <span className="font-bold">⚠️ Duplicate Report Flagged</span>
            <span>A similar report already exists in this area. It has been merged to avoid feed spam.</span>
          </div>
        ), { duration: 6000 });
      }

      navigate('/feed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
          Report Civic Issue
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Complete anonymity guaranteed. No personal data will be tracked.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side Inputs */}
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Issue Title</label>
            <input
              type="text"
              placeholder="e.g. Broken Water Main on Mount Road"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 text-sm rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              placeholder="Provide exact details (size of pothole, date it started, specific landmarks)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full p-3 text-sm rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          {/* Image Upload Area */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upload Visual Evidence (Up to 5 images)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-gray-800 hover:border-teal-500/50 hover:bg-teal-500/3 bg-gray-950/40 p-6 rounded-xl text-center cursor-pointer transition-all duration-200"
            >
              <Upload className="mx-auto text-gray-500 mb-2" size={24} />
              <span className="text-xs text-gray-400 font-semibold block">Click to browse image files</span>
              <span className="text-[10px] text-gray-600 mt-1 block">Supports PNG, JPG, JPEG (Max 10MB)</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Thumbnail previews */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-850 bg-gray-950">
                    <img src={src} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category Override */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Manual Category (Optional)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
            >
              <option value="roads">Roads & Potholes</option>
              <option value="sanitation">Sanitation & Garbage</option>
              <option value="water">Water Supply & Sewage</option>
              <option value="electricity">Electricity & Streetlights</option>
              <option value="municipal">Municipal & Building Code</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Right Side Map & AI Preview */}
        <div className="space-y-6">
          {/* Map Location Selector */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Pin Location on Map</label>
              <span className="text-[10px] text-gray-500 mt-1 block">Click the map where the issue is located</span>
            </div>

            <div className="h-64 rounded-xl overflow-hidden border border-gray-850">
              <MapContainer 
                center={mapCenter} 
                zoom={11} 
                className="h-full w-full"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <MapClickHandler setPosition={setPosition} />
                {position && <Marker position={[position.lat, position.lng]} />}
              </MapContainer>
            </div>

            {/* Address Preview */}
            {position && (
              <div className="p-3 bg-gray-900/40 rounded-xl border border-gray-900/60 text-xs text-gray-400 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-gray-300">
                  <MapPin size={12} className="text-teal-400" />
                  <span>Resolved District: {districtPreview || 'Resolving...'}</span>
                </div>
                <p className="pl-3.5 leading-relaxed">{addressPreview || 'Resolving exact address...'}</p>
              </div>
            )}
          </div>

          {/* AI Analysis Preview Card */}
          {(aiLoading || aiResult) && (
            <div className="glass-panel p-5 rounded-2xl border-teal-500/20 bg-teal-950/5 space-y-3">
              <div className="flex items-center space-x-2 text-teal-400 font-display font-semibold text-xs uppercase tracking-wider">
                <Sparkles size={14} className="animate-pulse" />
                <span>Gemini AI Analysis Preview</span>
              </div>

              {aiLoading ? (
                <div className="flex items-center space-x-2 text-xs text-gray-400 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>AI reading image pixels...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-850">
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Category</span>
                    <span className="font-bold text-gray-200 capitalize">{aiResult.category}</span>
                  </div>
                  <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-850">
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Severity</span>
                    <span className="font-extrabold text-teal-400 uppercase">{aiResult.severity}</span>
                  </div>
                  <div className="col-span-2 p-2.5 bg-gray-900/60 rounded-xl border border-gray-850">
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">AI Tags</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiResult.tags?.map((tag, idx) => (
                        <span key={idx} className="bg-teal-500/10 text-teal-300 text-[9px] px-1.5 py-0.2 rounded border border-teal-500/20">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center space-x-2 py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:from-gray-800 disabled:to-gray-900 text-gray-900 font-bold text-sm rounded-xl shadow-lg transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-gray-900" />
                <span>Filing Anonymous Case...</span>
              </>
            ) : (
              <>
                <EyeOff size={16} />
                <span>Submit Anonymous Report</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
