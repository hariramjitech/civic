import React, { useState, useEffect, useCallback } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import {
  Heart, MessageCircle, Flame, MapPin, Search,
  CheckCircle, Clock, Share2, ChevronDown, ChevronUp,
  Sparkles, Navigation, Phone, Mail, PlusCircle, SlidersHorizontal,
  LayoutGrid, List
} from 'lucide-react';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import EscalationBar from '../components/EscalationBar';
import StatusTimeline from '../components/StatusTimeline';

const CATEGORIES = [
  { value: '', label: 'All Issues' },
  { value: 'roads', label: 'Roads' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'other', label: 'Other' },
];

const DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur',
  'Dindigul', 'Ranipet', 'Tirupathur', 'Tenkasi', 'Chengalpattu',
  'Kanchipuram', 'Tiruvallur', 'Tiruppur', 'Karur', 'Namakkal',
  'Nilgiris', 'Cuddalore', 'Villupuram', 'Krishnagiri', 'Dharmapuri',
];

function getCatAvatarStyle(cat) {
  const styles = {
    roads: { background: 'linear-gradient(135deg,#f43f5e,#f97316)' },
    sanitation: { background: 'linear-gradient(135deg,#22c55e,#14b8a6)' },
    water: { background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' },
    electricity: { background: 'linear-gradient(135deg,#eab308,#f97316)' },
    municipal: { background: 'linear-gradient(135deg,#a855f7,#6366f1)' },
  };
  return styles[cat] || { background: 'linear-gradient(135deg,#52525b,#3f3f46)' };
}

const SEV_BORDER = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
};

