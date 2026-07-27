import React, { useState, useEffect, useCallback } from 'react';
import { useCivic } from '../context/CivicContext';
import { SignedIn } from '@clerk/clerk-react';
import api from '../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, MessageCircle, Flame, MapPin, Search,
  Share2, Sparkles, Navigation, Plus, Globe, HelpCircle, Image,
  Bookmark, MoreHorizontal, CheckCircle2, Clock, Zap,
  Trash2, Droplets, Building2, Route, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import EscalationBar from '../components/EscalationBar';
import StaggerContainer, { StaggerItem } from '../components/StaggerContainer';

const CATEGORIES = [
  { value: '', label: 'All Issues', emoji: '🌐' },
  { value: 'roads', label: 'Roads', emoji: '🛣️' },
  { value: 'sanitation', label: 'Sanitation', emoji: '🧹' },
  { value: 'water', label: 'Water', emoji: '💧' },
  { value: 'electricity', label: 'Electricity', emoji: '⚡' },
  { value: 'municipal', label: 'Municipal', emoji: '🏛️' },
  { value: 'other', label: 'Other', emoji: '📌' },
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
    roads:       { bg: 'linear-gradient(135deg, #ff6b6b, #ff4757)', icon: Route },
    sanitation:  { bg: 'linear-gradient(135deg, #2ed573, #1e9e52)', icon: Trash2 },
    water:       { bg: 'linear-gradient(135deg, #1e90ff, #0070d4)', icon: Droplets },
    electricity: { bg: 'linear-gradient(135deg, #ffd32a, #e8ac00)', icon: Zap },
    municipal:   { bg: 'linear-gradient(135deg, #a55eea, #7c3aed)', icon: Building2 },
  };
  return styles[cat] || { bg: 'linear-gradient(135deg, #747d8c, #57606f)', icon: HelpCircle };
}

