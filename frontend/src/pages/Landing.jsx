import React, { useState, useEffect } from 'react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, EyeOff, Sparkles, Users, MapPin, ArrowRight,
  Camera, Cpu, PhoneCall, BarChart2, TrendingUp, Clock,
  Globe, Compass, Newspaper, Building2, Activity, ExternalLink, AlertTriangle, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { useCivic } from '../context/CivicContext';
import RevealOnScroll from '../components/RevealOnScroll';
import StaggerContainer, { StaggerItem } from '../components/StaggerContainer';
import AnimatedCard from '../components/AnimatedCard';

const FEATURES = [
  {
    icon: EyeOff,
    title: '100% Anonymous',
    desc: 'Your identity is protected cryptographically. No names or accounts linked to public posts.',
    color: 'var(--teal-400)',
    bg: 'rgba(20,184,166,0.06)',
    border: 'rgba(20,184,166,0.15)',
  },
  {
    icon: Sparkles,
    title: 'Gemini AI Analysis',
    desc: 'Automatic issue classification, severity scoring, and duplicate detection on every upload.',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.15)',
  },
  {
    icon: MapPin,
    title: 'Auto-Attached Contacts',
    desc: 'GPS coordinates resolve your district and attach the right TN officer details automatically.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.06)',
    border: 'rgba(52,211,153,0.15)',
  },
  {
    icon: Users,
    title: 'Strike Rooms',
    desc: 'High-severity issues auto-open Strike Rooms. Join to escalate directly to commissioners.',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.06)',
    border: 'rgba(248,113,113,0.15)',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Camera,
    title: 'Report with Evidence',
    desc: 'Upload a photo of the civic issue, drop a pin on the map, and describe what you see.',
    color: 'var(--teal-400)',
  },
  {
    step: '02',
    icon: Cpu,
    title: 'AI Classifies & Routes',
    desc: 'Gemini AI analyzes the image, assigns severity, detects duplicates, and routes to the right department.',
    color: '#a78bfa',
  },
  {
    step: '03',
    icon: PhoneCall,
    title: 'Authority Gets Notified',
    desc: 'The relevant officer receives the complaint with full evidence. Community support escalates urgency.',
    color: '#34d399',
  },
];

const METRICS = [
  { label: 'Districts Covered', value: '25+', icon: MapPin },
  { label: 'Anonymous by Design', value: '100%', icon: ShieldCheck },
  { label: 'AI-Powered', value: 'Real-time', icon: Cpu },
  { label: 'Escalation Levels', value: '3-Tier', icon: TrendingUp },
];

const TAMIL_NADU_DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Vellore', 'Erode', 'Thoothukudi', 'Kancheepuram',
  'Thanjavur', 'Tiruppur', 'Dindigul', 'Namakkal', 'Krishnagiri',
  'Dharmapuri', 'Villupuram', 'Cuddalore'
];