export default function Feed() {
  const { isSignedIn, role, userProfile, socket } = useCivic();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myPostIds, setMyPostIds] = useState(new Set());
  const [expandedContacts, setExpandedContacts] = useState({});
  const [expandedTimelines, setExpandedTimelines] = useState({});
  const [likeAnim, setLikeAnim] = useState({});

  // Filters
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [useGeo, setUseGeo] = useState(false);
  const [coords, setCoords] = useState(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { sort };
      if (district) params.district = district;
      if (category) params.category = category;
      if (severity) params.severity = severity;
      if (status) params.status = status;
      if (useGeo && coords) { params.lat = coords.lat; params.lng = coords.lng; params.radius = 5000; }
      const res = await api.get('/posts', { params });
      setPosts(res.data.posts);
    } catch (err) {
      toast.error('Failed to load feed.');
    } finally {
      setLoading(false);
    }
  }, [district, category, severity, status, sort, useGeo, coords]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('feed:subscribe');

    const handlePostUpdated = (updatedPost) => {
      setPosts(prev => prev.map(p => p._id === updatedPost._id ? { ...p, ...updatedPost } : p));
    };

    const handlePostCreated = (newPost) => {
      setPosts(prev => {
        if (prev.some(p => p._id === newPost._id)) return prev;
        return [newPost, ...prev];
      });
      toast.success(`New report filed: "${newPost.title}"`, { duration: 4000 });
    };

    const handlePostDeleted = ({ postId }) => {
      setPosts(prev => prev.filter(p => p._id !== postId));
    };

    socket.on('feed:post_updated', handlePostUpdated);
    socket.on('feed:post_created', handlePostCreated);
    socket.on('feed:post_deleted', handlePostDeleted);

    return () => {
      socket.off('feed:post_updated', handlePostUpdated);
      socket.off('feed:post_created', handlePostCreated);
      socket.off('feed:post_deleted', handlePostDeleted);
    };
  }, [socket]);

  useEffect(() => {
    if (!isSignedIn) return;
    api.get('/auth/my-posts')
      .then(res => setMyPostIds(new Set(res.data.posts.map(p => p._id))))
      .catch(() => { });
  }, [isSignedIn]);

  const handleGeoToggle = () => {
    if (!useGeo) {
      navigator.geolocation?.getCurrentPosition(
        pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setUseGeo(true); toast.success('Filtering within 5km.'); },
        () => { toast.error('Location denied.'); }
      );
    } else {
      setUseGeo(false); setCoords(null);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p => p._id === postId
        ? { ...p, likeCount: res.data.likeCount, likedByUser: res.data.liked }
        : p
      ));
      // Heart animation
      setLikeAnim(prev => ({ ...prev, [postId]: true }));
      setTimeout(() => setLikeAnim(prev => ({ ...prev, [postId]: false })), 700);
    } catch { toast.error('Could not update.'); }
  };

  const handleSupport = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/support`);
      setPosts(prev => prev.map(p => p._id === postId
        ? { ...p, supportCount: res.data.supportCount, intensityScore: res.data.intensityScore }
        : p
      ));
      toast.success('Support added!');
    } catch { toast.error('Could not amplify.'); }
  };

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/posts/${id}`);
    toast.success('Link copied!');
  };

  const activeFilters = [district, category, severity, status, useGeo].filter(Boolean).length;
  const filteredPosts = posts.filter(p =>
    !searchQuery || [p.title, p.description, p.address || ''].some(t =>
      t.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            background: 'linear-gradient(135deg, var(--teal-400), #6ee7b7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', marginBottom: 2,
          }}>
            Civic Stream
          </h1>
          <p className="section-label">Tamil Nadu Live Reports</p>
        </div>
        <Link to="/submit" className="btn btn-primary btn-sm">
          <PlusCircle size={14} />
          Report Issue
        </Link>
      </div>

      {/* ── SEARCH BAR ── */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={14} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="Search by title, area, description..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="glass-input"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* ── FILTER PILLS ── */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16,
        msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`filter-pill ${category === c.value ? 'active' : ''}`}
          >
            {c.label}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--border-subtle)', flexShrink: 0 }} />
        {['critical', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            onClick={() => setSeverity(severity === s ? '' : s)}
            className={`filter-pill ${severity === s ? 'active' : ''}`}
            style={{ color: severity === s ? SEV_BORDER[s] : undefined }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--border-subtle)', flexShrink: 0 }} />
        <button
          onClick={() => setSort(sort === 'latest' ? 'intensity' : 'latest')}
          className={`filter-pill ${sort === 'intensity' ? 'active' : ''}`}
        >
          <Flame size={12} />
          {sort === 'intensity' ? 'By Intensity' : 'Latest'}
        </button>
        <button
          onClick={handleGeoToggle}
          className={`filter-pill ${useGeo ? 'active' : ''}`}
        >
          <MapPin size={12} className={useGeo ? 'animate-bounce' : ''} />
          {useGeo ? 'Near Me ✓' : 'Near Me'}
        </button>

        {/* District selector */}
        <select
          value={district}
          onChange={e => setDistrict(e.target.value)}
          className="filter-pill"
          style={{ background: district ? 'var(--teal-glow)' : undefined, borderColor: district ? 'rgba(20,184,166,0.35)' : undefined }}
        >
          <option value="">All Districts</option>
          {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {activeFilters > 0 && (
          <button
            onClick={() => { setDistrict(''); setCategory(''); setSeverity(''); setStatus(''); setUseGeo(false); setCoords(null); }}
            className="filter-pill"
            style={{ color: 'var(--sev-critical)', borderColor: 'rgba(244,63,94,0.2)' }}
          >
            ✕ Clear ({activeFilters})
          </button>
        )}
      </div>

      {/* ── FEED LIST ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="card" style={{ height: 380 }}>
              <div className="skeleton" style={{ height: 220, borderRadius: '10px 10px 0 0' }} />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton" style={{ height: 16, width: '60%' }} />
                <div className="skeleton" style={{ height: 12, width: '90%' }} />
                <div className="skeleton" style={{ height: 12, width: '75%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏙️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            No Reports Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Try adjusting filters or be the first to report an issue in your area.
          </p>
          <Link to="/submit" className="btn btn-primary">Report First Issue</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredPosts.map((post, idx) => {
            const isOwner = myPostIds.has(post._id);
            const isContactOpen = expandedContacts[post._id];
            const isTimelineOpen = expandedTimelines[post._id];
            const isLiked = post.likedByUser;
            const username = `anon_${post.district?.toLowerCase().slice(0, 3)}_${post._id?.slice(-4)}`;

            return (
              <div
                key={post._id}
                className="card animate-slideInUp card-stagger"
                style={{
                  overflow: 'hidden',
                  borderLeft: `3px solid ${SEV_BORDER[post.severity] || 'var(--border-subtle)'}`,
                  animationDelay: `${idx * 0.06}s`,
                }}
              >
                {/* ── CARD HEADER ── */}
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
                      ...getCatAvatarStyle(post.category),
                    }}>
                      {post.category?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          @{username}
                        </span>
                        {isOwner && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                            background: 'rgba(20,184,166,0.1)', color: 'var(--teal-400)',
                            border: '1px solid rgba(20,184,166,0.2)', padding: '1px 5px', borderRadius: 4,
                          }}>
                            Mine
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{post.district}</span>
                        <span>·</span>
                        <span>{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SeverityBadge severity={post.severity} />
                    <span className={`status-pill status-${(post.status || 'reported').replace('_', '-').replace('under-review', 'review')}`}>
                      {post.status?.replace('_', ' ') || 'reported'}
                    </span>
                  </div>
                </div>

                {/* ── IMAGE ── */}
                <div style={{
                  position: 'relative',
                  aspectRatio: '4/3',
                  background: 'var(--bg-elevated)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                  onDoubleClick={() => handleLike(post._id)}
                >
                  {post.images?.length > 0 ? (
                    <img
                      src={post.images[0]}
                      alt={post.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)',
                    }}>
                      <span style={{ fontSize: 32 }}>📍</span>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        No Image
                      </span>
                    </div>
                  )}

                  {/* Heart animation overlay */}
                  {likeAnim[post._id] && (
                    <div className="animate-scaleUp" style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                    }}>
                      <Heart size={72} fill="#f43f5e" stroke="#f43f5e" style={{ filter: 'drop-shadow(0 0 20px #f43f5e80)' }} />
                    </div>
                  )}

                  {/* AI Confidence chip */}
                  {post.aiConfidence != null && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(9,9,11,0.75)', backdropFilter: 'blur(6px)',
                      border: '1px solid var(--border-subtle)', borderRadius: 6,
                      padding: '3px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
                    }}>
                      <Sparkles size={10} style={{ color: 'var(--teal-400)' }} />
                      AI {Math.round(post.aiConfidence * 100)}%
                    </div>
                  )}
                </div>

                {/* ── ACTION BAR ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                      onClick={() => handleLike(post._id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: isLiked ? '#f43f5e' : 'var(--text-muted)',
                        transition: 'transform 0.1s ease, color 0.1s ease',
                        fontSize: 12, fontWeight: 600,
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Heart size={19} fill={isLiked ? '#f43f5e' : 'none'} strokeWidth={isLiked ? 0 : 1.5} />
                      <span>{post.likeCount || 0}</span>
                    </button>

                    <Link
                      to={`/posts/${post._id}#comments`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)',
                        fontSize: 12, fontWeight: 600, textDecoration: 'none',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <MessageCircle size={19} strokeWidth={1.5} />
                      <span>{post.commentCount || 0}</span>
                    </Link>

                    <button
                      onClick={() => handleSupport(post._id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="I'm affected too — amplify this issue"
                    >
                      <Flame size={19} strokeWidth={1.5} />
                      <span>{post.supportCount || 0}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => copyLink(post._id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                      color: 'var(--text-muted)', transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Share2 size={17} strokeWidth={1.5} />
                  </button>
                </div>

                {/* ── CONTENT ── */}
                <div style={{ padding: '0 14px 12px' }}>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                    <Link
                      to={`/posts/${post._id}`}
                      style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 6, textDecoration: 'none' }}
                    >
                      {post.title}
                    </Link>
                    {post.description}
                  </p>

                  {/* Tags */}
                  {post.aiTags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {post.aiTags.slice(0, 4).map((tag, i) => (
                        <span key={i} style={{ fontSize: 11, color: 'var(--teal-400)', fontWeight: 500 }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Address */}
                  {post.address && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      marginTop: 8, color: 'var(--text-muted)', fontSize: 11,
                    }}>
                      <MapPin size={10} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── ESCALATION BAR ── */}
                <div style={{ padding: '0 14px 12px' }}>
                  <EscalationBar supportCount={post.supportCount || 0} />
                </div>

                {/* ── STATUS TIMELINE (collapsible) ── */}
                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setExpandedTimelines(prev => ({ ...prev, [post._id]: !prev[post._id] }))}
                    style={{
                      width: '100%', padding: '8px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={10} />
                      Status Progress
                    </div>
                    {isTimelineOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {isTimelineOpen && (
                    <div className="animate-fadeIn" style={{ padding: '0 14px 14px' }}>
                      <StatusTimeline status={post.status || 'reported'} />
                    </div>
                  )}
                </div>

                {/* ── OFFICIAL CONTACTS (collapsible) ── */}
                {post.attachedContacts?.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => setExpandedContacts(prev => ({ ...prev, [post._id]: !prev[post._id] }))}
                      style={{
                        width: '100%', padding: '8px 14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Navigation size={10} style={{ color: '#34d399' }} />
                        Official Contact
                      </div>
                      {isContactOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {isContactOpen && (
                      <div className="animate-fadeIn" style={{
                        padding: '0 14px 14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {post.attachedContacts[0].officerName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {post.attachedContacts[0].department}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {post.attachedContacts[0].phone && (
                            <a
                              href={`tel:${post.attachedContacts[0].phone}`}
                              className="btn btn-secondary btn-sm"
                              style={{ gap: 5 }}
                            >
                              <Phone size={12} />
                              Call
                            </a>
                          )}
                          {post.attachedContacts[0].email && (
                            <a
                              href={`mailto:${post.attachedContacts[0].email}`}
                              className="btn btn-secondary btn-sm"
                            >
                              <Mail size={12} />
                              Email
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STRIKE BANNER ── */}
                {(post.supportCount || 0) >= 100 && (
                  <Link
                    to="/strikes"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(244,63,94,0.05)',
                      borderTop: '1px solid rgba(244,63,94,0.1)',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f43f5e', fontSize: 11, fontWeight: 700 }}>
                      <Flame size={12} style={{ animation: 'pulse-glow 1.5s ease infinite' }} />
                      Strike Room Active — Join the Campaign
                    </div>
                    <ChevronDown size={12} style={{ color: '#f43f5e', transform: 'rotate(-90deg)' }} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
