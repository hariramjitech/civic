import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import {
  Heart, MessageSquare, Phone, Mail, Globe, MapPin,
  AlertTriangle, ArrowLeft, Send, Plus, Flame, Clock,
  CheckCircle, Loader2, Trash2, Volume2, VolumeX
} from 'lucide-react';
import toast from 'react-hot-toast';

function renderMarkdownText(text = '') {
  const lines = String(text).split(/\n+/).filter(Boolean);
  const boldPattern = /\*\*(.+?)\*\*/g;

  return lines.map((line, lineIndex) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldPattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`b-${lineIndex}-${match.index}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) =>
          typeof part === 'string' ? <React.Fragment key={`t-${lineIndex}-${partIndex}`}>{part}</React.Fragment> : part
        )}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, role, userProfile, socket } = useCivic();
  const [data, setData] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState({});
  const [showReplyForm, setShowReplyForm] = useState({});
  const [activeImg, setActiveImg] = useState(0);

  // Accessibility speech state
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakPost = () => {
    if (!window.speechSynthesis) {
      toast.error('Text-to-speech not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const narrationText = `Civic report: ${post?.title}. Located in ${post?.district} district, at address: ${post?.address || 'not specified'}. Classified as ${post?.category} with ${post?.severity} severity. Status is ${post?.status?.replace('_', ' ')}. Detail description: ${post?.description}.`;
    const utterance = new SpeechSynthesisUtterance(narrationText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Status edit state (for owners/admin/officers)
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [myPostIds, setMyPostIds] = useState(new Set());

  // Poll creation state
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollForm, setPollForm] = useState({
    question: '',
    option1: '',
    option2: '',
    option3: '',
  });

  const fetchPostDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/posts/${id}`);
      setData(res.data);
      setStatusForm({
        status: res.data.post.status,
        note: ''
      });

      // Fetch comments
      const commentRes = await api.get(`/posts/${id}/comments`);
      setComments(commentRes.data.comments);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load post details.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMyPosts = async () => {
    if (!isSignedIn) return;
    try {
      const res = await api.get('/auth/my-posts');
      const ids = new Set(res.data.posts.map(p => p._id));
      setMyPostIds(ids);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPostDetails();
    fetchMyPosts();
  }, [id, isSignedIn]);

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('post:subscribe', { postId: id });

    const handlePostUpdated = (updatedPost) => {
      if (updatedPost._id === id) {
        setData(prev => prev ? {
          ...prev,
          post: {
            ...prev.post,
            ...updatedPost
          }
        } : null);
        setStatusForm({
          status: updatedPost.status,
          note: ''
        });
        toast.success('Complaint details updated in real-time!', { id: 'status-realtime' });
      }
    };

    socket.on('post:updated', handlePostUpdated);

    return () => {
      socket.emit('post:unsubscribe', { postId: id });
      socket.off('post:updated', handlePostUpdated);
    };
  }, [socket, id]);

  const handleLike = async () => {
    try {
      const res = await api.post(`/posts/${id}/like`);
      setData(prev => prev ? {
        ...prev,
        post: {
          ...prev.post,
          likeCount: res.data.likeCount,
          intensityScore: res.data.intensityScore,
        }
      } : null);
      toast.success(res.data.liked ? 'Voted: Affected by this issue too' : 'Removed vote');
    } catch (err) {
      toast.error('Action failed.');
    }
  };

  const handleCommentSubmit = async (e, parentId = null) => {
    e.preventDefault();
    const text = parentId ? replyText[parentId] : commentText;
    if (!text?.trim()) return;

    try {
      const res = await api.post(`/posts/${id}/comments`, {
        text: text.trim(),
        parentId
      });

      toast.success('Comment posted anonymously.');

      if (parentId) {
        setReplyText(prev => ({ ...prev, [parentId]: '' }));
        setShowReplyForm(prev => ({ ...prev, [parentId]: false }));
      } else {
        setCommentText('');
      }

      // Reload comments and post metadata
      await fetchPostDetails(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit comment.');
    }
  };

  const handlePollCreate = async (e) => {
    e.preventDefault();
    const { question, option1, option2, option3 } = pollForm;
    if (!question.trim() || !option1.trim() || !option2.trim()) {
      toast.error('Question and at least 2 options are required.');
      return;
    }

    const options = [option1, option2];
    if (option3.trim()) options.push(option3);

    try {
      const res = await api.post(`/posts/${id}/polls`, { question, options });
      toast.success('Poll created successfully!');
      setShowPollForm(false);
      setPollForm({ question: '', option1: '', option2: '', option3: '' });
      fetchPostDetails();
    } catch (err) {
      toast.error('Failed to create poll.');
    }
  };

  const handlePollVote = async (pollId, optionIndex) => {
    try {
      const res = await api.post(`/polls/${pollId}/vote`, { optionIndex });
      toast.success('Vote submitted.');
      fetchPostDetails();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('You already voted in this poll.');
      } else {
        toast.error('Failed to submit vote.');
      }
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    try {
      setUpdatingStatus(true);
      await api.patch(`/posts/${id}/status`, statusForm);
      toast.success('Status updated successfully.');
      fetchPostDetails();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this report? This action cannot be undone.')) return;
    try {
      await api.delete(`/posts/${id}`);
      toast.success('Report deleted successfully.');
      navigate('/feed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete report.');
    }
  };

  if (loading || !data) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        <p className="text-gray-400 font-display">Loading complaint files...</p>
      </div>
    );
  }

  const { post, polls, strikeRoom } = data;
  const isOwner = myPostIds.has(post._id);
  const showStatusEditControls = isOwner || ['admin', 'department', 'officer'].includes(role);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/feed" className="inline-flex items-center space-x-2 text-gray-400 hover:text-teal-400 font-semibold text-sm transition-colors mb-2">
        <ArrowLeft size={16} />
        <span>Return to Feed</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            {/* Meta */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-gray-900">
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase bg-gray-900 border border-gray-800 text-gray-300 px-3 py-1 rounded-full font-bold">
                  {post.category}
                </span>
                <span className="text-xs uppercase bg-teal-500/10 border border-teal-500/20 text-teal-400 px-3 py-1 rounded-full font-extrabold">
                  {post.severity} severity
                </span>
              </div>

              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gray-950/80 border border-gray-900 text-xs font-extrabold uppercase text-gray-300">
                <span className={`w-2 h-2 rounded-full ${post.status === 'resolved' ? 'bg-emerald-400' : post.status === 'in_progress' ? 'bg-amber-400' : 'bg-teal-500'}`} />
                <span>{post.status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Images Gallery */}
            {post.images && post.images.length > 0 && (
              <div className="space-y-3">
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-gray-950 relative group">
                  <img 
                    src={post.images[activeImg] || post.images[0]} 
                    alt={post.title} 
                    className="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02]" 
                  />
                  {post.images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-gray-950/80 backdrop-blur-md text-[10px] text-gray-400 px-2.5 py-1 rounded-full font-bold uppercase border border-gray-800">
                      Image {activeImg + 1} of {post.images.length}
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {post.images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-800">
                    {post.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImg(idx)}
                        className={`relative w-20 aspect-video rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${activeImg === idx ? 'border-teal-500 scale-95 shadow-lg shadow-teal-500/10' : 'border-transparent hover:border-gray-800'}`}
                      >
                        <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Title & Desc */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-display">{post.title}</h1>
                <div className="inline-flex items-center space-x-1 px-3 py-1 rounded bg-rose-950/50 border border-rose-900/30 text-xs font-bold text-rose-300">
                  <Flame size={12} className="text-rose-400" />
                  <span>{post.intensityScore} 🔥</span>
                </div>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{renderMarkdownText(post.description)}</p>
            </div>

            {/* Location Address */}
            {post.address && (
              <div className="flex items-start space-x-2 p-3 bg-gray-900/40 rounded-xl border border-gray-900/60 text-xs text-gray-400">
                <MapPin className="text-teal-400 mt-0.5 flex-shrink-0" size={14} />
                <div>
                  <div className="font-bold text-gray-300">District: {post.district}</div>
                  <div className="mt-0.5">{post.address}</div>
                </div>
              </div>
            )}

            {/* Feed interaction buttons */}
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-900 text-sm w-full">
              <button
                onClick={handleLike}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-850 text-gray-300 hover:text-rose-400 transition-colors"
                aria-label="Toggle affected vote (like)"
              >
                <Heart size={16} />
                <span>Affected Too ({post.likeCount || 0})</span>
              </button>

              <button
                onClick={speakPost}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg transition-colors border ${
                  isSpeaking 
                    ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                    : 'bg-gray-900 hover:bg-gray-850 text-gray-300 border-transparent'
                }`}
                aria-label={isSpeaking ? "Stop narration" : "Read post aloud"}
              >
                {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
              </button>
              {(isOwner || role === 'admin') && (
                <button
                  onClick={handleDeletePost}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 text-rose-300 transition-colors cursor-pointer ml-auto"
                >
                  <Trash2 size={16} />
                  <span>Delete Report</span>
                </button>
              )}
            </div>
          </div>

          {/* Timeline / Status History */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold font-display flex items-center space-x-2">
              <Clock size={18} className="text-teal-400" />
              <span>Resolution Timeline & Audit Log</span>
            </h3>

            <div className="relative pl-6 space-y-6 border-l-2 border-gray-900">
              {post.statusHistory?.map((h, i) => (
                <div key={i} className="relative">
                  {/* Point */}
                  <span className={`absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full border-2 bg-gray-950 flex items-center justify-center ${h.status === 'resolved' ? 'border-emerald-500' : h.status === 'in_progress' ? 'border-amber-500' : 'border-teal-500'
                    }`}>
                    {h.status === 'resolved' ? <CheckCircle size={10} className="text-emerald-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                  </span>

                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider bg-gray-900 text-gray-300 border border-gray-800 px-2 py-0.5 rounded">
                      {h.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-2">
                      {new Date(h.updatedAt || post.createdAt).toLocaleString()}
                    </span>
                    {h.note && (
                      <p className="text-gray-400 text-xs mt-1.5 bg-gray-900/40 p-2.5 rounded-lg border border-gray-900/60 font-sans italic">
                        "{h.note}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          <div className="glass-panel p-6 rounded-2xl space-y-6" id="comments">
            <h3 className="text-lg font-bold font-display flex items-center space-x-2">
              <MessageSquare size={18} className="text-teal-400" />
              <span>Anonymous Discussion ({post.commentCount || 0})</span>
            </h3>

            {/* Comment Form */}
            <form onSubmit={(e) => handleCommentSubmit(e)} className="flex items-start space-x-3">
              <div className="flex-1">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share details or updates anonymously..."
                  rows={2}
                  className="w-full p-3 text-xs rounded-xl glass-input focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <button
                type="submit"
                className="p-3 bg-teal-500 text-gray-900 rounded-xl hover:bg-teal-400 transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-4 pt-2">
              {comments.map((c) => (
                <div key={c._id} className="p-4 rounded-xl bg-gray-900/30 border border-gray-900/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                    <span>User Token: {c.senderAlias || 'Anonymous'}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{c.text}</p>

                  {/* Reply trigger button */}
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <button
                      onClick={() => setShowReplyForm(prev => ({ ...prev, [c._id]: !prev[c._id] }))}
                      className="text-teal-400 font-bold hover:underline"
                    >
                      Reply
                    </button>
                  </div>

                  {/* Replies Rendering */}
                  {c.replies && c.replies.map(r => (
                    <div key={r._id} className="ml-6 mt-3 p-3 bg-gray-900/60 rounded-lg border-l-2 border-teal-500/50 space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-gray-500 font-semibold uppercase tracking-widest">
                        <span>User Token: {r.senderAlias || 'Anonymous'}</span>
                        <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-300 text-xs">{r.text}</p>
                    </div>
                  ))}

                  {/* Reply Form */}
                  {showReplyForm[c._id] && (
                    <form onSubmit={(e) => handleCommentSubmit(e, c._id)} className="ml-6 mt-3 flex items-start space-x-2">
                      <input
                        type="text"
                        value={replyText[c._id] || ''}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [c._id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                      />
                      <button type="submit" className="p-2 bg-teal-500 text-gray-900 rounded-lg hover:bg-teal-400">
                        <Send size={12} />
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Status Panel, Official Contacts & Polls */}
        <div className="space-y-6">

          {/* Strike Banner */}
          {strikeRoom && (
            <div className="glass-panel p-5 rounded-2xl border-rose-500/30 bg-rose-950/10 text-center space-y-3">
              <Flame className="w-8 h-8 text-rose-500 mx-auto animate-bounce" />
              <div>
                <h3 className="font-display font-bold text-rose-400">Escalated Protest Live</h3>
                <p className="text-[11px] text-gray-400 mt-1">
                  Active Member Count: {strikeRoom.memberCount} citizens support this strike.
                </p>
              </div>
              <Link to="/strikes" className="block w-full py-2 bg-rose-500 hover:bg-rose-400 text-gray-900 font-bold text-xs rounded-xl transition-colors uppercase tracking-wider">
                Enter Strike Room
              </Link>
            </div>
          )}

          {/* Status Editing Form (For Owner or Official) */}
          {showStatusEditControls && (
            <div className="glass-panel p-5 rounded-2xl border-teal-500/30 bg-teal-950/5 space-y-4">
              <div>
                <h3 className="font-display font-bold text-teal-400">Status Update</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                  {isOwner ? 'Citizen Ownership Portal' : 'Official Officer Portal'}
                </p>
              </div>

              <form onSubmit={handleStatusUpdate} className="space-y-3">
                <div>
                   <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Update Status</label>
                   <select
                     value={statusForm.status}
                     onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))}
                     className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                   >
                     <option value="reported">Reported</option>
                     <option value="in_progress">In Progress</option>
                     <option value="resolved">Resolved</option>
                     <option value="closed">Closed</option>
                   </select>
                 </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Timeline Note</label>
                  <textarea
                    value={statusForm.note}
                    onChange={(e) => setStatusForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Provide resolution details or work status..."
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="w-full py-2 bg-teal-500 hover:bg-teal-400 disabled:bg-gray-800 text-gray-900 font-bold text-xs rounded-lg transition-colors"
                >
                  {updatingStatus ? 'Saving Status...' : 'Apply Status Update'}
                </button>
              </form>
            </div>
          )}

          {/* Forensics and Image Originality Panel */}
          {post.images && post.images.length > 0 && (() => {
            const trustScore = post.legitimacyScore !== undefined ? post.legitimacyScore : 70;
            
            return (
              <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] animate-scaleIn">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <span>🛡️</span> AI Trust & Legitimacy Audit
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">Forensic Verification Report</p>
                </div>

                {/* Trust Score Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[var(--text-secondary)]">Legitimacy Trust Index</span>
                    <span className={trustScore >= 80 ? 'text-emerald-400' : trustScore >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                      {trustScore}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-950/80 rounded-full h-2 overflow-hidden border border-gray-900">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        trustScore >= 80 ? 'bg-emerald-500' : trustScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`} 
                      style={{ width: `${trustScore}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Originality Status Badge */}
                  <div className="p-3.5 bg-gray-950/40 rounded-xl border border-[var(--border-subtle)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Originality Status</span>
                      <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded border ${
                        post.originalityStatus === 'authentic' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {post.originalityStatus?.replace('_', ' ') || 'unknown'}
                      </span>
                    </div>
                    {post.originalityAnalysis && (
                      <p className="text-[var(--text-secondary)] font-sans italic text-[11px] leading-relaxed">
                        "{post.originalityAnalysis}"
                      </p>
                    )}
                  </div>

                  {/* Digital Footprint Exif table */}
                  {post.imageMetadata && (
                    <div className="p-3.5 bg-gray-950/40 rounded-xl border border-[var(--border-subtle)] space-y-2.5">
                      <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                        <span className="text-[var(--text-secondary)]">Camera Device:</span>
                        <span className="text-[var(--text-primary)] font-semibold text-right">{post.imageMetadata.camera || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                        <span className="text-[var(--text-secondary)]">Software / Editor:</span>
                        <span className="text-[var(--text-primary)] font-semibold text-right">{post.imageMetadata.software || 'None'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                        <span className="text-[var(--text-secondary)]">Date Captured:</span>
                        <span className="text-[var(--text-primary)] font-semibold text-right">
                          {post.imageMetadata.dateTimeOriginal 
                            ? new Date(post.imageMetadata.dateTimeOriginal).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
                            : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">GPS Validation:</span>
                        <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded border ${
                          post.imageMetadata.gpsMatchStatus === 'matched'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : post.imageMetadata.gpsMatchStatus === 'mismatch'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}>
                          {post.imageMetadata.gpsMatchStatus === 'matched' 
                            ? '✓ GPS Matched' 
                            : post.imageMetadata.gpsMatchStatus === 'mismatch' 
                            ? '✗ GPS Mismatch' 
                            : 'No GPS tag'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Official Contacts Info Card */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="font-display font-bold text-gray-200">Attached Officials</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Auto-Linked by District</p>
            </div>

            {post.attachedContacts && post.attachedContacts.length > 0 ? (
              <div className="space-y-4">
                {post.attachedContacts.map((c) => (
                  <div key={c._id} className="p-3.5 bg-gray-900/40 rounded-xl border border-gray-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {c.department}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-gray-300">{c.officerName}</div>

                    <div className="space-y-1.5 pt-1 text-[11px]">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center space-x-1.5 text-teal-400 hover:underline">
                          <Phone size={12} />
                          <span>{c.phone}</span>
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center space-x-1.5 text-teal-400 hover:underline truncate">
                          <Mail size={12} />
                          <span className="truncate">{c.email}</span>
                        </a>
                      )}
                      {c.portalUrl && (
                        <a href={c.portalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1.5 text-teal-400 hover:underline">
                          <Globe size={12} />
                          <span>Official Website</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No officials configured for district: {post.district}</p>
            )}
          </div>

          {/* Poll widget */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-gray-200">Community Polls</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Aggregate Intensity</p>
              </div>
              {!showPollForm && (
                <button
                  onClick={() => setShowPollForm(true)}
                  className="p-1 hover:bg-gray-800 text-teal-400 rounded-lg"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Poll Creation Form */}
            {showPollForm && (
              <form onSubmit={handlePollCreate} className="p-3 bg-gray-900/60 rounded-xl border border-gray-900 space-y-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Create New Poll</div>
                <input
                  type="text"
                  placeholder="Poll question?"
                  value={pollForm.question}
                  onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 1"
                  value={pollForm.option1}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option1: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 2"
                  value={pollForm.option2}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option2: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 3 (Optional)"
                  value={pollForm.option3}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option3: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                />

                <div className="flex items-center space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPollForm(false)}
                    className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs bg-teal-500 hover:bg-teal-400 text-gray-900 font-bold rounded-lg"
                  >
                    Launch
                  </button>
                </div>
              </form>
            )}

            {/* Poll List */}
            {polls && polls.length > 0 ? (
              <div className="space-y-4">
                {polls.map((poll) => (
                  <div key={poll._id} className="p-3 bg-gray-900/40 rounded-xl border border-gray-900/60 space-y-3">
                    <div className="text-xs font-bold text-gray-200">{poll.question}</div>

                    <div className="space-y-2">
                      {poll.options.map((opt, oIdx) => {
                        const pct = poll.totalVotes ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                        return (
                          <button
                            key={oIdx}
                            onClick={() => handlePollVote(poll._id, oIdx)}
                            className="w-full text-left relative overflow-hidden p-2 text-xs rounded-lg border border-gray-900 bg-gray-950/20 hover:border-teal-500/30 group transition-all"
                          >
                            {/* Bar display */}
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-teal-500/5 group-hover:bg-teal-500/10 transition-all"
                              style={{ width: `${pct}%` }}
                            />

                            <div className="relative z-10 flex items-center justify-between text-gray-300">
                              <span>{opt.text}</span>
                              <span className="text-[10px] text-gray-500 font-semibold">{pct}% ({opt.voteCount})</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[9px] text-gray-500 text-right uppercase font-semibold">
                      Total votes: {poll.totalVotes || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No community polls created for this post yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
