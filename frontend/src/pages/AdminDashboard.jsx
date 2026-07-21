import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import {
  Shield, Users, BarChart3, AlertCircle, Sparkles,
  Trash2, Loader2, Award, RefreshCw, Download, TrendingUp,
  CheckSquare, ArrowUpRight, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import { motion, AnimatePresence } from 'framer-motion';
import StaggerContainer, { StaggerItem } from '../components/StaggerContainer';
import RevealOnScroll from '../components/RevealOnScroll';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'users', label: 'Users', icon: Users, adminOnly: true },
  { key: 'incidents', label: 'Incidents', icon: AlertCircle },
  { key: 'ai', label: 'AI Suite', icon: Sparkles },
];

function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="section-label">{label}</span>
        {Icon && <Icon size={16} style={{ color }} />}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, count, total, color = 'var(--teal-500)' }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{count} &nbsp;<span style={{ opacity: 0.6 }}>({pct}%)</span></span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { role, isSignedIn } = useCivic();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // AI
  const [aiReport, setAiReport] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiRiskPredictions, setAiRiskPredictions] = useState(null);
  const [predictingRisk, setPredictingRisk] = useState(false);

  const fetchData = async () => {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      const statsRes = await api.get('/analytics/dashboard');
      setStats(statsRes.data);
      if (role === 'admin') {
        const usersRes = await api.get('/admin/users');
        setUsers(usersRes.data.users || []);
      }
    } catch (err) {
      toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [isSignedIn, role]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('Role updated.');
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
    } catch { toast.error('Failed.'); }
  };

  const handleStatusChange = async (postId, newStatus) => {
    try {
      await api.patch(`/posts/${postId}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      fetchData();
    } catch { toast.error('Status update failed. Backend endpoint may be needed.'); }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Permanently delete this report?')) return;
    try {
      await api.delete(`/admin/posts/${postId}`);
      toast.success('Report deleted.');
      fetchData();
    } catch { toast.error('Delete failed.'); }
  };

  const generateAIReport = async () => {
    if (!stats) return;
    try {
      setGeneratingReport(true);
      setAiReport('');
      const res = await api.post('/ai/generate-report', {
        analyticsData: { stats: stats.stats, categoryBreakdown: stats.categoryBreakdown, districtBreakdown: stats.districtBreakdown }
      });
      setAiReport(res.data.report || 'No report generated.');
      toast.success('AI report generated!');
    } catch { toast.error('Report generation failed.'); } finally { setGeneratingReport(false); }
  };

  const downloadReport = () => {
    if (!aiReport) { toast.error('Generate a report first.'); return; }
    const content = `CivicTN AI Analytics Report\nGenerated: ${new Date().toLocaleString()}\n\n${aiReport}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `civictn-report-${Date.now()}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const predictRisk = async () => {
    try {
      setPredictingRisk(true);
      setAiRiskPredictions(null);
      const res = await api.post('/ai/predict-risk');
      setAiRiskPredictions(res.data.predictions);
      toast.success('Risk predictions generated!');
    } catch { toast.error('Prediction failed.'); } finally { setPredictingRisk(false); }
  };

  if (loading) return (
    <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Loader2 size={32} style={{ color: 'var(--teal-400)', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading dashboard...</p>
    </div>
  );

  if (role !== 'admin' && role !== 'department' && role !== 'officer') return (
    <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 400, margin: '60px auto' }}>
      <AlertCircle size={40} style={{ color: '#f43f5e', marginBottom: 16 }} />
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Unauthorized</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Access is restricted to officers, department heads, and administrators.
      </p>
    </div>
  );

  const allowedTabs = TABS.filter(t => !t.adminOnly || role === 'admin');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800,
            background: 'linear-gradient(135deg, var(--teal-400), #6ee7b7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: 4,
          }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Telemetry, user management, and AI analytics.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn btn-secondary btn-sm"
          title="Refresh data"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── TAB BAR ── */}
      <div className="tab-bar">
        {allowedTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {activeTab === 'overview' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StatCard label="Total Reports" value={stats.stats.totalPosts} color="var(--teal-400)" icon={BarChart3} />
                <StatCard label="Resolved Cases" value={stats.stats.resolvedPosts} color="#4ade80" icon={CheckSquare} />
                <StatCard label="Resolution Rate" value={`${stats.stats.resolutionRate}%`} color="#eab308" icon={TrendingUp} sub="of all reports resolved" />
                <StatCard label="Critical Incidents" value={stats.stats.criticalPosts} color="var(--sev-critical)" icon={AlertCircle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BarChart3 size={15} style={{ color: 'var(--teal-400)' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>By Category</span>
                  </div>
                  {stats.categoryBreakdown?.map((cat, i) => (
                    <BarRow key={i} label={cat._id} count={cat.count} total={stats.stats.totalPosts} />
                  ))}
                </div>
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Users size={15} style={{ color: 'var(--teal-400)' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>By District</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {stats.districtBreakdown?.map((dist, i) => {
                      const rate = dist.count ? Math.round((dist.resolved / dist.count) * 100) : 0;
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12,
                        }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{dist._id}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{dist.count} cases</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)',
                            }}>
                              {rate}% resolved
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                  <ArrowUpRight size={15} style={{ color: '#f97316' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Escalation Engine Rules</span>
                </div>
                <div className="category-grid">
                  {[
                    { threshold: '50+', to: 'Assistant Engineer', color: '#f97316' },
                    { threshold: '100+', to: 'Executive Engineer', color: '#f43f5e' },
                    { threshold: '200+', to: 'Municipal Commissioner', color: '#a855f7' },
                  ].map((e, i) => (
                    <div key={i} style={{
                      padding: '12px 14px', borderRadius: 8,
                      background: `${e.color}08`, border: `1px solid ${e.color}20`,
                    }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: e.color, marginBottom: 4 }}>
                        {e.threshold}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>support votes</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: e.color, marginTop: 6 }}>→ {e.to}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'incidents' && stats && (
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertCircle size={15} style={{ color: '#f43f5e' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>High-Intensity Incidents</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Title', 'District', 'Severity', 'Intensity', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)',
                          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topIntensity?.map(post => (
                      <tr key={post._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{post.title}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{post.district}</td>
                        <td style={{ padding: '12px 8px' }}><SeverityBadge severity={post.severity} /></td>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{post.intensityScore} 🔥</td>
                        <td style={{ padding: '12px 8px' }}>
                          <select value={post.status} onChange={e => handleStatusChange(post._id, e.target.value)} className="glass-input" style={{ fontSize: 11 }}>
                            <option value="reported">Reported</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <button onClick={() => handleDelete(post._id)} className="btn btn-danger btn-sm"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && role === 'admin' && (
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Users size={15} style={{ color: 'var(--teal-400)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>User Registry</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['User', 'ID', 'District', 'Role'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontSize: 10 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 8px' }}>{u.displayName}</td>
                        <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{u.clerkId.slice(0, 8)}</td>
                        <td style={{ padding: '12px 8px' }}>{u.district}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <select value={u.role} onChange={e => handleRoleChange(u._id, e.target.value)} className="glass-input" style={{ fontSize: 11 }}>
                            <option value="citizen">Citizen</option>
                            <option value="officer">Officer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Sparkles size={15} style={{ color: 'var(--teal-400)' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>AI Report</span>
                </div>
                {aiReport && <div style={{ fontSize: 12, background: 'var(--bg-elevated)', padding: 12, borderRadius: 8 }}>{aiReport}</div>}
                <button onClick={generateAIReport} disabled={generatingReport} className="btn btn-primary">{generatingReport ? 'Generating...' : 'Generate'}</button>
              </div>
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Award size={15} style={{ color: '#eab308' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Risk Forecast</span>
                </div>
                {aiRiskPredictions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {aiRiskPredictions.map((p, i) => <div key={i} style={{ fontSize: 12 }}>{p.district}: {p.riskLevel}</div>)}
                  </div>
                )}
                <button onClick={predictRisk} disabled={predictingRisk} className="btn btn-primary">{predictingRisk ? 'Modeling...' : 'Run Model'}</button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
