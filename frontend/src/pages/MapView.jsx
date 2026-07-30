import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, ExternalLink, RefreshCw, Calendar, ChevronDown, ChevronRight,
  Navigation, Flame, AlertTriangle, ShieldCheck, Layers, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import { motion } from 'framer-motion';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SEV_COLORS = { critical: '#e11d48', high: '#ea580c', medium: '#ca8a04', low: '#16a34a' };

const createIcon = (severity) => L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${SEV_COLORS[severity] || '#6366f1'};border:3px solid #ffffff;box-shadow:0 2px 10px ${SEV_COLORS[severity] || '#6366f1'}80;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      const panes = map.getPanes ? map.getPanes() : null;
      if (panes && panes.mapPane) {
        try {
          map.setView(center, zoom, { animate: true, duration: 0.8 });
        } catch (e) {
          console.warn("Leaflet setView error in MapSync:", e);
        }
      }
    }
  }, [center, zoom, map]);
  return null;
}

const CATEGORIES = ['', 'roads', 'sanitation', 'water', 'electricity', 'municipal', 'other'];
const SEVERITIES  = ['', 'critical', 'high', 'medium', 'low'];

const getPlainTextPreview = (value = '', maxLength = 90) => {
  const plain = String(value)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/[_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
};

export default function MapView() {
  const [points, setPoints]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterCat, setFilterCat]       = useState('');
  const [filterSev, setFilterSev]       = useState('');
  const [activeTab, setActiveTab]       = useState('');
  const [focus, setFocus]               = useState([13.0827, 80.2707]);
  const [zoom, setZoom]                 = useState(10);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      const res = await api.get('/posts', { params: { limit: 200 } });
      const mapped = res.data.posts.filter(p => p.location?.coordinates);
      setPoints(mapped);
      if (mapped.length > 0) {
        const [lng, lat] = mapped[0].location.coordinates;
        setFocus([lat, lng]);
        setZoom(11);
      }
    } catch { toast.error('Failed to load map data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPoints(); }, []);

  const filtered = points.filter(p => {
    if (filterCat && p.category !== filterCat) return false;
    if (filterSev && p.severity !== filterSev) return false;
    return true;
  });

  const selectedPost = points.find(p => p._id === selectedPoint);

  const handleFocus = (p) => {
    const [lng, lat] = p.location.coordinates;
    setFocus([lat, lng]);
    setZoom(15);
    setSelectedPoint(p._id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-7xl mx-auto space-y-6 pb-12"
    >
      {/* ── UNIFIED CARD CONTAINER (Matching Image 1 Reference UI) ── */}
      <div className="bg-transparent sm:bg-white sm:dark:bg-slate-900 border-0 sm:border border-slate-200/80 dark:border-slate-800 rounded-none sm:rounded-3xl p-0 sm:p-8 shadow-none sm:shadow-xl space-y-4 sm:space-y-6">

        {/* Top Header & Filter Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl tracking-tight text-slate-900 dark:text-white">
              Location
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {filtered.length} Live
            </span>
          </div>

          {/* Time & Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {[
              { id: '', label: 'All Incidents' },
              { id: 'roads', label: 'Roads' },
              { id: 'sanitation', label: 'Sanitation' },
              { id: 'water', label: 'Water' },
              { id: 'electricity', label: 'Electricity' },
              { id: 'municipal', label: 'Municipal' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterCat(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  filterCat === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dropdown Selects & Refresh */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={filterSev}
              onChange={e => setFilterSev(e.target.value)}
              className="glass-input text-xs py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="">All Severities</option>
              {SEVERITIES.filter(Boolean).map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)} Severity
                </option>
              ))}
            </select>

            <button
              onClick={fetchPoints}
              className="btn btn-secondary btn-sm rounded-xl py-1.5 px-3 cursor-pointer"
              title="Refresh Map Data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Location Address Bar (Matching Blue MapPin address bar in Image 1) */}
        <div className="flex items-center gap-2 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50 rounded-xl px-4 py-2.5">
          <MapPin size={16} className="text-teal-500 flex-shrink-0" />
          <span className="truncate">
            {selectedPost
              ? `${selectedPost.title} — ${selectedPost.district || 'Tamil Nadu, India'}`
              : 'Coimbatore & Chennai Region, Tamil Nadu 641001, India'}
          </span>
        </div>

        {/* Embedded Full-Width Map Container */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-inner h-[340px] md:h-[400px]">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <RefreshCw size={14} className="animate-spin text-teal-500" />
                <span>Loading map layer...</span>
              </div>
            </div>
          )}

          <MapContainer center={focus} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapSync center={focus} zoom={zoom} />
            {filtered.map(p => {
              const [lng, lat] = p.location.coordinates;
              const descriptionPreview = getPlainTextPreview(p.description);
              return (
                <Marker key={p._id} position={[lat, lng]} icon={createIcon(p.severity)}>
                  <Popup>
                    <div className="p-1 max-w-[200px]">
                      <div className="font-bold text-xs text-slate-900 dark:text-white mb-1">{p.title}</div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mb-2">
                        {descriptionPreview}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <SeverityBadge severity={p.severity} showIcon={false} />
                        <Link to={`/posts/${p._id}`} className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          View <ExternalLink size={10} />
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Floating Chip Legend on Top Right of Map */}
          {!loading && (
            <div className="absolute top-3 right-3 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/70 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-3 text-[11px] font-semibold">
              {Object.entries(SEV_COLORS).map(([sev, color]) => {
                const count = filtered.filter(p => p.severity === sev).length;
                return (
                  <div key={sev} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-slate-700 dark:text-slate-300 uppercase text-[9px] font-bold">{sev.slice(0, 1)}</span>
                    <span className="text-slate-500 font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── STATIONS / INCIDENTS LIST TABLE SECTION ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Stations list:
            </h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {filtered.length} locations
            </span>
          </div>

          {/* Table Header & Rows */}
          <div className="overflow-x-auto border-0 sm:border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <table className="hidden sm:table w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Station / Incident Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                {loading ? (
                  [1, 2, 3, 4].map(n => (
                    <tr key={n} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl w-48" /></td>
                      <td className="py-3 px-4"><div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-lg w-16" /></td>
                      <td className="py-3 px-4"><div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-lg w-16" /></td>
                      <td className="py-3 px-4"><div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-lg w-16" /></td>
                      <td className="py-3 px-4"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      No matching infrastructure incidents found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const isSelected = selectedPoint === p._id;
                    const imageUrl = p.images?.[0];
                    return (
                      <tr
                        key={p._id}
                        onClick={() => handleFocus(p)}
                        className={`transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50/50 dark:bg-teal-950/20'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Name + Thumbnail Image / Icon */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={p.title}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0 font-bold">
                                {p.category ? p.category.charAt(0).toUpperCase() : 'C'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {p.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {p.district ? `${p.district}, Tamil Nadu` : 'Location coords logged'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                            {p.category || 'General'}
                          </span>
                        </td>

                        {/* Severity */}
                        <td className="py-3 px-4">
                          <SeverityBadge severity={p.severity} showIcon={false} />
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                            {p.status ? p.status.replace('_', ' ') : 'Reported'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleFocus(p)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              Focus
                            </button>
                            <Link
                              to={`/posts/${p._id}`}
                              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors no-underline inline-flex items-center gap-1"
                            >
                              Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Mobile Card List (Hidden on Desktop) */}
            <div className="block sm:hidden space-y-3 p-1">
              {loading ? (
                [1, 2, 3].map(n => (
                  <div key={n} className="animate-pulse p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center gap-3 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-800" />
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex-shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                  No matching infrastructure incidents found.
                </div>
              ) : (
                filtered.map(p => {
                  const isSelected = selectedPoint === p._id;
                  const imageUrl = p.images?.[0];
                  const color = SEV_COLORS[p.severity] || 'var(--teal-500)';
                  return (
                    <div
                      key={p._id}
                      onClick={() => handleFocus(p)}
                      className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 relative overflow-hidden ${
                        isSelected
                          ? 'bg-[var(--teal-glow)] border-[var(--teal-500)]/40 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200/85 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                      }`}
                    >
                      {/* Left glowing border based on severity */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1" 
                        style={{ background: color }}
                      />

                      {/* Image Thumbnail */}
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={p.title}
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200/60 dark:border-slate-700/60 shadow-xs flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0 font-bold text-sm">
                          {p.category ? p.category.charAt(0).toUpperCase() : 'C'}
                        </div>
                      )}

                      {/* Content */}
                      <div className="min-w-0 flex-1 pl-1">
                        {/* Meta Category & Severity Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-teal-600 dark:text-teal-400">
                            {p.category || 'General'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700 text-[8px]">•</span>
                          <span className="text-[9px] font-black uppercase" style={{ color }}>
                            {p.severity}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700 text-[8px]">•</span>
                          <span className="uppercase text-[9px] font-extrabold text-slate-500 dark:text-slate-400">
                            {p.status ? p.status.replace('_', ' ') : 'Reported'}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-0.5">
                          {p.title}
                        </h3>

                        {/* Location */}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <span className="text-xs">📍</span>
                          <span className="truncate">{p.district ? `${p.district}, Tamil Nadu` : 'Location coords logged'}</span>
                        </p>
                      </div>

                      {/* Details Link Button */}
                      <Link
                        to={`/posts/${p._id}`}
                        onClick={e => e.stopPropagation()}
                        className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center flex-shrink-0 transition-all text-slate-600 dark:text-slate-300 shadow-xs"
                      >
                        <ChevronRight size={15} strokeWidth={2.5} />
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