const SEV_COLORS = {
  critical: '#e11d48',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

function renderMarkdownText(text = '') {
  const lines = String(text).split(/\n+/).filter(Boolean);
  const boldPattern = /\*\*(.+?)\*\*/g;

  return lines.map((line, lineIndex) => {
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = boldPattern.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      parts.push(<strong key={`b-${lineIndex}-${match.index}`} className="font-bold text-[var(--text-primary)]">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, i) =>
          typeof part === 'string' ? <React.Fragment key={i}>{part}</React.Fragment> : part
        )}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function Feed() {
  const { isSignedIn, role, userProfile, socket } = useCivic();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myPostIds, setMyPostIds] = useState(new Set());
  const [likeAnim, setLikeAnim] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);

  // Filters
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [useGeo, setUseGeo] = useState(false);
  const [coords, setCoords] = useState(null);
  const [strikeRoomLoading, setStrikeRoomLoading] = useState({});

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
    const handlePostUpdated = (p) => setPosts(prev => prev.map(x => x._id === p._id ? { ...x, ...p } : x));
    const handlePostCreated = (p) => {
      setPosts(prev => prev.some(x => x._id === p._id) ? prev : [p, ...prev]);
      toast.success(`New report: "${p.title}"`, { duration: 4000 });
    };
    const handlePostDeleted = ({ postId }) => setPosts(prev => prev.filter(p => p._id !== postId));
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
    api.get('/auth/my-posts').then(res => setMyPostIds(new Set(res.data.posts.map(p => p._id)))).catch(() => {});
  }, [isSignedIn]);

  const handleGeoToggle = () => {
    if (!useGeo) {
      navigator.geolocation?.getCurrentPosition(
        pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setUseGeo(true); toast.success('Filtering within 5km.'); },
        () => toast.error('Location denied.')
      );
    } else { setUseGeo(false); setCoords(null); }
  };

  const handleLike = async (postId) => {
    if (!isSignedIn) { toast.error('Sign in to like.'); return; }
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p => p._id === postId
        ? { ...p, likeCount: res.data.likeCount, likedByUser: res.data.liked, intensityScore: res.data.intensityScore }
        : p
      ));
      setLikeAnim(prev => ({ ...prev, [postId]: true }));
      setTimeout(() => setLikeAnim(prev => ({ ...prev, [postId]: false })), 700);
    } catch { toast.error('Could not update.'); }
  };

  const handleSupport = async (postId) => {
    try {
      let payload = {};
      if (coords) {
        payload = { lat: coords.lat, lng: coords.lng };
      } else if (navigator.geolocation) {
        const getPosition = () => new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 2000 }
          );
        });
        const freshCoords = await getPosition();
        if (freshCoords) payload = freshCoords;
      }
      const res = await api.post(`/posts/${postId}/support`, payload);
      setPosts(prev => prev.map(p => p._id === postId
        ? { ...p, supportCount: res.data.supportCount, intensityScore: res.data.intensityScore }
        : p
      ));
      toast.success(res.data.isLocal ? `Local support +${Math.round(res.data.distance || 0)}m 🔥` : 'Support added!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not amplify.');
    }
  };

  const handleCreateStrikeRoom = async (post) => {
    if (!isSignedIn) { toast.error('Please sign in.'); return; }
    try {
      setStrikeRoomLoading(prev => ({ ...prev, [post._id]: true }));
      const res = await api.post('/rooms', {
        name: `${post.title} Strike Room`,
        description: `Live strike coordination for ${post.title}`,
        type: 'strike',
        postId: post._id,
        district: post.district,
        category: post.category,
      });
      toast.success(res.data.alreadyExists ? 'Opening strike room.' : 'Strike room created.');
      navigate(`/strikes?roomId=${res.data.room._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create strike room.');
    } finally {
      setStrikeRoomLoading(prev => ({ ...prev, [post._id]: false }));
    }
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl mx-auto">
      
      {/* ── MAIN FEED COLUMN ── */}
      <div className="lg:col-span-8 space-y-5">

        {/* Composer Trigger */}
        <SignedIn>
          <motion.div
            whileHover={{ y: -1 }}
            onClick={() => navigate('/submit')}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:border-[var(--teal-500)]/40 hover:shadow-md transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}>
              {userProfile?.username?.substring(0, 1).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 text-[var(--text-muted)] text-sm py-2.5 px-4 bg-[var(--bg-elevated)] rounded-full border border-[var(--border-subtle)] text-left hover:border-[var(--border-default)] transition-colors">
              What civic issue needs attention in your area?
            </div>
            <div className="flex items-center gap-2 pr-1">
              <div className="p-1.5 rounded-lg text-[var(--teal-500)] hover:bg-[var(--teal-glow)] transition-colors">
                <Image size={18} />
              </div>
              <div className="p-1.5 rounded-lg text-[var(--teal-500)] hover:bg-[var(--teal-glow)] transition-colors">
                <MapPin size={18} />
              </div>
            </div>
          </motion.div>
        </SignedIn>

        {/* Stream Header & Category Tabs */}
        <div className="space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display font-black text-xl text-[var(--text-primary)] flex items-center gap-2 whitespace-nowrap">
              <Zap size={18} className="text-[var(--teal-500)]" />
              Civic Stream
            </h1>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Sort segment control */}
              <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-0.5">
                {[
                  { val: 'feed',      label: 'For You' },
                  { val: 'latest',    label: 'Latest'  },
                  { val: 'intensity', label: 'Hot'     },
                ].map(s => (
                  <button
                    key={s.val}
                    onClick={() => setSort(s.val)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      sort === s.val
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Post count pill */}
              <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 text-[11px] font-black text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg">
                {filteredPosts.length}
              </span>
            </div>
          </div>

          {/* Category scroll chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 py-0.5">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                  category === c.value
                    ? 'bg-[var(--teal-500)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--teal-500)] hover:text-[var(--teal-500)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Post Cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="feed-card p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="skeleton h-3 w-1/3" />
                    <div className="skeleton h-2.5 w-1/4" />
                  </div>
                </div>
                <div className="skeleton h-52 w-full rounded-xl" />
                <div className="space-y-2">
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="feed-card p-12 text-center">
            <Globe className="mx-auto text-[var(--text-muted)] mb-4 opacity-50" size={40} />
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] mb-1">No Issues Found</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto mb-6">
              Try adjusting the filters or file the first report in this area.
            </p>
            <Link to="/submit" className="btn btn-primary px-6 py-2.5 rounded-full text-xs font-bold">
              Report Issue
            </Link>
          </div>
        ) : (
          <StaggerContainer className="space-y-4" inView={false}>
            {filteredPosts.map((post) => {
              const isOwner = myPostIds.has(post._id);
              const isLiked = post.likedByUser;
              const username = `anon_${post.district?.toLowerCase().slice(0, 3)}_${post._id?.slice(-4)}`;
              const catStyle = getCatAvatarStyle(post.category);
              const sevColor = SEV_COLORS[post.severity] || '#64748b';

              return (
                <StaggerItem key={post._id}>
                  <article className="feed-card overflow-hidden group">
                    {/* Severity accent bar */}
                    <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${sevColor}60, transparent)` }} />

                    {/* Post Header */}
                    <div className="px-4 pt-4 pb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 ring-2 ring-white dark:ring-zinc-900 shadow-sm"
                          style={{ background: catStyle.bg }}
                        >
                          {React.createElement(catStyle.icon, { size: 18, className: "text-white", strokeWidth: 2.2 })}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--text-primary)]">@{username}</span>
                            {isOwner && (
                              <span className="text-[9px] font-black uppercase tracking-widest bg-[var(--teal-glow)] text-[var(--teal-500)] border border-[var(--teal-500)]/20 px-1.5 py-0.5 rounded-full">
                                Mine
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-bold text-[var(--teal-500)]">{post.district}</span>
                            <span className="text-[var(--text-muted)] text-[11px]">·</span>
                            <span className="text-[11px] text-[var(--text-muted)]">{timeAgo(post.createdAt)}</span>
                          </div>
                          {/* Badges on mobile */}
                          <div className="flex sm:hidden items-center gap-1.5 mt-1.5">
                            <SeverityBadge severity={post.severity} />
                            <span className={`status-pill status-${(post.status || 'reported').replace('_', '-').replace('under-review', 'review')}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                              {post.status?.replace('_', ' ') || 'reported'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Badges on desktop */}
                        <div className="hidden sm:flex items-center gap-2">
                          <SeverityBadge severity={post.severity} />
                          <span className={`status-pill status-${(post.status || 'reported').replace('_', '-').replace('under-review', 'review')}`}>
                            {post.status?.replace('_', ' ') || 'reported'}
                          </span>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === post._id ? null : post._id)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          <AnimatePresence>
                            {openMenuId === post._id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                className="absolute right-0 top-8 z-20 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-xl overflow-hidden min-w-[140px]"
                              >
                                <button onClick={() => { copyLink(post._id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] flex items-center gap-2 cursor-pointer transition-colors">
                                  <Share2 size={13} /> Copy link
                                </button>
                                <button onClick={() => { navigate(`/posts/${post._id}`); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] flex items-center gap-2 cursor-pointer transition-colors">
                                  <CheckCircle2 size={13} /> View detail
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Post Image */}
                    <Link to={`/posts/${post._id}`} className="block relative bg-[var(--bg-elevated)] overflow-hidden" style={{ aspectRatio: '16/9' }}>
                      {post.images?.length > 0 ? (
                        <img
                          src={post.images[0]}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-40">
                          <MapPin size={32} className="text-[var(--text-muted)]" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">GPS Coordinates Attached</span>
                        </div>
                      )}

                      {/* Trust overlay */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1">
                        <Sparkles size={10} className="text-amber-400" />
                        <span className="text-[9px] font-black text-white uppercase tracking-wider">{post.legitimacyScore || 70}% trust</span>
                      </div>

                      {/* Image count badge */}
                      {post.images?.length > 1 && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded-full px-2 py-0.5">
                          <span className="text-[9px] font-bold text-white">+{post.images.length - 1}</span>
                        </div>
                      )}
                    </Link>

                    {/* Post Body */}
                    <div className="px-4 pt-3.5 pb-3 space-y-2.5">
                      {/* Title — full display, no clamp */}
                      <h2 className="font-display text-[15px] font-black text-[var(--text-primary)] leading-snug">
                        <Link
                          to={`/posts/${post._id}`}
                          className="no-underline hover:text-[var(--teal-500)] transition-colors"
                        >
                          {post.title}
                        </Link>
                      </h2>

                      {/* Description — 2-line clamp */}
                      {post.description && (
                        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {post.description}
                        </p>
                      )}

                      {/* AI Tags */}
                      {post.aiTags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.aiTags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-[10px] font-bold text-[var(--teal-500)] bg-[var(--teal-glow)] px-2 py-0.5 rounded-full border border-[var(--teal-500)]/10">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Address */}
                      {post.address && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                          <MapPin size={11} className="flex-shrink-0" />
                          <span className="truncate">{post.address}</span>
                        </div>
                      )}

                      {/* Escalation bar */}
                      <div className="pt-0.5">
                        <EscalationBar supportCount={post.supportCount || 0} />
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Like */}
                        <motion.button
                          onClick={() => handleLike(post._id)}
                          whileTap={{ scale: 0.85 }}
                          className={`flex items-center gap-1.5 text-sm font-semibold transition-all bg-transparent border-none cursor-pointer ${
                            isLiked ? 'text-rose-500' : 'text-[var(--text-muted)] hover:text-rose-400'
                          }`}
                        >
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={isLiked ? 'liked' : 'not-liked'}
                              initial={{ scale: 0.7 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={1.75} />
                            </motion.div>
                          </AnimatePresence>
                          <span className="text-xs">{post.likeCount || 0}</span>
                        </motion.button>

                        {/* Comment */}
                        <Link
                          to={`/posts/${post._id}#comments`}
                          className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--teal-500)] no-underline transition-colors"
                        >
                          <MessageCircle size={18} strokeWidth={1.75} />
                          <span className="text-xs font-semibold">{post.commentCount || 0}</span>
                        </Link>

                        {/* Amplify */}
                        <motion.button
                          onClick={() => handleSupport(post._id)}
                          whileTap={{ scale: 0.85 }}
                          className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-amber-500 transition-colors bg-transparent border-none cursor-pointer"
                        >
                          <Flame size={18} strokeWidth={1.75} />
                          <span className="text-xs font-semibold">{post.intensityScore || 0}</span>
                        </motion.button>

                        {/* Strike Room */}
                        <motion.button
                          onClick={() => handleCreateStrikeRoom(post)}
                          disabled={!!strikeRoomLoading[post._id]}
                          whileTap={{ scale: 0.85 }}
                          className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-rose-500 transition-colors bg-transparent border-none cursor-pointer disabled:opacity-40"
                        >
                          <Zap size={16} strokeWidth={1.75} />
                          <span className="text-xs font-semibold">{strikeRoomLoading[post._id] ? '...' : 'Strike'}</span>
                        </motion.button>
                      </div>

                      {/* Share */}
                      <button
                        onClick={() => copyLink(post._id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] bg-transparent border-none cursor-pointer transition-colors"
                      >
                        <Share2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>

                    {/* Active Strike Banner */}
                    {(post.supportCount || 0) >= 100 && (
                      <Link
                        to={`/strikes?roomId=${post._id}`}
                        className="flex items-center justify-between px-4 py-2.5 bg-rose-500/5 border-t border-rose-500/15 no-underline text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Flame size={14} className="animate-pulse" />
                          <span className="text-xs font-bold">Strike Room Active — Join coordination</span>
                        </div>
                        <span className="text-xs font-bold">→</span>
                      </Link>
                    )}
                  </article>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>

      {/* ── SIDEBAR FILTERS ── */}
      <aside className="lg:col-span-4 space-y-3 hidden lg:block">

        {/* Search */}
        <div className="sidebar-card">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search issues…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input text-sm pl-9 py-2.5 rounded-xl w-full"
            />
          </div>
        </div>

        {/* Filters card */}
        <div className="sidebar-card space-y-4">
          {/* Card header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Filters</span>
            {activeFilters > 0 && (
              <button
                onClick={() => { setDistrict(''); setCategory(''); setSeverity(''); setStatus(''); setUseGeo(false); setCoords(null); }}
                className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer bg-transparent border-none flex items-center gap-1"
              >
                ✕ Clear {activeFilters}
              </button>
            )}
          </div>

          {/* Geo Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <Navigation size={14} className={useGeo ? 'text-[var(--teal-500)]' : 'text-[var(--text-muted)]'} />
              <div>
                <span className="text-xs font-bold text-[var(--text-primary)] block">Nearby (5km)</span>
                <span className="text-[9px] text-[var(--text-muted)]">Location filter</span>
              </div>
            </div>
            <button
              onClick={handleGeoToggle}
              className="relative cursor-pointer border-0 outline-none flex-shrink-0"
              style={{
                width: '40px', height: '22px',
                borderRadius: '99px',
                background: useGeo ? 'var(--teal-500)' : 'var(--border-default)',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute',
                width: '16px', height: '16px',
                background: '#fff',
                borderRadius: '50%',
                top: '3px',
                left: useGeo ? '21px' : '3px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </button>
          </div>

          {/* District dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block">District</label>
            <select value={district} onChange={e => setDistrict(e.target.value)} className="glass-input text-xs rounded-xl py-2.5 w-full">
              <option value="">All Regions</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Severity grid */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block">Severity</span>
            <div className="grid grid-cols-2 gap-1.5">
              {['critical', 'high', 'medium', 'low'].map(s => {
                const isSelected = severity === s;
                const color = SEV_COLORS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSeverity(isSelected ? '' : s)}
                    className="py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer"
                    style={{
                      background: isSelected ? color : 'var(--bg-elevated)',
                      color: isSelected ? '#fff' : color,
                      border: `1px solid ${isSelected ? color : color + '40'}`,
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Info card — using inline style for border */}
        <div className="sidebar-card space-y-2" style={{ background: 'linear-gradient(135deg, var(--teal-glow), transparent)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[var(--teal-500)]" />
            <span className="text-xs font-bold text-[var(--text-primary)]">AI Verification</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Gemini AI checks every report for authenticity — stock photos, GPS validity, and duplicates are all screened.
          </p>
        </div>
      </aside>
    </div>
  );
}
