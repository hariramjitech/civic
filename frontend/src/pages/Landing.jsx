import React, { useState, useEffect } from 'react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, EyeOff, Sparkles, Users, MapPin, ArrowRight,
  Camera, Cpu, PhoneCall, BarChart2, TrendingUp, Clock,
  Globe, Compass, Newspaper, Building2, Activity, ExternalLink, AlertTriangle, ChevronRight, CheckCircle2
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
    desc: 'Cryptographically protected. No names, phone numbers, or account details are ever published on public feeds.',
    color: 'var(--teal-500)',
    bg: 'rgba(99, 102, 241, 0.04)',
    border: 'rgba(99, 102, 241, 0.1)'
  },
  {
    icon: Sparkles,
    title: 'Gemini AI Audits',
    desc: 'Every upload is automatically categorized, assigned a severity index, and cross-checked for duplicate issues.',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.04)',
    border: 'rgba(139, 92, 246, 0.1)'
  },
  {
    icon: MapPin,
    title: 'Smart Geo-Routing',
    desc: 'Attached GPS pins resolve the specific district boundaries, immediately identifying the correct local authorities.',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.04)',
    border: 'rgba(16, 185, 129, 0.1)'
  },
  {
    icon: Users,
    title: 'Mobilized Strike Rooms',
    desc: 'Unresolved issues open communal Strike Rooms. Pool petitions and escalate claims to department heads.',
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.04)',
    border: 'rgba(244, 63, 94, 0.1)'
  }
];

const METRICS = [
  { label: 'Active Districts', value: '38 Districts', icon: MapPin },
  { label: 'Anonymity Shield', value: '100% Secure', icon: ShieldCheck },
  { label: 'AI Validation', size: '250ms Rate', value: 'Instant', icon: Cpu },
  { label: 'Escalation Speed', value: '3-Tier Flow', icon: TrendingUp }
];

