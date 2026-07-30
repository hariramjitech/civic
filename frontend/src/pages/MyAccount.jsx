import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import {
  User, MapPin, Heart, MessageSquare, FileText,
  Settings, Loader2, Calendar, ShieldAlert, CheckCircle,
  Flame, Award, Edit3, ChevronRight, TrendingUp, Zap, Star,
  Accessibility, Eye, EyeOff, Type, Keyboard, Volume2, VolumeX,
  Lock, Unlock, ShieldCheck, Mail, Phone, CalendarRange, Sliders,
  Activity, MousePointer, Ear
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusTimeline from '../components/StatusTimeline';
import StaggerContainer, { StaggerItem } from '../components/StaggerContainer';

const DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur',
  'Dindigul', 'Ranipet', 'Tirupathur', 'Tenkasi', 'Chengalpattu',
  'Kanchipuram', 'Tiruvallur', 'Tiruppur', 'Karur', 'Namakkal',
  'Nilgiris', 'Cuddalore', 'Villupuram', 'Krishnagiri', 'Dharmapuri',
];

const ROLE_META = {
  admin:      { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'Admin', icon: '⚡' },
  department: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Department', icon: '🏛️' },
  officer:    { color: '#ea580c', bg: 'rgba(234,88,12,0.1)',  label: 'Officer', icon: '🛡️' },
  citizen:    { color: 'var(--teal-500)', bg: 'var(--teal-glow)', label: 'Citizen', icon: '👤' },
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MyAccount() {
  const { userProfile, role, fetchProfile, isSignedIn } = useCivic();


  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [myPosts, setMyPosts] = useState([]);
  const [myComments, setMyComments] = useState([]);
  const [myLikes, setMyLikes] = useState([]);
  
  // Edit Profile States
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [age, setAge] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showAadhaar, setShowAadhaar] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    const load = async () => {
      setLoading(true);
      try {
        const [postRes, commentRes, likeRes] = await Promise.all([
          api.get('/auth/my-posts'),
          api.get('/auth/my-comments'),
          api.get('/auth/my-likes'),
        ]);
        setMyPosts(postRes.data.posts || []);
        setMyComments(commentRes.data.comments || []);
        setMyLikes(likeRes.data.posts || []);
      } catch { toast.error('Failed to load history.'); }
      finally { setLoading(false); }
    };
    load();
  }, [isSignedIn]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setEmail(userProfile.email || '');
      setPhoneNumber(userProfile.phoneNumber || '');
      setAge(userProfile.age || '');
      setAadhaarNumber(userProfile.aadhaarNumber || '');
      setSelectedDistrict(userProfile.district || '');
    }
  }, [userProfile]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        district: selectedDistrict,
        displayName,
        email,
        phoneNumber,
        age,
        aadhaarNumber,
      });
      if (res.data.success) {
        toast.success('Citizen verification profile updated.');
        await fetchProfile();
        setEditingProfile(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to update profile verification details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const civicScore = myPosts.length * 10 + myComments.length * 2 + myLikes.length;
  const totalIntensity = myPosts.reduce((sum, p) => sum + (p.intensityScore || 0), 0);
  const roleMeta = ROLE_META[role] || ROLE_META.citizen;

  // Civic score level
  const level = civicScore >= 200 ? 'Champion' : civicScore >= 100 ? 'Activist' : civicScore >= 50 ? 'Reporter' : 'Observer';
  const levelProgress = Math.min((civicScore % 100) / 100, 1);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-2 border-[var(--teal-500)] border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--text-muted)] text-sm font-semibold animate-pulse">Loading your profile…</p>
    </div>
  );

  const tabs = [
    { key: 'posts',    label: 'Reports',  count: myPosts.length,    icon: FileText },
    { key: 'comments', label: 'Comments', count: myComments.length, icon: MessageSquare },
    { key: 'likes',    label: 'Liked',    count: myLikes.length,    icon: Heart },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-4xl mx-auto w-full flex flex-col gap-5 text-left"
    >
      {/* ── PROFILE HERO CARD ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
        {/* Cover gradient */}
        <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${roleMeta.color}20 0%, var(--teal-glow) 50%, transparent 100%)` }} />

        {/* Profile info */}
        <div className="px-6 pb-6">
          {/* Avatar overlapping cover */}
          <div className="flex items-end justify-between -mt-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border-4 border-[var(--bg-surface)] shadow-lg"
              style={{ background: `linear-gradient(135deg, ${roleMeta.color}30, ${roleMeta.color}60)` }}
            >
              <span>{roleMeta.icon}</span>
            </div>

            {/* Edit Profile button */}
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--teal-500)] hover:text-[var(--teal-500)] transition-all cursor-pointer bg-transparent"
            >
              <Edit3 size={12} />
              Edit Profile
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-black text-xl text-[var(--text-primary)] leading-none">
                {userProfile?.displayName || 'Civic Member'}
              </h2>
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
                style={{ color: roleMeta.color, backgroundColor: roleMeta.bg, borderColor: `${roleMeta.color}30` }}
              >
                {roleMeta.label}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {userProfile?.district && (
                <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  <MapPin size={12} className="text-[var(--teal-500)]" />
                  {userProfile.district}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                <Star size={12} className="text-amber-500" />
                {level} · {civicScore} pts
              </span>
            </div>

            {/* Level progress bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{level}</span>
                <span className="text-[10px] font-bold text-[var(--teal-500)]">{Math.round(levelProgress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress * 100}%` }}
                  transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, var(--teal-500), ${roleMeta.color})` }}
                />
              </div>
            </div>

            {/* Credentials Section */}
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5 mb-3">
                <ShieldCheck size={14} className="text-[var(--teal-500)]" />
                Verified Citizen Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[var(--bg-elevated)] p-4 rounded-2xl border border-[var(--border-subtle)]">
                {/* Email */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <Mail size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Email Address</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{userProfile?.email || 'Not verified'}</span>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <Phone size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Phone Number</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{userProfile?.phoneNumber || 'Not Linked'}</span>
                  </div>
                </div>

                {/* Age */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <CalendarRange size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Citizen Age</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{userProfile?.age || 'Not Verified'}</span>
                  </div>
                </div>

                {/* Aadhaar Number */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                    <Accessibility size={14} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Aadhaar Number (Securely Encrypted)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)] font-mono">
                        {userProfile?.aadhaarNumber 
                          ? (showAadhaar 
                              ? userProfile.aadhaarNumber 
                              : `•••• •••• ${userProfile.aadhaarNumber.slice(-4)}`)
                          : 'Not Linked'
                        }
                      </span>
                      {userProfile?.aadhaarNumber && (
                        <button
                          type="button"
                          onClick={() => setShowAadhaar(!showAadhaar)}
                          className="p-1 rounded hover:bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-none bg-transparent cursor-pointer"
                        >
                          {showAadhaar ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Edit Profile Panel */}
        <AnimatePresence>
          {editingProfile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            >
              <form onSubmit={handleProfileUpdate} className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
                  <Settings size={15} className="text-[var(--teal-500)]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Citizen Verification Settings
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Display Name */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="e.g. Citizen John"
                      className="w-full glass-input text-xs py-2 px-3 rounded-xl"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full glass-input text-xs py-2 px-3 rounded-xl"
                      required
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Phone Number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full glass-input text-xs py-2 px-3 rounded-xl"
                    />
                  </div>

                  {/* Age */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="e.g. 28"
                      className="w-full glass-input text-xs py-2 px-3 rounded-xl"
                      min="1"
                      max="120"
                    />
                  </div>

                  {/* District Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Home District</label>
                    <select
                      value={selectedDistrict}
                      onChange={e => setSelectedDistrict(e.target.value)}
                      className="w-full glass-input text-xs py-2 px-3 rounded-xl"
                      required
                    >
                      <option value="">Select district…</option>
                      {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Aadhaar Number */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Aadhaar Number (12 Digits)</label>
                    <input
                      type="text"
                      value={aadhaarNumber}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setAadhaarNumber(val);
                      }}
                      placeholder="12-digit Aadhaar Number"
                      className="w-full glass-input text-xs py-2 px-3 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer border border-[var(--border-default)] bg-transparent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    {savingProfile && <Loader2 size={12} className="animate-spin" />}
                    Save Verification Info
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Reports Filed', value: myPosts.length,    color: 'var(--teal-500)', icon: FileText,     bg: 'var(--teal-glow)' },
          { label: 'Comments',      value: myComments.length, color: '#8b5cf6',          icon: MessageSquare, bg: 'rgba(139,92,246,0.08)' },
          { label: 'Liked',         value: myLikes.length,    color: '#f43f5e',          icon: Heart,         bg: 'rgba(244,63,94,0.08)' },
          { label: 'Intensity',     value: totalIntensity,    color: '#ea580c',          icon: Flame,         bg: 'rgba(234,88,12,0.08)' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-4 space-y-2"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <Icon size={15} style={{ color: s.color }} />
              </div>
              <div className="font-display text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{s.label}</div>
            </motion.div>
          );
        })}
      </div>



      {/* ── PRIVACY NOTICE ── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
        <ShieldAlert size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)]">Privacy Active:</strong> Your identity is protected with temporary cryptographic handles — your real name is never visible on public listings, maps, or comment streams.
        </p>
      </div>

      {/* ── TABS ── */}
      <div className="space-y-4">
        <div className="flex border-b border-[var(--border-subtle)]">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative border-none bg-transparent cursor-pointer ${
                  activeTab === t.key
                    ? 'text-[var(--teal-500)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={13} />
                <span>{t.label}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-[var(--teal-glow)] text-[var(--teal-500)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  {t.count}
                </span>
                {activeTab === t.key && (
                  <motion.div
                    layoutId="profileTabLine"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--teal-500)]"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {/* Posts Tab */}
            {activeTab === 'posts' && (
              myPosts.length === 0 ? (
                <EmptyState message="You haven't filed any reports yet." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myPosts.map(post => (
                    <PostCard key={post._id} post={post} showTimeline />
                  ))}
                </div>
              )
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              myComments.length === 0 ? (
                <EmptyState message="No comments or replies logged yet." />
              ) : (
                <div className="space-y-3">
                  {myComments.map(comment => (
                    <div key={comment._id} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-4 space-y-2 hover:border-[var(--teal-500)]/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                          On:{' '}
                          {comment.postId ? (
                            <Link to={`/posts/${comment.postId._id}`} className="text-[var(--teal-500)] hover:underline font-bold">
                              {comment.postId.title}
                            </Link>
                          ) : <span className="italic">deleted report</span>}
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)]">{timeAgo(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">"{comment.text}"</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Likes Tab */}
            {activeTab === 'likes' && (
              myLikes.length === 0 ? (
                <EmptyState message="You haven't upvoted any reports." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myLikes.map(post => (
                    <PostCard key={post._id} post={post} />
                  ))}
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PostCard({ post, showTimeline }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-4 flex flex-col gap-3 hover:border-[var(--teal-500)]/40 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <SeverityBadge severity={post.severity} />
        <span className={`status-pill status-${(post.status || 'reported').replace('_', '-').replace('under-review', 'review')}`}>
          {post.status?.replace('_', ' ') || 'reported'}
        </span>
      </div>
      <div>
        <Link
          to={`/posts/${post._id}`}
          className="font-display font-black text-sm text-[var(--text-primary)] hover:text-[var(--teal-500)] no-underline leading-tight block"
        >
          {post.title}
        </Link>
        <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1 leading-relaxed">
          {post.description}
        </p>
      </div>

      {showTimeline && (
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <StatusTimeline status={post.status || 'reported'} compact />
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-auto pt-1">
        <div className="flex items-center gap-1">
          <Calendar size={10} />
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1 text-amber-500 font-bold">
          <Flame size={10} />
          <span>{post.intensityScore || 0}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-12 rounded-3xl text-center">
      <div className="text-3xl mb-3 opacity-40">📭</div>
      <p className="text-sm text-[var(--text-muted)] font-semibold">{message}</p>
    </div>
  );
}
