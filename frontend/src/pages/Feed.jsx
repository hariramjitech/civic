import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import { 
  Heart, MessageCircle, AlertTriangle, Phone, Mail, Globe,
  MapPin, SlidersHorizontal, Flame, Search, CheckCircle, 
  Clock, Share2, ChevronDown, ChevronUp, Sparkles, Navigation
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Feed() {
  const { isSignedIn, role, userProfile } = useCivic();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Geolocation states
  const [useGeo, setUseGeo] = useState(false);
  const [coords, setCoords] = useState(null);

  // User's own posts list to detect ownership
  const [myPostIds, setMyPostIds] = useState(new Set());

  // Expandable state for contact details on individual cards
  const [expandedContacts, setExpandedContacts] = useState({});
  // Double-tap heart animation trigger list
  const [likeHeartAnim, setLikeHeartAnim] = useState({});

  const categories = [
    { value: 'roads', label: 'Roads & Potholes' },
    { value: 'sanitation', label: 'Sanitation & Garbage' },
    { value: 'water', label: 'Water & Sewage' },
    { value: 'electricity', label: 'Electricity & Lights' },
    { value: 'municipal', label: 'Municipal Control' },
    { value: 'other', label: 'Other Issues' }
  ];

  const districts = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
    'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur', 
    'Dindigul', 'Ranipet', 'Tirupathur', 'Tenkasi', 'Chengalpattu', 
    'Kanchipuram', 'Tiruvallur', 'Tiruppur', 'Karur', 'Namakkal', 
    'Nilgiris', 'Cuddalore', 'Villupuram', 'Krishnagiri', 'Dharmapuri'
  ];

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const params = { sort };
      if (district) params.district = district;
      if (category) params.category = category;
      if (severity) params.severity = severity;
      if (status) params.status = status;
      
      if (useGeo && coords) {
        params.lat = coords.lat;
        params.lng = coords.lng;
        params.radius = 5000;
      }

      const res = await api.get('/posts', { params });
      setPosts(res.data.posts);
    } catch (err) {
      console.error('Failed to load posts:', err);
      toast.error('Failed to load feed.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPosts = async () => {
    if (!isSignedIn) return;
    try {
      const res = await api.get('/auth/my-posts');
      const ids = new Set(res.data.posts.map(p => p._id));
      setMyPostIds(ids);
    } catch (err) {
      console.error('Error fetching user post ownership:', err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [district, category, severity, status, sort, useGeo, coords]);

  useEffect(() => {
    fetchMyPosts();
  }, [isSignedIn]);

  const handleGeoToggle = () => {
    if (!useGeo) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setUseGeo(true);
            toast.success('Location locked. Filtering within 5km radius.');
          },
          (err) => {
            console.error(err);
            toast.error('Location permission denied.');
            setUseGeo(false);
          }
        );
      } else {
        toast.error('Geolocation not supported.');
      }
    } else {
      setUseGeo(false);
      setCoords(null);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          const liked = res.data.liked;
          return { 
            ...p, 
            likeCount: res.data.likeCount,
            intensityScore: p.intensityScore + (liked ? 1 : -1),
            likedByUser: liked
          };
        }
        return p;
      }));
      toast.success(res.data.liked ? 'Added to affected list' : 'Removed from affected list');
    } catch (err) {
      toast.error('Could not log interaction.');
    }
  };

  // Instagram Double Tap to Like
  const handleImageDoubleTap = (postId) => {
    setLikeHeartAnim(prev => ({ ...prev, [postId]: true }));
    handleLike(postId);
    setTimeout(() => {
      setLikeHeartAnim(prev => ({ ...prev, [postId]: false }));
    }, 800);
  };

  const handleSupportReport = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/support`);
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          return { 
            ...p, 
            supportCount: res.data.supportCount, 
            intensityScore: res.data.intensityScore 
          };
        }
        return p;
      }));
      toast.success('Amplified post intensity score!');
    } catch (err) {
      toast.error('Could not amplify report.');
    }
  };

  const toggleContactExpansion = (postId) => {
    setExpandedContacts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const getCategoryAvatarStyles = (cat) => {
    switch(cat) {
      case 'roads': return 'bg-gradient-to-tr from-rose-500 to-orange-500 text-white';
      case 'sanitation': return 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white';
      case 'water': return 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white';
      case 'electricity': return 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-gray-900';
      case 'municipal': return 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white';
      default: return 'bg-gradient-to-tr from-gray-650 to-gray-800 text-white';
    }
  };

  const getSeverityColor = (sev) => {
    switch(sev) {
      case 'critical': return 'text-rose-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-amber-500';
      default: return 'text-teal-400';
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'resolved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'in_progress': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'closed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    }
  };

  const copyShareLink = (postId) => {
    const url = `${window.location.origin}/posts/${postId}`;
    navigator.clipboard.writeText(url);
    toast.success('Incident link copied to clipboard!');
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (post.address && post.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-xl mx-auto space-y-6">
      
      {/* Sleek Feed Header */}
      <div className="flex items-center justify-between border-b border-gray-900 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold font-display bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Civic Stream
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-gray-550">Tamil Nadu Timeline</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-all ${
              showFilters || district || category || severity || status || useGeo
                ? 'border-teal-500/30 bg-teal-500/5 text-teal-400'
                : 'border-gray-800 bg-gray-950/40 text-gray-400 hover:text-gray-200'
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>
          <Link
            to="/submit"
            className="p-2 rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-400 hover:bg-teal-500/25 transition-all text-xs font-bold"
          >
            Report Issue
          </Link>
        </div>
      </div>

      {/* Filter drawer */}
      {showFilters && (
        <div className="glass-panel p-4 rounded-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold border-b border-gray-900 pb-2">
            <span>Filter Timelines</span>
            {(district || category || severity || status || useGeo) && (
              <button 
                onClick={() => {
                  setDistrict(''); setCategory(''); setSeverity(''); setStatus(''); setUseGeo(false); setCoords(null);
                }} 
                className="text-teal-400 text-[10px] uppercase hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-gray-500 mb-1 font-medium">District</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Regions</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-gray-500 mb-1 font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-gray-500 mb-1 font-medium">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Severities</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-500 mb-1 font-medium">Resolution</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Statuses</option>
                <option value="reported">Reported</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-500 mb-1 font-medium">Sorting</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
              >
                <option value="latest">Latest first</option>
                <option value="intensity">🔥 Intensity</option>
                <option value="severity">Severity level</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGeoToggle}
                className={`w-full py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center space-x-1.5 ${
                  useGeo
                    ? 'bg-teal-500/10 border-teal-500 text-teal-300'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <MapPin size={12} className={useGeo ? 'animate-bounce text-teal-400' : ''} />
                <span>{useGeo ? 'Geo Search On' : 'Search Near Me'}</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input
              type="text"
              placeholder="Search descriptions, landmarks, details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {/* Feed list */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2].map(n => (
            <div key={n} className="glass-panel rounded-2xl h-96 animate-pulse border border-gray-900" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="glass-panel py-16 rounded-2xl text-center space-y-4">
          <AlertTriangle className="mx-auto text-amber-500" size={40} />
          <h2 className="text-base font-bold font-display">No Civic Complaints Mapped</h2>
          <p className="text-gray-500 max-w-xs mx-auto text-xs">
            Adjust your geographic filters or report a new issue in your area right now.
          </p>
          <Link to="/submit" className="inline-block px-5 py-2 bg-teal-500 text-gray-900 text-xs font-bold rounded-lg hover:bg-teal-400 transition-colors">
            Post Anonymous Report
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPosts.map((post) => {
            const isOwner = myPostIds.has(post._id);
            const isContactExpanded = expandedContacts[post._id];
            const hasJoinedStrike = userProfile?.joinedRooms?.includes(post.strikeRoom?._id);
            const isLiked = post.likedByUser;

            // Generate clean random username
            const username = `anon_${post.district.toLowerCase()}_${post._id.slice(-4)}`;

            return (
              <div 
                key={post._id} 
                className="glass-panel rounded-xl overflow-hidden border border-gray-900 bg-black/30 flex flex-col justify-between"
              >
                {/* Header: User Profile and Meta */}
                <div className="p-3.5 flex items-center justify-between border-b border-gray-950 bg-black/10 flex-shrink-0">
                  <div className="flex items-center space-x-3">
                    {/* Circle initials category avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-xs tracking-wider border border-white/5 shadow-md ${getCategoryAvatarStyles(post.category)}`}>
                      {post.category.substring(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-bold text-gray-200 font-sans">@{username}</span>
                        {isOwner && (
                          <span className="text-[8px] bg-teal-500/10 text-teal-400 border border-teal-500/15 px-1 rounded font-extrabold">My</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-gray-500">
                        <span className="font-semibold text-gray-400">{post.district}</span>
                        <span>•</span>
                        <span>{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Header: Status & Severity indicator */}
                  <div className="flex items-center space-x-2">
                    <span className={`text-[9px] uppercase font-extrabold tracking-wider border px-2 py-0.5 rounded-full ${getStatusStyle(post.status)}`}>
                      {post.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Main Image Area: Double click to like! */}
                <div 
                  className="relative aspect-square bg-gray-950 w-full overflow-hidden flex items-center justify-center cursor-pointer select-none group border-b border-gray-950"
                  onDoubleClick={() => handleImageDoubleTap(post._id)}
                >
                  {post.images && post.images.length > 0 ? (
                    <img 
                      src={post.images[0]} 
                      alt={post.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    />
                  ) : (
                    <div className="text-gray-700 flex flex-col items-center justify-center p-8 text-center space-y-2">
                      <AlertTriangle size={32} />
                      <span className="text-[10px] tracking-widest uppercase font-bold text-gray-650">Evidence Image Empty</span>
                    </div>
                  )}

                  {/* Float heart animation bubble */}
                  {likeHeartAnim[post._id] && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 animate-scaleUp">
                      <Heart size={80} className="text-rose-500 fill-rose-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                    </div>
                  )}

                  {/* Level Tag Overlay */}
                  <div className="absolute top-3 right-3 pointer-events-none">
                    <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-950/80 text-gray-300 border border-gray-900 backdrop-blur">
                      AI Confidence: {Math.round(post.aiConfidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Card Action bar */}
                <div className="p-3 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-4">
                    {/* Heart Button */}
                    <button
                      onClick={() => handleLike(post._id)}
                      className={`transition-all hover:scale-110 active:scale-95 ${isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      <Heart size={20} className={isLiked ? 'fill-rose-500' : ''} />
                    </button>

                    {/* Comment redirect */}
                    <Link to={`/posts/${post._id}#comments`} className="text-gray-400 hover:text-gray-200">
                      <MessageCircle size={20} />
                    </Link>

                    {/* Amplify support button */}
                    <button
                      onClick={() => handleSupportReport(post._id)}
                      className="text-gray-400 hover:text-rose-400 transition-colors flex items-center space-x-1"
                    >
                      <Flame size={20} />
                      <span className="text-[10px] font-bold">{post.supportCount || 0}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => copyShareLink(post._id)}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <Share2 size={18} />
                  </button>
                </div>

                {/* Metrics Stats Banner */}
                <div className="px-3.5 pb-1 text-xs text-gray-200 font-semibold space-y-0.5">
                  <p>{post.likeCount || 0} citizen support metrics</p>
                  <p className="text-[10px] text-gray-500 font-bold">Total Intensity: {post.intensityScore || 0} 🔥</p>
                </div>

                {/* Post description block */}
                <div className="px-3.5 pb-3 text-xs leading-normal font-sans space-y-1">
                  <p>
                    <span className="font-bold text-gray-200 mr-2">@{username}</span>
                    <span className="font-bold text-teal-400 mr-2 capitalize">[{post.title}]</span>
                    <span className="text-gray-300">{post.description}</span>
                  </p>

                  {/* AI detected hashtags */}
                  {post.aiTags && post.aiTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1.5">
                      {post.aiTags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-teal-400 text-[10px] hover:underline mr-1 font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Address pinning info */}
                  {post.address && (
                    <div className="flex items-center space-x-1 text-[10px] text-gray-550 pt-2 font-mono">
                      <MapPin size={10} className="text-gray-600 flex-shrink-0" />
                      <span className="truncate">{post.address}</span>
                    </div>
                  )}
                </div>

                {/* Official Contact Accordion Selector */}
                {post.attachedContacts && post.attachedContacts.length > 0 && (
                  <div className="border-t border-gray-950 bg-black/10">
                    <button
                      onClick={() => toggleContactExpansion(post._id)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-[10px] text-gray-400 hover:text-gray-200 transition-colors uppercase font-bold tracking-wider"
                    >
                      <span className="flex items-center space-x-1.5">
                        <Navigation size={10} className="text-emerald-400" />
                        <span>Actionable Official Contact Details</span>
                      </span>
                      {isContactExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {isContactExpanded && (
                      <div className="px-3.5 pb-3 pt-1 text-xs space-y-2 border-t border-gray-900 bg-black/15 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-300">{post.attachedContacts[0].officerName}</span>
                          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                            {post.attachedContacts[0].department}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 pt-1">
                          {post.attachedContacts[0].phone && (
                            <a href={`tel:${post.attachedContacts[0].phone}`} className="flex items-center space-x-1 text-teal-400 hover:underline text-[10px] font-semibold">
                              <Phone size={10} />
                              <span>Call {post.attachedContacts[0].phone}</span>
                            </a>
                          )}
                          {post.attachedContacts[0].email && (
                            <a href={`mailto:${post.attachedContacts[0].email}`} className="flex items-center space-x-1 text-teal-400 hover:underline text-[10px] font-semibold truncate max-w-xs">
                              <Mail size={10} />
                              <span>Email Officer</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Protest link if Active strike */}
                {post.intensityScore >= 100 && (
                  <div className="border-t border-rose-950/20 bg-rose-950/5 p-2 px-3.5">
                    <Link
                      to="/strikes"
                      className="w-full flex items-center justify-between text-[10px] text-rose-400 hover:text-rose-300 font-extrabold tracking-wider uppercase transition-colors"
                    >
                      <span className="flex items-center space-x-1.5">
                        <Flame size={12} className="text-rose-500 animate-pulse" />
                        <span>Protest Strike mobilized. Join digital campaign</span>
                      </span>
                      <ChevronDown size={12} className="-rotate-90" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
