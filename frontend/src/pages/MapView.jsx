import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, ExternalLink, BarChart2, Info, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SEV_COLORS = { critical: '#f43f5e', high: '#f97316', medium: '#eab308', low: '#22c55e' };

const createIcon = (severity) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${SEV_COLORS[severity] || '#14b8a6'};border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 0 10px ${SEV_COLORS[severity] || '#14b8a6'}70;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function MapSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true, duration: 0.8 });
  }, [center, zoom]);
  return null;
}

const CATEGORIES = ['', 'roads', 'sanitation', 'water', 'electricity', 'municipal', 'other'];
const SEVERITIES  = ['', 'critical', 'high', 'medium', 'low'];

export default function MapView() {
  const [points, setPoints]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterCat,  setFilterCat]      = useState('');
  const [filterSev,  setFilterSev]      = useState('');
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

  const filtered = points.filter(p =>
    (!filterCat || p.category === filterCat) &&
    (!filterSev || p.severity === filterSev)
  );

  // Compute district stats from filtered points
  const districtStats = filtered.reduce((acc, p) => {
    if (!acc[p.district]) acc[p.district] = { count: 0, resolved: 0 };
    acc[p.district].count++;
    if (p.status === 'resolved') acc[p.district].resolved++;
    return acc;
  }, {});

  const topDistricts = Object.entries(districtStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const handleFocus = (p) => {
    const [lng, lat] = p.location.coordinates;
    setFocus([lat, lng]);
    setZoom(15);
    setSelectedPoint(p._id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 120px)', minHeight: 600 }}>

      {/* ── HEADER + FILTERS ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            background: 'linear-gradient(135deg, var(--teal-400), #6ee7b7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 2,
          }}>
            GIS Infrastructure Map
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tamil Nadu — live complaint heatmap</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="glass-input" style={{ width: 'auto', padding: '7px 32px 7px 10px', fontSize: 12 }}>
            <option value="">All Categories</option>
            {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <select value={filterSev} onChange={e => setFilterSev(e.target.value)} className="glass-input" style={{ width: 'auto', padding: '7px 32px 7px 10px', fontSize: 12 }}>
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button onClick={fetchPoints} className="btn btn-secondary btn-sm"><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* ── MAIN SPLIT LAYOUT ── */}
      <div className="map-split-layout">

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>

          {/* Legend */}
          <div className="card" style={{ padding: 14, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Info size={13} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Map Legend</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {Object.entries(SEV_COLORS).map(([sev, color]) => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}60`, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{sev}</span>
                </div>
              ))}
            </div>
          </div>

          {/* District stats */}
          {topDistricts.length > 0 && (
            <div className="card" style={{ padding: 14, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <BarChart2 size={13} style={{ color: 'var(--teal-400)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Top Districts</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topDistricts.map(([dist, data]) => {
                  const resolvedPct = data.count > 0 ? Math.round((data.resolved / data.count) * 100) : 0;
                  return (
                    <div key={dist}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{dist}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{data.count}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-bar-fill" style={{
                          width: `${resolvedPct}%`,
                          background: resolvedPct > 50 ? '#22c55e' : 'var(--teal-500)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Incident list */}
          <div className="card" style={{ padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Incidents</span>
              <span style={{ fontSize: 10, background: 'rgba(20,184,166,0.1)', color: 'var(--teal-400)', border: '1px solid rgba(20,184,166,0.2)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                {filtered.length} Live
              </span>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4].map(n => <div key={n} className="skeleton" style={{ height: 40 }} />)}
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(p => (
                  <button
                    key={p._id}
                    onClick={() => handleFocus(p)}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${selectedPoint === p._id ? 'rgba(20,184,166,0.35)' : 'var(--border-subtle)'}`,
                      background: selectedPoint === p._id ? 'rgba(20,184,166,0.06)' : 'var(--bg-elevated)',
                      cursor: 'pointer', transition: 'all 0.15s', width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: SEV_COLORS[p.severity] || 'var(--teal-400)',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8, paddingLeft: 13 }}>
                      <span style={{ textTransform: 'capitalize' }}>{p.category}</span>
                      <span>·</span>
                      <span style={{ textTransform: 'uppercase', fontSize: 9 }}>{p.status?.replace('_',' ')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── MAP ── */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000,
              background: 'var(--bg-translucent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading map data...</span>
            </div>
          )}
          <MapContainer center={focus} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapSync center={focus} zoom={zoom} />
            {filtered.map(p => {
              const [lng, lat] = p.location.coordinates;
              return (
                <Marker key={p._id} position={[lat, lng]} icon={createIcon(p.severity)}>
                  <Popup>
                    <div style={{ fontSize: 12, minWidth: 160, fontFamily: 'var(--font-sans)' }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{p.title}</div>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                        {p.description?.slice(0, 100)}{p.description?.length > 100 ? '...' : ''}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SeverityBadge severity={p.severity} showIcon={false} />
                        <Link to={`/posts/${p._id}`} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--teal-400)', fontWeight: 600 }}>
                          View <ExternalLink size={9} />
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Floating stats chip */}
          {!loading && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 500,
              background: 'var(--bg-surface)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-default)', borderRadius: 8,
              padding: '6px 12px', display: 'flex', gap: 12,
            }}>
              {Object.entries(SEV_COLORS).map(([sev, color]) => {
                const count = filtered.filter(p => p.severity === sev).length;
                return count > 0 ? (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                    <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
