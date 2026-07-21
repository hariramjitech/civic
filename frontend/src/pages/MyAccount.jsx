import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import {
  User, MapPin, Heart, MessageSquare, FileText,
  Settings, Loader2, Calendar, ShieldAlert, CheckCircle,
  Flame, Award
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusTimeline from '../components/StatusTimeline';
import AnimatedCard from '../components/AnimatedCard';
import StaggerContainer, { StaggerItem } from '../components/StaggerContainer';


const DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur',
  'Dindigul', 'Ranipet', 'Tirupathur', 'Tenkasi', 'Chengalpattu',
  'Kanchipuram', 'Tiruvallur', 'Tiruppur', 'Karur', 'Namakkal',
  'Nilgiris', 'Cuddalore', 'Villupuram', 'Krishnagiri', 'Dharmapuri',
];

const ROLE_COLORS = {
  admin: '#a855f7',
  department: '#3b82f6',
  officer: '#f97316',
  citizen: 'var(--teal-400)',
};

export default function MyAccount() {
  const { userProfile, role, updateDistrict, isSignedIn } = useCivic();
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [myPosts, setMyPosts] = useState([]);
  const [myComments, setMyComments] = useState([]);
  const [myLikes, setMyLikes] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');

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
    if (userProfile?.district) setSelectedDistrict(userProfile.district);
  }, [isSignedIn, userProfile]);

  const handleDistrictUpdate = async (e) => {
    e.preventDefault();
    if (!selectedDistrict) return;
    await updateDistrict(selectedDistrict);
  };

  // Compute civic score
  const civicScore = myPosts.length * 10 + myComments.length * 2 + myLikes.length;
  const totalIntensity = myPosts.reduce((sum, p) => sum + (p.intensityScore || 0), 0);

  if (loading) return (
    <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Loader2 size={32} style={{ color: 'var(--teal-400)', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading your profile...</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-6xl mx-auto w-full flex flex-col gap-5"
    >

      {/* ── PROFILE HEADER ── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>

          {/* Avatar + Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--bg-elevated)', border: `2px solid ${ROLE_COLORS[role] || 'var(--border-default)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: ROLE_COLORS[role] || 'var(--teal-400)',
              flexShrink: 0,
            }}>
              <User size={24} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                {userProfile?.displayName || 'Citizen Member'}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: ROLE_COLORS[role], background: `${ROLE_COLORS[role]}15`,
                  border: `1px solid ${ROLE_COLORS[role]}30`, padding: '2px 8px', borderRadius: 4,
                }}>
                  {role}
                </span>
                {userProfile?.district && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                    color: 'var(--text-muted)', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: 4,
                  }}>
                    <MapPin size={10} /> {userProfile.district}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Civic Score */}
          <div style={{
            textAlign: 'center', padding: '12px 20px',
            background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.15)',
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 4 }}>
              <Award size={14} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-400)' }}>
                Civic Score
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: 'var(--teal-400)' }}>
              {civicScore}
            </div>
          </div>
        </div>

        {/* District update form */}
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
          <form onSubmit={handleDistrictUpdate} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Settings size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Home District:
            </label>
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className="glass-input"
              style={{ flex: 1, minWidth: 160, maxWidth: 240 }}
            >
              <option value="">Select district...</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
              Update
            </button>
          </form>
        </div>
      </div>

      {/* ── STATS ── */}
      <StaggerContainer className="stats-grid">
        {[
          { label: 'Reports Filed', value: myPosts.length, color: 'var(--teal-400)', icon: FileText },
          { label: 'Comments', value: myComments.length, color: '#a78bfa', icon: MessageSquare },
          { label: 'Liked', value: myLikes.length, color: '#f87171', icon: Heart },
          { label: 'Total Intensity', value: totalIntensity, color: '#f97316', icon: Flame },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <StaggerItem key={i}>
              <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Icon size={13} style={{ color: s.color }} />
                <span className="section-label">{s.label}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
            </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* ── PRIVACY NOTICE ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
        background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.12)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)',
      }}>
        <ShieldAlert size={15} style={{ color: '#f43f5e', flexShrink: 0, marginTop: 1 }} />
        <p style={{ lineHeight: 1.65 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Privacy:</strong> Your identity remains completely masked in all public records, maps, and feeds — even from administrators.
        </p>
      </div>

      {/* ── HISTORY TABS ── */}
      <div className="tab-bar" style={{ marginBottom: -8 }}>
        {[
          { key: 'posts', label: `My Reports (${myPosts.length})` },
          { key: 'comments', label: `Comments (${myComments.length})` },
          { key: 'likes', label: `Liked (${myLikes.length})` },
        ].map(t => (
          <button key={t.key} className={`tab-item ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MY POSTS ── */}
      {activeTab === 'posts' && (
        myPosts.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
            You haven't filed any civic reports yet.
          </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {myPosts.map(post => (
              <div key={post._id} className="card animate-slideInUp" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SeverityBadge severity={post.severity} />
                  <span className={`status-pill status-${(post.status || 'reported').replace('_', '-').replace('under-review', 'review')}`}>
                    {post.status?.replace('_', ' ') || 'reported'}
                  </span>
                </div>
                <Link to={`/posts/${post._id}`} style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none', lineHeight: 1.3 }}
                  onMouseEnter={e => e.target.style.color = 'var(--teal-400)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-primary)'}
                >
                  {post.title}
                </Link>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }} className="truncate-2">{post.description}</p>

                {/* Mini timeline */}
                <StatusTimeline status={post.status || 'reported'} compact />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={10} />
                    {new Date(post.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#f97316' }}>
                    <Flame size={10} />
                    {post.intensityScore || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* ── COMMENTS ── */}
      {activeTab === 'comments' && (
        myComments.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
            No comments written yet.
          </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myComments.map(comment => (
              <div key={comment._id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>
                    On:{' '}
                    {comment.postId ? (
                      <Link to={`/posts/${comment.postId._id}`} style={{ color: 'var(--teal-400)' }}>
                        {comment.postId.title}
                      </Link>
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Deleted</span>
                    )}
                  </span>
                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  "{comment.text}"
                </p>
              </div>
            ))}
          </div>
      )}

      {/* ── LIKES ── */}
      {activeTab === 'likes' && (
        myLikes.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
            No liked posts yet.
          </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {myLikes.map(post => (
              <div key={post._id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SeverityBadge severity={post.severity} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {post.status?.replace('_', ' ') || 'reported'}
                  </span>
                </div>
                <Link to={`/posts/${post._id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.color = 'var(--teal-400)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-primary)'}
                >
                  {post.title}
                </Link>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }} className="truncate-2">{post.description}</p>
              </div>
            ))}
          </div>
      )}
    </motion.div>
  );
}