export default function Landing() {
  const { isSignedIn } = useCivic();
  const [liveStats, setLiveStats] = useState(null);

  const [generalNews, setGeneralNews] = useState([]);
  const [localNews, setLocalNews] = useState([]);
  const [localPosts, setLocalPosts] = useState([]);
  const [govProjects, setGovProjects] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingLocalData, setLoadingLocalData] = useState(false);
  const [district, setDistrict] = useState('');
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | loading | success | denied
  const [activeTab, setActiveTab] = useState('news'); // news | posts | gov

  const fetchDashboardData = async (distName, coords = null) => {
    setLoadingLocalData(true);
    try {
      let newsParams = {};
      if (coords) {
        newsParams = { lat: coords.lat, lng: coords.lng };
      } else if (distName) {
        newsParams = { district: distName };
      }

      const newsRes = await api.get('/news', { params: newsParams });
      setGeneralNews(newsRes.data.generalNews || []);
      setLocalNews(newsRes.data.locationNews || []);
      const detectedDist = newsRes.data.district;

      if (detectedDist && detectedDist !== 'Unknown') {
        setDistrict(detectedDist);
        sessionStorage.setItem('detected_district', detectedDist);
        if (coords) {
          sessionStorage.setItem('detected_coords', JSON.stringify(coords));
        }

        const [postsRes, govRes] = await Promise.allSettled([
          api.get('/posts', { params: { district: detectedDist, limit: 5 } }),
          api.get(`/ai/gov-data/${detectedDist}`)
        ]);

        if (postsRes.status === 'fulfilled') {
          setLocalPosts(postsRes.value.data.posts || []);
        } else {
          console.warn('Failed to load local posts');
        }

        if (govRes.status === 'fulfilled') {
          setGovProjects(govRes.value.data.data || []);
        } else {
          console.warn('Failed to load government road projects');
        }
      }
      setLocationStatus('success');
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingLocalData(false);
      setLoadingNews(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        fetchDashboardData(null, coords);
      },
      (error) => {
        console.warn('Geolocation permission error:', error);
        setLocationStatus('denied');
      },
      { timeout: 8000 }
    );
  };

  const handleDistrictChange = (e) => {
    const selected = e.target.value;
    if (!selected) return;
    setDistrict(selected);
    fetchDashboardData(selected);
  };

  useEffect(() => {
    // Try to load public stats
    api.get('/analytics/public-stats')
      .then(res => setLiveStats(res.data))
      .catch(() => { }); // Graceful fail if endpoint not ready

    // Load initial news and check session location cache
    const initNews = async () => {
      const cachedDist = sessionStorage.getItem('detected_district');
      const cachedCoordsStr = sessionStorage.getItem('detected_coords');

      if (isSignedIn) {
        if (cachedDist) {
          setDistrict(cachedDist);
          setLocationStatus('success');
          if (cachedCoordsStr) {
            const coords = JSON.parse(cachedCoordsStr);
            fetchDashboardData(null, coords);
          } else {
            fetchDashboardData(cachedDist);
          }
        } else {
          try {
            const newsRes = await api.get('/news');
            setGeneralNews(newsRes.data.generalNews || []);
          } catch (err) {
            console.error('Failed to load general news:', err);
          } finally {
            setLoadingNews(false);
          }
        }
      } else {
        try {
          const newsRes = await api.get('/news');
          setGeneralNews(newsRes.data.generalNews || []);
        } catch (err) {
          console.error('Failed to load general news:', err);
        } finally {
          setLoadingNews(false);
        }
      }
    };

    initNews();
  }, [isSignedIn]);

  return (
    <div className="max-w-6xl mx-auto pb-16">

      {/* ── HERO ── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        className="relative overflow-hidden text-center py-16 md:py-24 px-6 md:px-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md mb-10 mt-4"
      >
        {/* Subtle civic infrastructure grid overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 opacity-[0.06] dark:opacity-[0.04] pointer-events-none select-none hidden md:block" aria-hidden="true">
          <svg className="w-full h-full text-[var(--teal-500)]" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.75">
            <path d="M15,15 L35,35 L65,15 L85,45 M35,35 L55,75 L75,55 M55,75 L25,85 M65,15 L75,55 M15,15 L55,75 M65,15 L25,85" />
            <circle cx="15" cy="15" r="1.5" fill="currentColor" />
            <circle cx="35" cy="35" r="1.5" fill="currentColor" />
            <circle cx="65" cy="15" r="1.5" fill="currentColor" />
            <circle cx="85" cy="45" r="1.5" fill="currentColor" />
            <circle cx="55" cy="75" r="1.5" fill="currentColor" />
            <circle cx="75" cy="55" r="1.5" fill="currentColor" />
            <circle cx="25" cy="85" r="1.5" fill="currentColor" />
          </svg>
        </div>

        {/* Platform badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[var(--border-strong)] bg-[var(--teal-glow)] text-[var(--teal-500)] text-xs font-semibold uppercase tracking-wider mb-6"
        >
          <ShieldCheck size={13} className="text-[var(--teal-500)]" />
          Tamil Nadu Civic Platform
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none text-[var(--text-primary)] mb-5"
        >
          Report Civic Issues.
          <span className="block mt-1 bg-gradient-to-r from-teal-600 via-teal-700 to-teal-800 dark:from-teal-300 dark:via-teal-400 dark:to-teal-500 bg-clip-text text-transparent">
            Anonymously. Instantly.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-sm md:text-base text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed"
        >
          CivicTN bridges citizens and government without exposing identities.
          Upload evidence, let AI classify it, and mobilize community support to resolve
          infrastructure failures across Tamil Nadu.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-wrap gap-3 justify-center"
        >
          <SignedIn>
            <Link to="/feed" className="btn btn-primary btn-lg">
              Explore Feed <ArrowRight size={15} />
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg">
                Get Started Free <ArrowRight size={15} />
              </button>
            </SignInButton>
          </SignedOut>
          <Link to="/map" className="btn btn-secondary btn-lg">
            <MapPin size={15} />
            View Civic Map
          </Link>
        </motion.div>
      </motion.section>

      {/* ── METRICS STRIP ── */}
      <StaggerContainer className="metrics-grid" inView={true}>
        {METRICS.map((m, i) => {
          const Icon = m.icon;
          return (
            <StaggerItem key={i}>
              <div className="bg-white dark:bg-slate-900 py-6 px-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 last:border-none">
                {Icon && <Icon className="text-[var(--teal-500)] dark:text-[var(--teal-400)] mb-2" size={20} />}
                <div
                  className="font-display text-2xl sm:text-3xl font-black mb-1 text-[var(--teal-500)] dark:text-[var(--teal-400)]"
                >
                  {liveStats && i === 0 ? `${liveStats.districts || 25}+` : m.value}
                </div>
                <div className="section-label">{m.label}</div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      <RevealOnScroll className="py-12">
        <div className="text-center mb-10 max-w-3xl mx-auto py-4">
          <div className="section-label mb-2 text-teal-600 dark:text-teal-400 font-bold">Real-Time Insights</div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            Civic & Infrastructure Intelligence Hub
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
            Stay updated with live infrastructure reports, government projects, and local news across Tamil Nadu.
          </p>
        </div>

        {/* Dashboard Box */}
        <div className="card p-6 md:p-8 relative overflow-hidden shadow-md">

          {/* Guest or Logged In without location */}
          {(!isSignedIn || locationStatus === 'idle') && (
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Globe className="text-[var(--teal-500)]" size={20} />
                  <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                    Tamil Nadu Infrastructure News
                  </h3>
                </div>
                {isSignedIn && (
                  <button onClick={detectLocation} className="btn btn-primary btn-sm">
                    <MapPin size={12} /> Personalize for My Location
                  </button>
                )}
                {!isSignedIn && (
                  <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-3 py-1 rounded-full border border-[var(--border-subtle)]">
                    Live Updates
                  </span>
                )}
              </div>

              {isSignedIn && locationStatus === 'idle' && (
                <div className="mb-6 p-4 rounded-xl border border-[var(--teal-400)]/20 bg-[var(--teal-glow)] flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-start gap-3">
                    <Compass className="text-[var(--teal-500)] mt-0.5 flex-shrink-0" size={18} />
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">Unlock Location-Based Civic Insights</h4>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        Share your browser location to automatically load government projects, local reports, and regional news specific to your district.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button onClick={detectLocation} className="btn btn-primary btn-sm flex-1 md:flex-none">
                      Detect My Location
                    </button>
                    <select onChange={handleDistrictChange} className="btn btn-secondary btn-sm flex-1 md:flex-none">
                      <option value="">Select District</option>
                      {TAMIL_NADU_DISTRICTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {loadingNews ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="card p-4 flex flex-col gap-3">
                      <div className="skeleton h-32 w-full rounded-lg" />
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generalNews.map((news, idx) => (
                    <a href={news.url} target="_blank" rel="noopener noreferrer" key={idx} className="card p-4 hover:scale-[1.01] hover:border-[var(--teal-400)] transition-all duration-300 flex flex-col sm:flex-row gap-4">
                      {news.imageUrl && (
                        <img src={news.imageUrl} alt={news.title} className="w-full sm:w-28 h-28 object-cover rounded-lg flex-shrink-0" />
                      )}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-bold text-[var(--teal-500)] uppercase tracking-wider bg-[var(--teal-glow)] px-1.5 py-0.5 rounded">
                              {news.source}
                            </span>
                            <span className="text-[9px] text-[var(--text-muted)]">
                              {new Date(news.publishedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-display text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug mb-1 hover:text-[var(--teal-500)] transition-colors">
                            {news.title}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {news.description}
                          </p>
                        </div>
                        <div className="text-[10px] font-bold text-[var(--teal-500)] flex items-center gap-1 mt-2">
                          Read Full Article <ExternalLink size={10} />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {isSignedIn && locationStatus !== 'idle' && (
            <div>
              {/* Geolocation Loading state */}
              {locationStatus === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--teal-500)] mb-4"></div>
                  <p className="text-xs text-[var(--text-secondary)] font-medium animate-pulse">
                    Detecting your district and compiling intelligence dashboard...
                  </p>
                </div>
              )}

              {/* Denied location prompt */}
              {locationStatus === 'denied' && (
                <div className="text-center py-8 max-w-sm mx-auto animate-fadeIn">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3 text-red-400">
                    <AlertTriangle size={18} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)] mb-1">
                    Location Access Unavailable
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-4">
                    Please select a district manually to view local infrastructure details:
                  </p>
                  <select onChange={handleDistrictChange} className="glass-input text-xs max-w-xs mx-auto">
                    <option value="">-- Select Tamil Nadu District --</option>
                    {TAMIL_NADU_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Success dashboard state */}
              {locationStatus === 'success' && (
                <div className="animate-fadeIn">
                  {/* Dashboard Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2.5">
                      <Compass className="text-[var(--teal-500)]" size={20} />
                      <div>
                        <h3 className="font-display text-lg font-bold text-[var(--text-primary)] leading-none">
                          Civic Dashboard: {district} District
                        </h3>
                        <span className="text-[10px] text-[var(--text-muted)] mt-1.5 block">
                          Real-time localized civic intelligence
                        </span>
                      </div>
                    </div>

                    {/* Navigation tabs */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <button
                        onClick={() => setActiveTab('news')}
                        className={`filter-pill ${activeTab === 'news' ? 'active' : ''}`}
                      >
                        <Newspaper size={12} /> News Updates
                      </button>
                      <button
                        onClick={() => setActiveTab('gov')}
                        className={`filter-pill ${activeTab === 'gov' ? 'active' : ''}`}
                      >
                        <Building2 size={12} /> Gov Projects
                      </button>
                      <button
                        onClick={() => setActiveTab('posts')}
                        className={`filter-pill ${activeTab === 'posts' ? 'active' : ''}`}
                      >
                        <Activity size={12} /> Local Alerts
                      </button>

                      <div className="h-4 w-px bg-[var(--border-default)] mx-1 hidden sm:block"></div>

                      {/* Manual switcher dropdown */}
                      <select onChange={handleDistrictChange} value={district} className="text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer">
                        {TAMIL_NADU_DISTRICTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dashboard Content Tabs */}
                  {loadingLocalData ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--teal-500)] mb-4"></div>
                      <p className="text-xs text-[var(--text-secondary)]">Loading local data...</p>
                    </div>
                  ) : (
                    <div>
                      {/* Tab 1: News (Local News + General News) */}
                      {activeTab === 'news' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Local News Column */}
                          <div className="lg:col-span-6 border-r-0 lg:border-r border-[var(--border-subtle)] pr-0 lg:pr-6">
                            <h4 className="font-display text-xs font-extrabold text-[var(--text-primary)] mb-4 flex items-center gap-1.5 uppercase tracking-wider">
                              <MapPin size={14} className="text-[var(--teal-400)]" />
                              Local Updates in {district}
                            </h4>
                            {localNews.length === 0 ? (
                              <div className="p-6 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
                                No specific infrastructure news found for {district} this week. Showing state updates.
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3">
                                {localNews.slice(0, 3).map((news, idx) => (
                                  <a href={news.url} target="_blank" rel="noopener noreferrer" key={idx} className="card p-3 hover:scale-[1.01] hover:border-[var(--teal-400)] transition-all duration-300 flex flex-col sm:flex-row gap-3">
                                    {news.imageUrl && (
                                      <img src={news.imageUrl} alt={news.title} className="w-full sm:w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                                    )}
                                    <div className="flex flex-col justify-between flex-1 min-w-0">
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-[9px] font-bold text-[var(--teal-500)] uppercase tracking-wider bg-[var(--teal-glow)] px-1.5 py-0.5 rounded">
                                            {news.source}
                                          </span>
                                        </div>
                                        <h5 className="font-display text-xs font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                                          {news.title}
                                        </h5>
                                      </div>
                                      <div className="text-[9px] text-[var(--text-muted)] mt-1.5">
                                        {new Date(news.publishedAt).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* State News Column */}
                          <div className="lg:col-span-6">
                            <h4 className="font-display text-xs font-extrabold text-[var(--text-primary)] mb-4 flex items-center gap-1.5 uppercase tracking-wider">
                              <Globe size={14} className="text-[var(--teal-400)]" />
                              Tamil Nadu Infrastructure News
                            </h4>
                            <div className="flex flex-col gap-3">
                              {generalNews.slice(0, 3).map((news, idx) => (
                                <a href={news.url} target="_blank" rel="noopener noreferrer" key={idx} className="card p-3 hover:scale-[1.01] hover:border-[var(--teal-400)] transition-all duration-300 flex flex-col sm:flex-row gap-3">
                                  {news.imageUrl && (
                                    <img src={news.imageUrl} alt={news.title} className="w-full sm:w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                                  )}
                                  <div className="flex flex-col justify-between flex-1 min-w-0">
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-[9px] font-bold text-[var(--teal-500)] uppercase tracking-wider bg-[var(--teal-glow)] px-1.5 py-0.5 rounded">
                                          {news.source}
                                        </span>
                                      </div>
                                      <h5 className="font-display text-xs font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                                        {news.title}
                                      </h5>
                                    </div>
                                    <div className="text-[9px] text-[var(--text-muted)] mt-1.5">
                                      {new Date(news.publishedAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Government Road Data (data.gov.in) */}
                      {activeTab === 'gov' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-display text-xs font-extrabold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                              <Building2 size={14} className="text-[var(--teal-400)]" />
                              Government Road Projects in {district}
                            </h4>
                            <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-full">
                              Source: data.gov.in
                            </span>
                          </div>
                          {govProjects.length === 0 ? (
                            <div className="p-8 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
                              No active government road datasets mapped to {district} at this time.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {govProjects.slice(0, 6).map((proj, idx) => (
                                <div key={idx} className="card p-4 bg-[var(--bg-surface)] flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                      <span className="text-[9px] font-semibold tracking-wider text-[var(--teal-500)] bg-[var(--teal-glow)] px-2 py-0.5 rounded uppercase">
                                        {proj.work_category || 'Road Work'}
                                      </span>
                                      {proj.sanctioned_cost && (
                                        <span className="text-[10px] font-bold text-[var(--text-primary)] whitespace-nowrap">
                                          ₹{proj.sanctioned_cost >= 10000000
                                            ? `${(proj.sanctioned_cost / 10000000).toFixed(2)} Cr`
                                            : `${(proj.sanctioned_cost / 100000).toFixed(1)} Lakh`
                                          }
                                        </span>
                                      )}
                                    </div>
                                    <h5 className="font-display text-xs font-bold text-[var(--text-primary)] line-clamp-2 mb-3 leading-snug">
                                      {proj.work_name || proj.road_name || 'Infrastructure Project'}
                                    </h5>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-[var(--border-subtle)] pt-2 mt-auto">
                                    <div>
                                      <span className="text-[var(--text-muted)] block">Department:</span>
                                      <div className="font-semibold text-[var(--text-secondary)] truncate">
                                        {proj.department_name || 'Highway / PWD'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-[var(--text-muted)] block">Length:</span>
                                      <div className="font-semibold text-[var(--text-secondary)]">
                                        {proj.road_length_km ? `${proj.road_length_km} km` : 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab 3: Local Reports (Platform Posts) */}
                      {activeTab === 'posts' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-display text-xs font-extrabold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                              <AlertTriangle size={14} className="text-[var(--teal-400)]" />
                              Unresolved Civic Reports in {district}
                            </h4>
                            <Link to="/feed" className="text-[10px] font-bold text-[var(--teal-500)] flex items-center gap-0.5">
                              View Full Feed <ChevronRight size={10} />
                            </Link>
                          </div>
                          {localPosts.length === 0 ? (
                            <div className="p-8 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
                              No unresolved incidents reported in {district} yet. Be the first to report!
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {localPosts.slice(0, 4).map((post, idx) => (
                                <Link to={`/posts/${post._id}`} key={idx} className="card p-4 bg-[var(--bg-surface)] flex justify-between items-center hover:scale-[1.005] transition-transform">
                                  <div className="min-w-0 flex-1 pr-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className={`severity-badge severity-${post.severity || 'medium'}`}>
                                        {post.severity}
                                      </span>
                                      <span className="text-[9px] text-[var(--text-muted)]">
                                        {new Date(post.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <h5 className="font-display text-sm font-bold text-[var(--text-primary)] truncate mb-1">
                                      {post.title}
                                    </h5>
                                    <p className="text-xs text-[var(--text-secondary)] truncate">
                                      {post.address || post.description}
                                    </p>
                                  </div>
                                  <ChevronRight size={16} className="text-[var(--text-muted)] flex-shrink-0" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </RevealOnScroll>

      {/* ── HOW IT WORKS ── */}
      <RevealOnScroll className="py-12">
        <div className="text-center mb-10 max-w-3xl mx-auto py-4">
          <div className="section-label mb-2 text-teal-600 dark:text-teal-400 font-bold">Process</div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            How CivicTN Works
          </h2>
        </div>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={idx}>
                <AnimatedCard className="card p-6 relative overflow-hidden h-full">
                  {/* Step number watermark */}
                  <div className="absolute top-3 right-4 font-display text-5xl font-black text-[var(--text-muted)] opacity-5 select-none leading-none">
                    {step.step}
                  </div>

                  <div
                    style={{ background: `${step.color}12`, borderColor: `${step.color}25` }}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center mb-5"
                  >
                    <Icon size={20} style={{ color: step.color }} />
                  </div>

                  <h3 className="font-display text-base font-bold text-[var(--text-primary)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {step.desc}
                  </p>
                </AnimatedCard>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </RevealOnScroll>

      {/* ── FEATURE GRID ── */}
      <RevealOnScroll className="py-12">
        <div className="text-center mb-10 max-w-3xl mx-auto py-4">
          <div className="section-label mb-2 text-teal-600 dark:text-teal-400 font-bold">Platform Capabilities</div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            Built for Impact
          </h2>
        </div>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={idx}>
                <div
                  className="card p-5 flex gap-4 items-start border-l-4 transition-all duration-300 hover:scale-[1.01]"
                  style={{ borderLeftColor: f.border }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderLeftColor = f.color;
                    e.currentTarget.style.background = f.bg;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderLeftColor = f.border;
                    e.currentTarget.style.background = 'var(--bg-surface)';
                  }}
                >
                  <div
                    style={{ background: f.bg, borderColor: f.border }}
                    className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0"
                  >
                    <Icon size={18} style={{ color: f.color }} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-[var(--text-primary)] mb-1">
                      {f.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </RevealOnScroll>

      {/* ── ESCALATION LEVELS INFO ── */}
      <RevealOnScroll className="py-12" delay={0.05}>
        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[var(--teal-500)]" />
            <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
              Auto-Escalation Engine
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
            Community support votes automatically escalate complaints to higher authorities when thresholds are reached.
          </p>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { count: '50+', label: 'Community Support', next: '→ Assistant Engineer', color: '#f97316' },
              { count: '100+', label: 'Community Support', next: '→ Executive Engineer', color: '#f43f5e' },
              { count: '200+', label: 'Community Support', next: '→ Municipal Commissioner', color: '#a855f7' },
            ].map((tier, i) => (
              <StaggerItem key={i}>
                <div
                  style={{ background: `${tier.color}08`, borderColor: `${tier.color}18` }}
                  className="p-4 rounded-xl border flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200"
                >
                  <div>
                    <div
                      style={{ color: tier.color }}
                      className="font-display text-2xl font-black mb-1"
                    >
                      {tier.count}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-semibold mb-2">
                      {tier.label}
                    </div>
                  </div>
                  <div style={{ color: tier.color }} className="text-xs font-bold">
                    {tier.next}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </RevealOnScroll>

      <RevealOnScroll className="py-12" delay={0.08}>
        <section className="text-center py-16 px-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-md">
          <h2 className="font-display text-2xl font-extrabold text-[var(--text-primary)] mb-2.5">
            Ready to Make Your City Better?
          </h2>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-6">
            Join thousands of citizens holding authorities accountable — anonymously.
          </p>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg">
                Start Reporting — It's Free <ArrowRight size={15} />
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link to="/submit" className="btn btn-primary btn-lg">
              Report a Civic Issue <ArrowRight size={15} />
            </Link>
          </SignedIn>
        </section>
      </RevealOnScroll>
    </div>
  );
}
