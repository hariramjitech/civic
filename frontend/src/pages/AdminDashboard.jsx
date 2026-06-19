import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { 
  Shield, Users, BarChart3, AlertCircle, Sparkles, 
  Trash2, Loader2, Award, Info, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { role, isSignedIn } = useCivic();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('telemetry');

  // AI analytics reports
  const [aiReport, setAiReport] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiRiskPredictions, setAiRiskPredictions] = useState(null);
  const [predictingRisk, setPredictingRisk] = useState(false);

  const fetchDashboardData = async () => {
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
      console.error(err);
      toast.error('Failed to sync administration panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isSignedIn, role]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('User authorization updated successfully!');
      
      // Update local cache
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      toast.error('Failed to change authorization role.');
    }
  };

  const handlePostHardDelete = async (postId) => {
    if (!window.confirm('Are you absolutely sure you want to permanently erase this report from database storage?')) return;
    try {
      await api.delete(`/admin/posts/${postId}`);
      toast.success('Incident deleted from servers.');
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to hard delete incident.');
    }
  };

  const generateAIReport = async () => {
    if (!stats) return;
    try {
      setGeneratingReport(true);
      setAiReport('');
      
      const res = await api.post('/ai/generate-report', {
        analyticsData: {
          stats: stats.stats,
          categoryBreakdown: stats.categoryBreakdown,
          districtBreakdown: stats.districtBreakdown
        }
      });
      
      setAiReport(res.data.report || 'No report returned.');
      toast.success('AI telemetry summary generated!');
    } catch (err) {
      toast.error('Failed to generate report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const predictInfrastructureRisk = async () => {
    try {
      setPredictingRisk(true);
      setAiRiskPredictions(null);
      
      const res = await api.post('/ai/predict-risk');
      setAiRiskPredictions(res.data.predictions);
      toast.success('Spatial risk forecast generated!');
    } catch (err) {
      toast.error('Prediction engine failed.');
    } finally {
      setPredictingRisk(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        <p className="text-gray-400 font-display">Opening platform console...</p>
      </div>
    );
  }

  // Double check authorization
  if (role !== 'admin' && role !== 'department' && role !== 'officer') {
    return (
      <div className="glass-panel p-8 rounded-2xl text-center max-w-md mx-auto space-y-4 py-16">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold font-display text-gray-200">Unauthorized Entrance</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Access to this system administration console is locked to authenticated officers, department engineers, and platform developers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Platform Security & Analytics Control
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            System administration, telemetry, role assignment, and Gemini AI analysis tools.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-2.5 rounded-lg border border-gray-800 bg-gray-950/20 hover:bg-gray-900 hover:text-teal-400 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Sub Tabs Toggle */}
      <div className="flex space-x-2 border-b border-gray-900 pb-2">
        <button
          onClick={() => setActiveSubTab('telemetry')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeSubTab === 'telemetry'
              ? 'border-teal-500 text-teal-400 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Telemetry Stats
        </button>
        {role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeSubTab === 'users'
                ? 'border-teal-500 text-teal-400 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            User Management ({users.length})
          </button>
        )}
        <button
          onClick={() => setActiveSubTab('ai')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeSubTab === 'ai'
              ? 'border-teal-500 text-teal-400 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          AI Analytics Suite
        </button>
      </div>

      {/* Panels content */}
      <div className="pt-2">
        {activeSubTab === 'telemetry' && stats && (
          <div className="space-y-6">
            {/* telemetry cards grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-xl border border-gray-900">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Reports</span>
                <div className="text-3xl font-extrabold text-teal-400 font-display mt-1.5">{stats.stats.totalPosts}</div>
              </div>
              <div className="glass-panel p-5 rounded-xl border border-gray-900">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Resolved Cases</span>
                <div className="text-3xl font-extrabold text-emerald-400 font-display mt-1.5">{stats.stats.resolvedPosts}</div>
              </div>
              <div className="glass-panel p-5 rounded-xl border border-gray-900">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Resolution Rate</span>
                <div className="text-3xl font-extrabold text-amber-400 font-display mt-1.5">{stats.stats.resolutionRate}%</div>
              </div>
              <div className="glass-panel p-5 rounded-xl border border-gray-900">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Critical Incidents</span>
                <div className="text-3xl font-extrabold text-rose-400 font-display mt-1.5">{stats.stats.criticalPosts}</div>
              </div>
            </div>

            {/* Split Telemetry Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Category stats breakdown */}
              <div className="glass-panel p-5 rounded-2xl border border-gray-900 space-y-4">
                <h3 className="text-sm font-bold font-display text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <BarChart3 size={16} className="text-teal-400" />
                  <span>Category Breakdown</span>
                </h3>
                
                <div className="space-y-3.5 pt-2">
                  {stats.categoryBreakdown?.map((cat, idx) => {
                    const pct = Math.round((cat.count / stats.stats.totalPosts) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-400 capitalize">{cat._id}</span>
                          <span className="text-gray-550">{cat.count} cases ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden border border-gray-850">
                          <div className="bg-teal-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top District breakdown list */}
              <div className="glass-panel p-5 rounded-2xl border border-gray-900 space-y-4">
                <h3 className="text-sm font-bold font-display text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users size={16} className="text-teal-400" />
                  <span>District Incident Distribution</span>
                </h3>

                <div className="space-y-3.5 pt-2">
                  {stats.districtBreakdown?.map((dist, idx) => {
                    const rate = dist.count ? Math.round((dist.resolved / dist.count) * 100) : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-900/60">
                        <span className="font-bold text-gray-300">{dist._id}</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400">{dist.count} cases</span>
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 border border-emerald-500/20 rounded font-bold">
                            {rate}% Resolved
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Top Intensity reports & removal panel */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-900 space-y-4">
              <h3 className="text-sm font-bold font-display text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <AlertCircle size={16} className="text-rose-500" />
                <span>Top Active High-Intensity Incident Records</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-900 text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">District</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Intensity</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topIntensity?.map((post) => (
                      <tr key={post._id} className="border-b border-gray-900 hover:bg-gray-900/25 transition-colors">
                        <td className="py-3 px-3 font-semibold text-gray-300 truncate max-w-xs">{post.title}</td>
                        <td className="py-3 px-3 text-gray-400">{post.district}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                            post.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {post.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-gray-200">{post.intensityScore} 🔥</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handlePostHardDelete(post._id)}
                            className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* User permissions role updating */}
        {activeSubTab === 'users' && role === 'admin' && (
          <div className="glass-panel p-5 rounded-2xl border border-gray-900 space-y-4">
            <h3 className="text-sm font-bold font-display text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Users size={16} className="text-teal-400" />
              <span>User Authentication Registry</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-900 text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Display Name</th>
                    <th className="py-2.5 px-3">Clerk ID</th>
                    <th className="py-2.5 px-3">District Region</th>
                    <th className="py-2.5 px-3">Platform Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="border-b border-gray-900">
                      <td className="py-3 px-3 font-semibold text-gray-200">{user.displayName || 'Citizen Member'}</td>
                      <td className="py-3 px-3 font-mono text-[10px] text-gray-500">{user.clerkId}</td>
                      <td className="py-3 px-3 text-gray-400">{user.district || 'Not Configured'}</td>
                      <td className="py-3 px-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user._id, e.target.value)}
                          className="bg-gray-900 border border-gray-800 rounded p-1 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
                        >
                          <option value="citizen">Citizen</option>
                          <option value="officer">Field Officer</option>
                          <option value="department">Department Head</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gemini AI report generation tools */}
        {activeSubTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Generate Summary report */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-900 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-sm font-bold font-display text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles size={16} className="text-teal-400" />
                  <span>Gemini AI Telemetry Synthesizer</span>
                </h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Processes district distributions, category statistics, and unresolved case ratios through Gemini API to compile an executive decision summary report automatically.
                </p>
              </div>

              {aiReport && (
                <div className="p-4 rounded-xl bg-gray-950/40 border border-gray-900 font-sans text-xs text-gray-300 leading-relaxed max-h-[30vh] overflow-y-auto whitespace-pre-wrap">
                  {aiReport}
                </div>
              )}

              <button
                onClick={generateAIReport}
                disabled={generatingReport}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:from-gray-850 disabled:to-gray-900 text-gray-900 font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                    <span>Synthesizing Telemetry...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Compile AI Executive Report</span>
                  </>
                )}
              </button>
            </div>

            {/* Risk prediction engine */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-900 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-sm font-bold font-display text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Award size={16} className="text-amber-400" />
                  <span>Spatial Risk Forecast Engine</span>
                </h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Models historical incident cluster frequencies, average categories severity ratios, and geographical distribution to project top high-risk zones across Tamil Nadu.
                </p>
              </div>

              {aiRiskPredictions && (
                <div className="p-4 rounded-xl bg-gray-950/40 border border-gray-900 text-xs space-y-2 max-h-[30vh] overflow-y-auto">
                  <div className="text-[10px] text-gray-550 uppercase font-extrabold tracking-wider border-b border-gray-850 pb-1.5 mb-1.5">Model Projections</div>
                  
                  {aiRiskPredictions.map((pred, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-gray-900 pb-1.5">
                      <div>
                        <div className="font-bold text-gray-300">{pred.district} ({pred.category})</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Confidence: {Math.round(pred.confidence * 100)}%</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        {pred.riskLevel} Risk
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={predictInfrastructureRisk}
                disabled={predictingRisk}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:from-gray-850 disabled:to-gray-900 text-gray-900 font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {predictingRisk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                    <span>Modeling Incidents...</span>
                  </>
                ) : (
                  <>
                    <BarChart3 size={14} />
                    <span>Run Spatial Risk Model</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
