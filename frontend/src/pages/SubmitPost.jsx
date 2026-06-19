import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Camera, MapPin, EyeOff, Sparkles, Upload, Check,
  Loader2, X, ChevronRight, ChevronLeft, FileText, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

// Leaflet fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapClickHandler({ setPosition }) {
  useMapEvents({ click(e) { setPosition({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

const CATEGORIES = [
  { value: 'roads', label: 'Roads & Potholes', emoji: '🛣️' },
  { value: 'sanitation', label: 'Sanitation & Garbage', emoji: '🗑️' },
  { value: 'water', label: 'Water Supply & Sewage', emoji: '💧' },
  { value: 'electricity', label: 'Electricity & Streetlights', emoji: '⚡' },
  { value: 'municipal', label: 'Municipal & Building', emoji: '🏛️' },
  { value: 'other', label: 'Other Issue', emoji: '📋' },
];

const STEPS = [
  { number: 1, label: 'Details' },
  { number: 2, label: 'Location' },
  { number: 3, label: 'Evidence' },
  { number: 4, label: 'Review' },
];

export default function SubmitPost() {
  const navigate = useNavigate();
  const { isSignedIn } = useCivic();

  // Form state
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');

  // Location
  const [position, setPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([13.0827, 80.2707]);
  const [addressPreview, setAddressPreview] = useState('');
  const [districtPreview, setDistrictPreview] = useState('');

  // Images
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Auto-detect location on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(c);
        setMapCenter([c.lat, c.lng]);
      },
      () => { }
    );
  }, []);

  // Reverse geocode when position changes
  useEffect(() => {
    if (!position) return;
    api.get(`/contacts/by-location?lat=${position.lat}&lng=${position.lng}`)
      .then(res => {
        setAddressPreview(res.data.address || '');
        setDistrictPreview(res.data.district || '');
      })
      .catch(() => { });
  }, [position]);

  // Handle file selection
  const processFiles = (files) => {
    if (!files.length) return;
    const arr = Array.from(files).slice(0, 5);
    setSelectedFiles(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
    analyzeImage(arr[0]);
  };

  const handleFileChange = (e) => processFiles(e.target.files);

  // Drag & drop
  const handleDrop = (e) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
    dropRef.current.style.borderColor = 'var(--border-default)';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current.style.borderColor = 'var(--teal-500)';
  };
  const handleDragLeave = () => {
    dropRef.current.style.borderColor = 'var(--border-default)';
  };

  const analyzeImage = async (file) => {
    try {
      setAiLoading(true);
      setAiResult(null);
      const fd = new FormData();
      fd.append('image', file);
      if (description) fd.append('description', description);
      const res = await api.post('/ai/classify', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAiResult(res.data);
      if (res.data.category) setCategory(res.data.category);
      toast.success(`AI detected: ${res.data.category}`);
    } catch {
      toast.error('AI classification failed — categorize manually.');
    } finally {
      setAiLoading(false);
    }
  };

  const removeImage = (idx) => {
    const newFiles = selectedFiles.filter((_, i) => i !== idx);
    const newPreviews = previews.filter((_, i) => i !== idx);
    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
  };

  // Step validation
  const canProceed = () => {
    if (step === 1) return title.trim() && description.trim();
    if (step === 2) return !!position;
    return true;
  };

  const handleSubmit = async () => {
    if (!isSignedIn) { toast.error('Sign in to submit.'); return; }
    if (!title.trim() || !description.trim()) { toast.error('Title and description required.'); return; }
    if (!position) { toast.error('Please pin the issue location.'); return; }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('lat', position.lat);
      fd.append('lng', position.lng);
      fd.append('category', category);
      selectedFiles.forEach(f => fd.append('images', f));
      const res = await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Report submitted anonymously!');
      if (res.data.post?.isDuplicate) {
        toast('⚠️ Similar report detected nearby — merged to avoid duplicates.', { duration: 5000 });
      }
      navigate('/feed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render step content
  const renderStep = () => {
    if (step === 1) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Issue Title *
          </label>
          <input
            type="text"
            placeholder="e.g. Deep pothole on Anna Salai, near bus stop"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="glass-input"
            autoFocus
            maxLength={120}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {title.length}/120
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Description *
          </label>
          <textarea
            placeholder="Be specific — size of pothole, how long it's been there, traffic impact, nearby landmarks..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            className="glass-input"
            style={{ resize: 'vertical' }}
            maxLength={1000}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {description.length}/1000
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Issue Category
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                style={{
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: `1px solid ${category === cat.value ? 'rgba(20,184,166,0.4)' : 'var(--border-subtle)'}`,
                  background: category === cat.value ? 'rgba(20,184,166,0.08)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  color: category === cat.value ? 'var(--teal-400)' : 'var(--text-secondary)',
                }}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    if (step === 2) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: 14, background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.15)',
          borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <MapPin size={14} style={{ color: 'var(--teal-400)', flexShrink: 0 }} />
          Click anywhere on the map to pin the exact issue location
        </div>

        <div style={{ height: 340, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler setPosition={setPosition} />
            {position && <Marker position={[position.lat, position.lng]} />}
          </MapContainer>
        </div>

        {position && (
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <MapPin size={14} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {districtPreview ? `${districtPreview} District` : 'Resolving location...'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 22 }}>
              {addressPreview || 'Fetching address...'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 22, marginTop: 4 }}>
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
          </div>
        )}

        {!position && (
          <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: 12 }}>
            ⚠️ No location pinned yet — tap the map to set the issue location
          </div>
        )}
      </div>
    );

    if (step === 3) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Drop zone */}
        <div
          ref={dropRef}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: '2px dashed var(--border-default)',
            borderRadius: 12,
            padding: '36px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'var(--bg-elevated)',
            transition: 'all 0.2s ease',
          }}
        >
          <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Drop images here, or click to browse
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            PNG, JPG, JPEG — up to 5 images, 10MB each
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Previews grid */}
        {previews.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {previews.map((src, idx) => (
              <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                <button
                  onClick={() => removeImage(idx)}
                  style={{
                    position: 'absolute', top: 5, right: 5,
                    background: 'rgba(9,9,11,0.8)', border: '1px solid var(--border-subtle)',
                    borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}
                >
                  <X size={12} />
                </button>
                {idx === 0 && (
                  <div style={{
                    position: 'absolute', bottom: 5, left: 5, background: 'rgba(9,9,11,0.75)',
                    borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: 'var(--teal-400)',
                  }}>
                    PRIMARY
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AI Result */}
        {(aiLoading || aiResult) && (
          <div className="card" style={{
            padding: 16,
            borderColor: 'rgba(20,184,166,0.2)',
            background: 'rgba(20,184,166,0.04)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
              color: 'var(--teal-400)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <Sparkles size={13} style={{ animation: aiLoading ? 'spin 1s linear infinite' : undefined }} />
              Gemini AI Analysis
            </div>

            {aiLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--teal-400)' }} />
                Analyzing image...
              </div>
            ) : aiResult && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Category</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{aiResult.category}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Severity</div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>{aiResult.severity}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Confidence</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-400)' }}>{Math.round((aiResult.confidence || 0) * 100)}%</div>
                </div>
                {aiResult.tags?.length > 0 && (
                  <div style={{ gridColumn: '1/-1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {aiResult.tags.map((t, i) => (
                      <span key={i} style={{ fontSize: 11, background: 'rgba(20,184,166,0.1)', color: 'var(--teal-400)', border: '1px solid rgba(20,184,166,0.2)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );

    if (step === 4) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: 14, background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.15)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: 'var(--text-secondary)',
        }}>
          <EyeOff size={14} style={{ color: 'var(--teal-400)' }} />
          Your identity is fully anonymized. Only the report content will be public.
        </div>

        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </h3>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="severity-badge" style={{ textTransform: 'capitalize', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              {CATEGORIES.find(c => c.value === category)?.emoji} {CATEGORIES.find(c => c.value === category)?.label}
            </span>
            {districtPreview && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--teal-400)', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', padding: '2px 8px', borderRadius: 6 }}>
                <MapPin size={10} /> {districtPreview}
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{description}</p>

          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {previews.slice(0, 4).map((src, i) => (
                <div key={i} style={{ width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                </div>
              ))}
            </div>
          )}

          {position && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} style={{ color: 'var(--teal-400)' }} />
              {addressPreview || `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`}
            </div>
          )}

          {aiResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--teal-400)' }}>
              <Sparkles size={12} />
              AI classified as <strong>{aiResult.category}</strong>, severity <strong>{aiResult.severity}</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
          background: 'linear-gradient(135deg, var(--teal-400), #6ee7b7)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          marginBottom: 4,
        }}>
          Report Civic Issue
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Anonymous reporting — your identity is never stored or linked to this report.
        </p>
      </div>

      {/* Wizard Step Indicator */}
      <div style={{ marginBottom: 24 }}>
        <div className="wizard-step-indicator" style={{ marginBottom: 10 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.number}>
              <div className={`wizard-step ${step === s.number ? 'active' : step > s.number ? 'done' : ''}`}>
                <div className="wizard-step-number">
                  {step > s.number ? <Check size={13} strokeWidth={3} /> : s.number}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: step === s.number ? 'var(--teal-400)' : step > s.number ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`wizard-connector ${step > s.number ? 'done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>
        {/* Progress bar */}
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="card animate-fadeIn" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {step === 1 && <><FileText size={18} style={{ color: 'var(--teal-400)' }} /> Describe the Issue</>}
          {step === 2 && <><MapPin size={18} style={{ color: 'var(--teal-400)' }} /> Pin the Location</>}
          {step === 3 && <><Camera size={18} style={{ color: 'var(--teal-400)' }} /> Upload Evidence</>}
          {step === 4 && <><Eye size={18} style={{ color: 'var(--teal-400)' }} /> Review & Submit</>}
        </div>

        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => canProceed() ? setStep(s => s + 1) : toast.error(step === 2 ? 'Pin a location on the map first.' : 'Fill in title and description.')}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {submitting ? (
              <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Filing Report...</>
            ) : (
              <><EyeOff size={16} /> Submit Anonymously</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
