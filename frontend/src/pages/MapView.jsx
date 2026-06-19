import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, AlertTriangle, ShieldCheck, Sliders, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// Leaflet Icon setup fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom icons based on severity
const createMarkerIcon = (severity) => {
  const colorMap = {
    critical: '#ef4444', // Red
    high: '#f97316',     // Orange
    medium: '#f59e0b',   // Yellow
    low: '#14b8a6',      // Teal
  };
  const color = colorMap[severity] || '#3b82f6';
  
  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 0 10px ${color}80;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

// Component to dynamically focus/pan map center
function MapFocusHandler({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13, { animate: true, duration: 1 });
    }
  }, [center]);
  return null;
}

export default function MapView() {
  const { isSignedIn } = useCivic();
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [focusedLocation, setFocusedLocation] = useState([13.0827, 80.2707]); // Default Chennai
  const [mapZoom, setMapZoom] = useState(11);

  const categories = [
    { value: 'roads', label: 'Roads & Potholes' },
    { value: 'sanitation', label: 'Sanitation' },
    { value: 'water', label: 'Water & Sewage' },
    { value: 'electricity', label: 'Electricity' },
    { value: 'municipal', label: 'Municipal' },
    { value: 'other', label: 'Other' }
  ];

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      // Fetch posts for map mapping to have full metadata (e.g. title, _id)
      const res = await api.get('/posts', { params: { limit: 100 } });
      
      // Filter out posts that don't have coordinates
      const mapped = res.data.posts.filter(p => p.location && p.location.coordinates);
      setPoints(mapped);
      
      // Zoom to first point if available
      if (mapped.length > 0) {
        const first = mapped[0].location.coordinates;
        setFocusedLocation([first[1], first[0]]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load GIS Map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const filteredPoints = points.filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterSeverity && p.severity !== filterSeverity) return false;
    return true;
  });

  const handleFocusPoint = (p) => {
    const lat = p.location.coordinates[1];
    const lng = p.location.coordinates[0];
    setFocusedLocation([lat, lng]);
    setMapZoom(14);
  };

  return (
    <div className="space-y-6 h-[80vh] flex flex-col">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Tamil Nadu GIS Infrastructure Map
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Browse complaint hotspots and track resolution progress across regions.
          </p>
        </div>

        {/* Map filter controls */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-xs rounded-lg p-2.5 text-gray-300 focus:outline-none focus:border-teal-500 w-1/2 sm:w-36"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-xs rounded-lg p-2.5 text-gray-300 focus:outline-none focus:border-teal-500 w-1/2 sm:w-36"
          >
            <option value="">All Severities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      </div>

      {/* Main Map Split Pane */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 rounded-2xl border border-gray-900 overflow-hidden bg-gray-950">
        
        {/* Left Side: Sidebar List */}
        <div className="p-4 border-r border-gray-900 overflow-y-auto space-y-4 lg:col-span-1 h-[25vh] lg:h-auto order-last lg:order-first">
          <div className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider flex items-center justify-between">
            <span>List of Incidents ({filteredPoints.length})</span>
            <span className="text-[9px] bg-teal-500/10 border border-teal-500/20 text-teal-400 px-1 rounded">Live</span>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(n => <div key={n} className="h-14 bg-gray-900 rounded-lg" />)}
            </div>
          ) : filteredPoints.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-4">No mapped reports match filter settings.</p>
          ) : (
            <div className="space-y-2">
              {filteredPoints.map((p) => (
                <button
                  key={p._id}
                  onClick={() => handleFocusPoint(p)}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-900 bg-gray-950/40 hover:bg-gray-900 hover:border-gray-800 transition-all text-xs space-y-1 block group"
                >
                  <div className="flex items-center justify-between font-bold text-gray-300">
                    <span className="truncate group-hover:text-teal-400 transition-colors">{p.title}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      backgroundColor: p.severity === 'critical' ? '#ef4444' : p.severity === 'high' ? '#f97316' : p.severity === 'medium' ? '#f59e0b' : '#14b8a6'
                    }} />
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center justify-between">
                    <span className="capitalize">{p.category}</span>
                    <span className="uppercase text-[9px]">{p.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Map Canvas */}
        <div className="lg:col-span-3 h-[45vh] lg:h-auto relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-10">
              <span className="text-xs text-gray-400 font-display">Initializing Canvas Tile Layers...</span>
            </div>
          ) : null}

          <MapContainer
            center={focusedLocation}
            zoom={mapZoom}
            className="h-full w-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            
            <MapFocusHandler center={focusedLocation} zoom={mapZoom} />

            {filteredPoints.map((p) => {
              const [lng, lat] = p.location.coordinates;
              return (
                <Marker
                  key={p._id}
                  position={[lat, lng]}
                  icon={createMarkerIcon(p.severity)}
                >
                  <Popup>
                    <div className="text-xs space-y-1.5 min-w-[150px]">
                      <div className="font-bold font-display text-gray-100 flex items-center justify-between">
                        <span>{p.title}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{p.description}</p>
                      
                      <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-gray-850">
                        <span className="uppercase tracking-wider font-extrabold text-teal-400">{p.status}</span>
                        <Link to={`/posts/${p._id}`} className="hover:underline flex items-center space-x-0.5 text-teal-300">
                          <span>Detail</span>
                          <ExternalLink size={8} />
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

      </div>
    </div>
  );
}
