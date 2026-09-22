import React, { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, ExternalLink, RefreshCw, Search, X, Filter,
  Navigation, Flame, AlertTriangle, Layers, Eye, Crosshair,
  SlidersHorizontal, ShieldAlert, CheckCircle2, ChevronDown, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import { motion, AnimatePresence } from 'framer-motion';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SEV_COLORS = {
  critical: '#e11d48',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#16a34a'
};

const CATEGORIES = [
  { id: '',            label: 'All Categories' },
  { id: 'roads',       label: 'Roads' },
  { id: 'sanitation',  label: 'Sanitation' },
  { id: 'water',       label: 'Water' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'municipal',   label: 'Municipal' },
  { id: 'other',       label: 'Other' }
];

const SEVERITIES = [
  { id: '',         label: 'All Severities' },
  { id: 'critical', label: 'Critical' },
  { id: 'high',     label: 'High' },
  { id: 'medium',   label: 'Medium' },
  { id: 'low',      label: 'Low' }
];

const createCustomPin = (severity, isSelected = false) => {
  const color = SEV_COLORS[severity] || '#6366f1';
  const size = isSelected ? 36 : 28;
  const strokeWidth = isSelected ? 3 : 2;

  const svgMarkup = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
      ${isSelected ? `<div style="position:absolute; inset:-4px; border-radius:50%; background:${color}33; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.25)); transition: transform 0.2s ease;">
        <path d="M12 2C8.13401 2 5 5.13401 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13401 15.866 2 12 2Z" fill="${color}" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: svgMarkup,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
};

function MapSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      try {
        const container = map.getContainer();
        if (container && container.clientWidth > 0 && container.clientHeight > 0) {
          map.setView(center, zoom, { animate: true, duration: 0.7 });
        }
      } catch (e) {
        console.warn("Leaflet setView warning:", e);
      }
    }
  }, [center, zoom, map]);
  return null;
}

const getPlainTextPreview = (value = '', maxLength = 100) => {
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
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterCat, setFilterCat]       = useState('');
  const [filterSev, setFilterSev]       = useState('');
  const [focus, setFocus]               = useState([13.0827, 80.2707]);
  const [initialCenter, setInitialCenter] = useState([13.0827, 80.2707]);
  const [zoom, setZoom]                 = useState(10);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      const res = await api.get('/posts', { params: { limit: 200 } });
      const mapped = (res.data.posts || []).filter(p => p.location?.coordinates && p.location.coordinates.length === 2);
      setPoints(mapped);
      if (mapped.length > 0) {
        const [lng, lat] = mapped[0].location.coordinates;
        setFocus([lat, lng]);
        setInitialCenter([lat, lng]);
        setZoom(11);
      }
    } catch (err) {
      toast.error('Failed to load map incidents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  const filtered = useMemo(() => {
    return points.filter(p => {
      if (filterCat && p.category !== filterCat) return false;
      if (filterSev && p.severity !== filterSev) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = p.title?.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q);
        const districtMatch = p.district?.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !districtMatch && !catMatch) return false;
      }
      return true;
    });
  }, [points, filterCat, filterSev, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts = { '': points.length };
    points.forEach(p => {
      if (p.category) {
        const catKey = p.category.toLowerCase();
        counts[catKey] = (counts[catKey] || 0) + 1;
      }
    });
    return counts;
  }, [points]);

  const severityCounts = useMemo(() => {
    const counts = { '': points.length };
    points.forEach(p => {
      if (p.severity) {
        const sevKey = p.severity.toLowerCase();
        counts[sevKey] = (counts[sevKey] || 0) + 1;
      }
    });
    return counts;
  }, [points]);

  const criticalCount = useMemo(() => {
    return points.filter(p => p.severity === 'critical').length;
  }, [points]);

  const selectedPost = useMemo(() => {
    return points.find(p => p._id === selectedPoint);
  }, [points, selectedPoint]);

  const handleFocus = (p) => {
    const [lng, lat] = p.location.coordinates;
    setFocus([lat, lng]);
    setZoom(15);
    setSelectedPoint(p._id);
  };

  const handleResetFilters = () => {
    setFilterCat('');
    setFilterSev('');
    setSearchQuery('');
  };

  const handleRecenter = () => {
    setFocus(initialCenter);
    setZoom(11);
    setSelectedPoint(null);
  };

  const hasActiveFilters = Boolean(filterCat || filterSev || searchQuery);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-7xl mx-auto space-y-6 pb-16 px-4 sm:px-6"
    >
      {/* ── Page Header & Quick Overview ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[var(--text-primary)]">
              Civic Map & Incident Tracker
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live GIS
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl leading-relaxed">
            Real-time spatial distribution of reported community & infrastructure issues across districts.
          </p>
        </div>

        {/* Quick Metrics & Actions Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-xs flex items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
            <MapPin size={15} className="text-[var(--teal-500)]" />
            <span>Total Reports:</span>
            <strong className="text-[var(--text-primary)] font-bold">{points.length}</strong>
          </div>

          {criticalCount > 0 && (
            <div className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shadow-xs flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
              <ShieldAlert size={15} className="text-rose-500" />
              <span>Critical:</span>
              <strong className="font-bold">{criticalCount}</strong>
            </div>
          )}

          <button
            onClick={fetchPoints}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] active:scale-95 border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            title="Refresh GIS Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[var(--teal-500)]' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Search & Unified Controls Bar ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 hover:border-[var(--border-strong)] transition-all">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reports by title, description, or district..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs font-medium focus:outline-none focus:border-[var(--teal-500)] focus:ring-2 focus:ring-[var(--teal-500)]/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded-md hover:bg-[var(--border-default)] transition-colors"
                title="Clear search query"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Controls: Severity Dropdown & Reset Filters */}
          <div className="flex items-center gap-2.5 shrink-0 justify-between sm:justify-end">
            <div className="relative flex items-center">
              <select
                value={filterSev}
                onChange={e => setFilterSev(e.target.value)}
                className="pl-3 pr-8 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs font-semibold focus:outline-none focus:border-[var(--teal-500)] focus:ring-2 focus:ring-[var(--teal-500)]/20 cursor-pointer appearance-none transition-all"
              >
                {SEVERITIES.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.label} {s.id ? `(${severityCounts[s.id] || 0})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <X size={13} />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Bar with Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar border-t border-[var(--border-subtle)]">
          <span className="text-xs font-semibold text-[var(--text-muted)] mr-1 flex-shrink-0 flex items-center gap-1">
            <Filter size={13} /> Category:
          </span>
          {CATEGORIES.map(cat => {
            const active = filterCat === cat.id;
            const count = categoryCounts[cat.id] ?? 0;

            return (
              <button
                key={cat.id}
                onClick={() => setFilterCat(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-[var(--teal-500)] text-white shadow-xs shadow-[var(--teal-500)]/20'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border-default)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                  active ? 'bg-white/20 text-white font-bold' : 'bg-[var(--border-default)] text-[var(--text-muted)] font-medium'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Focused Location Address Banner ── */}
      <div className="flex items-center justify-between gap-3 text-xs font-medium px-4 py-2.5 rounded-xl bg-[var(--teal-glow)] border border-[var(--teal-500)]/20 text-[var(--text-primary)] shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={16} className="text-[var(--teal-500)] flex-shrink-0 animate-bounce" />
          <span className="truncate">
            {selectedPost ? (
              <>
                <span className="text-[var(--teal-500)] font-bold">Focusing:</span>{' '}
                <strong>{selectedPost.title}</strong>
                <span className="text-[var(--text-muted)]"> — {selectedPost.district ? `${selectedPost.district}, Tamil Nadu` : 'GIS Coordinates Logged'}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-[var(--text-primary)]">GIS Overview:</span> Showing <strong className="text-[var(--teal-500)]">{filtered.length}</strong> active incident markers across Tamil Nadu districts.
              </>
            )}
          </span>
        </div>

        {selectedPost && (
          <button
            onClick={handleRecenter}
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--teal-500)] text-[11px] font-bold text-[var(--teal-500)] flex items-center gap-1 flex-shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            <Crosshair size={12} /> Reset Focus
          </button>
        )}
      </div>

      {/* ── Interactive GIS Map Viewport ── */}
      <div className="relative rounded-2xl overflow-hidden border border-[var(--border-default)] shadow-sm h-[380px] sm:h-[450px]">
        {loading && (
          <div className="absolute inset-0 z-20 bg-[var(--bg-surface)]/80 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <RefreshCw size={16} className="animate-spin text-[var(--teal-500)]" />
              <span>Updating interactive map layer...</span>
            </div>
          </div>
        )}

        <MapContainer center={focus} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapSync center={focus} zoom={zoom} />
          
          {filtered.map(p => {
            const [lng, lat] = p.location.coordinates;
            const isSelected = selectedPoint === p._id;
            const previewText = getPlainTextPreview(p.description);

            return (
              <Marker
                key={p._id}
                position={[lat, lng]}
                icon={createCustomPin(p.severity, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedPoint(p._id);
                  }
                }}
              >
                <Popup className="custom-map-popup">
                  <div className="p-1 space-y-2 max-w-[220px]">
                    {p.images?.[0] && (
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        className="w-full h-24 rounded-lg object-cover border border-[var(--border-subtle)]"
                      />
                    )}
                    <div>
                      <div className="font-bold text-xs text-[var(--text-primary)] leading-snug">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium">
                        📍 {p.district ? `${p.district}, TN` : 'Tamil Nadu'}
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-tight line-clamp-2">
                      {previewText}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                      <SeverityBadge severity={p.severity} showIcon={false} />
                      <Link
                        to={`/posts/${p._id}`}
                        className="text-[11px] font-bold text-[var(--teal-500)] hover:underline flex items-center gap-1 no-underline"
                      >
                        View Report <ExternalLink size={10} />
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Severity Legend Overlay */}
        {!loading && (
          <div className="absolute top-3 right-3 z-[400] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-default)] rounded-xl px-3 py-2 shadow-md flex items-center gap-3 text-[11px] font-semibold">
            {Object.entries(SEV_COLORS).map(([sev, color]) => {
              const count = filtered.filter(p => p.severity === sev).length;
              const isFiltered = filterSev === sev;

              return (
                <button
                  key={sev}
                  onClick={() => setFilterSev(isFiltered ? '' : sev)}
                  className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
                    filterSev && !isFiltered ? 'opacity-40' : 'opacity-100'
                  }`}
                  title={`Filter by ${sev} severity`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="capitalize text-[var(--text-secondary)] font-bold">{sev}</span>
                  <span className="text-[var(--text-muted)] font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-[400] p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] shadow-md transition-all cursor-pointer"
          title="Reset map view to default center"
        >
          <Crosshair size={16} />
        </button>
      </div>

      {/* ── Reported Incidents Section ── */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
              Reported Incidents
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-default)]">
              {filtered.length} locations
            </span>
          </div>

          {hasActiveFilters && (
            <span className="text-xs text-[var(--text-muted)]">
              Filtered view
            </span>
          )}
        </div>

        {/* Incidents Data Table (Desktop) */}
        <div className="hidden sm:block border border-[var(--border-default)] rounded-2xl overflow-hidden bg-[var(--bg-surface)] shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-muted)] font-semibold border-b border-[var(--border-default)]">
              <tr>
                <th className="py-3.5 px-4">Incident & Area</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                [1, 2, 3, 4].map(n => (
                  <tr key={n} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-9 bg-[var(--bg-overlay)] rounded-xl w-48" /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-[var(--bg-overlay)] rounded-lg w-16" /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-[var(--bg-overlay)] rounded-lg w-16" /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-[var(--bg-overlay)] rounded-lg w-16" /></td>
                    <td className="py-3.5 px-4"><div className="h-7 bg-[var(--bg-overlay)] rounded-xl w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center space-y-3">
                    <div className="text-[var(--text-muted)] text-sm font-medium">
                      No incidents match your active filter criteria.
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="px-4 py-2 rounded-xl bg-[var(--teal-500)] text-white text-xs font-semibold cursor-pointer shadow-xs hover:bg-[var(--teal-600)] transition-colors"
                      >
                        Reset All Filters
                      </button>
                    )}
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
                          ? 'bg-[var(--teal-glow)]'
                          : 'hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {/* Incident Title & District */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={p.title}
                              className="w-10 h-10 rounded-xl object-cover border border-[var(--border-default)] flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-[var(--teal-500)] flex-shrink-0 font-bold">
                              {p.category ? p.category.charAt(0).toUpperCase() : 'C'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--text-primary)] truncate">
                              {p.title}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                              📍 {p.district ? `${p.district}, Tamil Nadu` : 'Location coords logged'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="capitalize font-semibold text-[var(--text-secondary)]">
                          {p.category || 'General'}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="py-3.5 px-4">
                        <SeverityBadge severity={p.severity} showIcon={false} />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className="uppercase text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                          {p.status ? p.status.replace('_', ' ') : 'Reported'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleFocus(p)}
                            className="px-3 py-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Locate
                          </button>
                          <Link
                            to={`/posts/${p._id}`}
                            className="px-3 py-1.5 rounded-xl bg-[var(--teal-500)] hover:bg-[var(--teal-600)] text-white text-xs font-semibold transition-colors no-underline inline-flex items-center gap-1 shadow-xs"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            [1, 2, 3].map(n => (
              <div key={n} className="animate-pulse p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--bg-overlay)] rounded-xl flex-shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-3 bg-[var(--bg-overlay)] rounded w-1/3" />
                  <div className="h-4 bg-[var(--bg-overlay)] rounded w-2/3" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-3">
              <div className="text-[var(--text-muted)] text-sm font-medium">
                No matching incidents found.
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-[var(--teal-500)] text-white text-xs font-semibold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
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
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 relative overflow-hidden ${
                    isSelected
                      ? 'bg-[var(--teal-glow)] border-[var(--teal-500)]/40 shadow-xs'
                      : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: color }}
                  />

                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={p.title}
                      className="w-12 h-12 rounded-xl object-cover border border-[var(--border-default)] flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-[var(--teal-500)] flex-shrink-0 font-bold text-sm">
                      {p.category ? p.category.charAt(0).toUpperCase() : 'C'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 pl-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-[var(--teal-500)]">
                        {p.category || 'General'}
                      </span>
                      <span className="text-[10px] font-bold uppercase" style={{ color }}>
                        • {p.severity}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-[var(--text-primary)] truncate mt-0.5">
                      {p.title}
                    </h3>

                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      📍 {p.district ? `${p.district}, TN` : 'Coordinates logged'}
                    </p>
                  </div>

                  <Link
                    to={`/posts/${p._id}`}
                    onClick={e => e.stopPropagation()}
                    className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center flex-shrink-0 text-[var(--text-primary)]"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}