const TAMIL_NADU_DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur',
  'Dindigul', 'Ranipet', 'Tirupathur', 'Tenkasi', 'Chengalpattu',
  'Kanchipuram', 'Tiruvallur', 'Tiruppur', 'Karur', 'Namakkal',
  'Nilgiris', 'Cuddalore', 'Villupuram', 'Krishnagiri', 'Dharmapuri'
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
        }
        if (govRes.status === 'fulfilled') {
          setGovProjects(govRes.value.data.data || []);
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
    api.get('/analytics/public-stats')
      .then(res => setLiveStats(res.data))
      .catch(() => {});

    const initNews = async () => {
      const cachedDist = sessionStorage.getItem('detected_district');
      const cachedCoordsStr = sessionStorage.getItem('detected_coords');

      if (cachedDist) {
        setDistrict(cachedDist);
        setLocationStatus('success');
        if (cachedCoordsStr) {
          fetchDashboardData(null, JSON.parse(cachedCoordsStr));
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
    };

    initNews();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16 space-y-12">
      
      {/* Lightweight Landing Brand Header (No App Nav Links) */}
      <header className="w-full py-4.5 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 mb-4 no-print">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/10"
            style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
          >
            <span className="text-white text-sm font-black">C</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-lg tracking-tight text-slate-900 dark:text-white leading-none">
              CivicTN
            </span>
            <span className="text-[8px] font-bold tracking-widest text-slate-400 dark:text-zinc-500 uppercase mt-1">
              Infrastructure
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <SignedIn>
            <Link
              to="/feed"
              className="text-xs font-bold text-white px-4 py-2.5 rounded-xl transition-all shadow-md hover:opacity-90 no-underline"
              style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
            >
              Enter App Dashboard
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-[var(--teal-500)] dark:hover:text-white transition-colors cursor-pointer px-4.5 py-2.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                Sign In
              </button>
            </SignInButton>
            <SignInButton mode="modal">
              <button
                className="text-xs font-bold text-white px-4.5 py-2.5 rounded-xl shadow-teal cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
              >
                Onboard Now
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────── */}
      {/*  HERO SECTION (Premium Dual Columns)                       */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4 lg:pt-10">
        
        {/* Left Column: Brand Copy & Subtitle */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--teal-500)]/15 bg-[var(--teal-glow)] text-[var(--teal-500)] text-xs font-semibold tracking-wide"
          >
            <ShieldCheck size={14} />
            Secure & Anonymous Infrastructure Audits
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] text-[var(--text-primary)]"
          >
            Empower Your District. <br />
            <span className="bg-gradient-to-r from-[var(--teal-500)] to-[var(--teal-600)] bg-clip-text text-transparent">
              Report Anonymously.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-xl"
          >
            CivicTN bridges citizens and government without exposing identities.
            Upload infrastructure defects, let Gemini AI cross-verify claims instantly, 
            and mobilize signature petitions to hold public departments accountable.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-wrap gap-3.5"
          >
            <SignedIn>
              <Link to="/feed" className="btn btn-primary px-6 py-3 text-sm rounded-xl font-bold flex items-center gap-2 shadow-teal">
                Enter Social Feed <ArrowRight size={15} />
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-primary px-6 py-3 text-sm rounded-xl font-bold flex items-center gap-2 shadow-teal cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Onboard & Get Started <ArrowRight size={15} />
                </button>
              </SignInButton>
            </SignedOut>

            <Link to="/map" className="btn btn-secondary px-6 py-3 text-sm rounded-xl font-bold flex items-center gap-2 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200">
              <MapPin size={15} className="text-[var(--teal-500)]" />
              Geographic Map
            </Link>
          </motion.div>
        </div>

        {/* Right Column: Dynamic Join Panel or Instant Dashboard Access */}
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6 shadow-xl space-y-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-display font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Compass className="text-[var(--teal-500)]" size={18} />
                District Dashboard
              </h3>
              <span className="text-[10px] text-zinc-400 font-bold bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-slate-200/40 dark:border-zinc-800">
                Live Data
              </span>
            </div>

            {/* District Select or Detect */}
            <div className="space-y-3.5">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Check active reports, municipal announcements, and ongoing infrastructure upgrades in your neighborhood.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={detectLocation}
                  className="flex-1 btn btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <MapPin size={14} /> Detect Location
                </button>
                <select
                  onChange={handleDistrictChange}
                  value={district}
                  className="flex-1 glass-input text-xs rounded-xl py-2.5 border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50"
                >
                  <option value="">Choose District</option>
                  {TAMIL_NADU_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick platform facts */}
            <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-slate-100 dark:border-zinc-800 text-left">
              <div className="p-3 bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block">Incidents Logged</span>
                <span className="text-lg font-black text-[var(--teal-500)] mt-0.5 block">
                  {liveStats ? `${liveStats.totalIncidents || 0}` : '1,840+'}
                </span>
              </div>
              <div className="p-3 bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block">Resolved Rate</span>
                <span className="text-lg font-black text-emerald-500 mt-0.5 block">
                  {liveStats ? `${liveStats.resolvedPercentage || 0}%` : '87.4%'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/*  METRICS / STATISTICS STRIP                                */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200/60 dark:border-zinc-800/60 p-6 shadow-sm">
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center" inView={true}>
          {METRICS.map((m, i) => {
            const Icon = m.icon;
            return (
              <StaggerItem key={i} className="flex flex-col items-center justify-center p-3">
                {Icon && <Icon className="text-[var(--teal-500)] mb-2" size={20} />}
                <div className="font-display text-xl sm:text-2xl font-black text-[var(--teal-500)]">
                  {liveStats && i === 0 ? `${liveStats.districts || 38} Districts` : m.value}
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-1">
                  {m.label}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/*  DYNAMIC INTEL FEED (NEWS, LOCAL POSTS, GOV DATA)          */}
      {/* ────────────────────────────────────────────────────────── */}
      {locationStatus === 'success' && district ? (
        <RevealOnScroll className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-zinc-800/60">
            <div>
              <h2 className="font-display text-2xl font-black text-[var(--text-primary)]">
                Regional Hub: {district}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Personalized analytics compiled for your locality.
              </p>
            </div>
            
            {/* Quick tabs bar */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/50 p-1 rounded-xl">
              {[
                { id: 'news', label: 'News Updates', icon: Newspaper },
                { id: 'gov', label: 'Gov Projects', icon: Building2 },
              ].map(t => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === t.id
                        ? 'bg-white dark:bg-zinc-900 text-[var(--teal-500)] shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <TabIcon size={13} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loadingLocalData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 p-4 rounded-2xl flex flex-col gap-3">
                  <div className="skeleton h-24 w-full rounded-xl" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-fadeIn">
              
              {/* Tab Content: News */}
              {activeTab === 'news' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {localNews.length > 0 ? (
                    localNews.map((news, idx) => (
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={idx}
                        className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 p-4 rounded-2xl hover:scale-[1.01] hover:border-[var(--teal-500)] transition-all duration-300 flex gap-4"
                      >
                        {news.imageUrl && (
                          <img src={news.imageUrl} alt={news.title} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl flex-shrink-0 bg-slate-100" />
                        )}
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[8px] font-black uppercase tracking-wider bg-[var(--teal-glow)] text-[var(--teal-500)] px-1.5 py-0.5 rounded">
                                {news.source}
                              </span>
                              <span className="text-[9px] text-zinc-400">
                                {new Date(news.publishedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h4 className="font-display text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug hover:text-[var(--teal-500)]">
                              {news.title}
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold text-[var(--teal-500)] flex items-center gap-1 mt-2.5">
                            Full Coverage <ExternalLink size={10} />
                          </span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-10 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                      <Newspaper className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={24} />
                      <p className="text-xs text-[var(--text-muted)] font-medium">No recent local articles detected in {district}.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Gov Road Projects */}
              {activeTab === 'gov' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {govProjects.length > 0 ? (
                    govProjects.map((proj, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 p-4.5 rounded-2xl flex flex-col justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">
                              {proj.department || 'TNDR'}
                            </span>
                            <span className="text-[9px] text-zinc-400 font-bold">
                              Est: {proj.estimatedCost || 'N/A'}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-snug">
                            {proj.title}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed line-clamp-2">
                            {proj.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-3 border-t border-slate-100 dark:border-zinc-800 mt-1">
                          <span className="text-zinc-400 font-semibold">Status: <strong className="text-[var(--text-primary)]">{proj.status || 'Planned'}</strong></span>
                          <span className="text-zinc-400 font-semibold">Target: <strong className="text-[var(--text-primary)]">{proj.completionDate || '2026'}</strong></span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-10 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                      <Building2 className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={24} />
                      <p className="text-xs text-[var(--text-muted)] font-medium">No official municipal projects listed in {district}.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </RevealOnScroll>
      ) : (
        <RevealOnScroll className="space-y-6">
          <div className="pb-3 border-b border-slate-200/60 dark:border-zinc-800/60 text-left">
            <h2 className="font-display text-2xl font-black text-[var(--text-primary)]">
              Trending Tamil Nadu Infrastructure News
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Top reports and government updates collected region-wide.
            </p>
          </div>

          {loadingNews ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 p-4 rounded-2xl flex flex-col gap-3">
                  <div className="skeleton h-24 w-full rounded-xl" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generalNews.map((news, idx) => (
                <a
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={idx}
                  className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 p-4 rounded-2xl hover:scale-[1.01] hover:border-[var(--teal-500)] transition-all duration-300 flex gap-4"
                >
                  {news.imageUrl && (
                    <img src={news.imageUrl} alt={news.title} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl flex-shrink-0 bg-slate-100" />
                  )}
                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[8px] font-black uppercase tracking-wider bg-[var(--teal-glow)] text-[var(--teal-500)] px-1.5 py-0.5 rounded">
                          {news.source}
                        </span>
                        <span className="text-[9px] text-zinc-400">
                          {new Date(news.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-display text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug hover:text-[var(--teal-500)]">
                        {news.title}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--teal-500)] flex items-center gap-1 mt-2.5">
                      View Source <ExternalLink size={10} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </RevealOnScroll>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/*  FEATURES & ADVANTAGES                                     */}
      {/* ────────────────────────────────────────────────────────── */}
      <RevealOnScroll className="space-y-6">
        <div className="text-center py-4">
          <span className="text-xs font-bold text-[var(--teal-500)] uppercase tracking-wider">Features Overview</span>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-1.5">
            Designed for Citizens. Backed by AI.
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-xl mx-auto">
            An overview of the built-in services providing reliable reporting and direct public mobilization.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-left">
          {FEATURES.map((f, i) => {
            const FeatIcon = f.icon;
            return (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 p-5 rounded-3xl flex gap-4 transition-all duration-300 hover:shadow-md"
                style={{ borderColor: f.border }}
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: f.bg, color: f.color }}
                >
                  <FeatIcon size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{f.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </RevealOnScroll>
      
    </div>
  );
}
