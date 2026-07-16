import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import {
  Heart, MessageSquare, Phone, Mail, Globe, MapPin,
  AlertTriangle, ArrowLeft, Send, Plus, Flame, Clock,
  CheckCircle, Loader2, Trash2, Volume2, VolumeX,
  Share2, Eye, Sparkles
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

function getAvatarColor(alias = 'Anonymous') {
  const colors = [
    'bg-teal-600/35 text-teal-200 border-teal-500/20',
    'bg-purple-600/35 text-purple-200 border-purple-500/20',
    'bg-rose-600/35 text-rose-200 border-rose-500/20',
    'bg-amber-600/35 text-amber-200 border-amber-500/20',
    'bg-emerald-600/35 text-emerald-200 border-emerald-500/20',
    'bg-blue-600/35 text-blue-200 border-blue-500/20',
    'bg-indigo-600/35 text-indigo-200 border-indigo-500/20',
    'bg-pink-600/35 text-pink-200 border-pink-500/20'
  ];
  let hash = 0;
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
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
  const [witnessNote, setWitnessNote] = useState('');
  const [witnessLoading, setWitnessLoading] = useState(false);

  // Accessibility speech state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Engagement & Social Proof States
  const [liveViewers, setLiveViewers] = useState(4);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  // Pull safely from state at the top to prevent TDZ reference errors
  const post = data?.post;
  const reporterHandle = post ? `anon_${post.district?.toLowerCase().slice(0, 3)}_${post._id?.slice(-4)}` : 'anonymous';
  const polls = data?.polls;
  const strikeRoom = data?.strikeRoom;
  const userWitness = data?.userWitness;

  // Status edit state (for owners/admin/officers)
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [myPostIds, setMyPostIds] = useState(new Set());

  // Poll creation state
  const [showPollForm, setShowPollForm] = useState(false);
  const [creatingStrikeRoom, setCreatingStrikeRoom] = useState(false);

  const isOwner = post ? myPostIds.has(post._id) : false;
  const showStatusEditControls = post ? (isOwner || ['admin', 'department', 'officer'].includes(role)) : false;

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

  // Periodic active viewers generator to feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers(prev => {
        const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
        const next = prev + change;
        return next < 2 ? 2 : next > 12 ? 10 : next;
      });
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleShare = (platform) => {
    const postUrl = window.location.href;
    const shareText = `Alert! Check out this civic issue on CivicTN: "${post?.title}" at ${post?.address || post?.district}. Let's coordinate and get it resolved!`;
    
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + postUrl)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(postUrl)}`, '_blank');
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success('Post link copied to clipboard!');
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2500);
    }
  };

  const handleCreateStrikeRoom = async () => {
    if (!isSignedIn) {
      toast.error('Please sign in to create a strike room.');
      return;
    }

    try {
      setCreatingStrikeRoom(true);
      const res = await api.post('/rooms', {
        name: `${post.title} Strike Room`,
        description: `Live strike coordination for ${post.title}`,
        type: 'strike',
        postId: post._id,
        district: post.district,
        category: post.category,
      });

      const room = res.data.room;
      toast.success(res.data.alreadyExists ? 'Opening existing strike room.' : 'Strike room created.');
      navigate(`/strikes?roomId=${room._id}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not create strike room.';
      toast.error(msg);
    } finally {
      setCreatingStrikeRoom(false);
    }
  };

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

  const handleWitnessConfirm = async () => {
    if (!isSignedIn) {
      toast.error('Sign in to confirm as a witness.');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Location access is not supported in this browser.');
      return;
    }

    try {
      setWitnessLoading(true);
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        });
      });

      const res = await api.post(`/posts/${id}/witness`, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        note: witnessNote.trim(),
        status: 'confirmed',
      });

      setData(prev => prev ? {
        ...prev,
        post: res.data.post || prev.post,
        userWitness: res.data.witness,
      } : prev);
      setWitnessNote('');
      toast.success(`Nearby witness confirmed (${res.data.witness.distanceMeters}m away).`);
    } catch (err) {
      let message = err.response?.data?.error || 'Could not confirm witness status.';
      if (err.code === 1) {
        message = 'Location permission is required to confirm nearby.';
      } else if (err.response?.status === 404 && String(message).includes('/witness')) {
        message = 'Witness API is not loaded yet. Restart the backend server and try again.';
      }
      toast.error(message);
    } finally {
      setWitnessLoading(false);
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
      fetchPostDetails(true);
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
        <Loader2 className="w-10 h-10 text-[var(--teal-500)] animate-spin" />
        <p className="text-[var(--text-muted)] font-display">Loading complaint files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/feed" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--teal-500)] font-semibold text-sm transition-colors mb-2">
        <ArrowLeft size={16} />
        <span>Return to Feed</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6 relative overflow-hidden">
            {/* Meta & Status Indicators */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[var(--border-subtle)]">
              {/* Reporter Profile Info */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center font-bold text-white text-xs uppercase shadow-sm">
                  {post.category?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">@{reporterHandle}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-extrabold flex items-center gap-1.5 mt-0.5">
                    <span>Citizen Reporter</span>
                    <span>·</span>
                    <span>{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase border ${
                post.status === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                post.status === 'in_progress' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${post.status === 'resolved' ? 'bg-emerald-400' : post.status === 'in_progress' ? 'bg-amber-400' : 'bg-teal-400'}`} />
                <span>{post.status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Live viewer count badge */}
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] select-none">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-teal-400 font-bold">{liveViewers} citizens</span> reviewing this right now
              </span>
            </div>

            {/* Images Gallery */}
            {post.images && post.images.length > 0 && (
              <div className="space-y-3">
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-gray-950 relative group">
                  <img 
                    src={post.images[activeImg] || post.images[0]} 
                    alt={post.title} 
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]" 
                  />
                  {post.images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-gray-950/80 backdrop-blur-md text-[10px] text-gray-300 px-3 py-1.5 rounded-full font-bold uppercase border border-gray-800 tracking-wider">
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
                        className={`relative w-20 aspect-video rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${activeImg === idx ? 'border-teal-500 scale-95 shadow-lg shadow-teal-500/10' : 'border-transparent hover:border-gray-800'}`}
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
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--text-primary)]">{post.title}</h1>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-xs font-bold text-orange-400 shrink-0">
                  <Flame size={12} className="text-orange-400" />
                  <span>{post.intensityScore} 🔥</span>
                </div>
              </div>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">{renderMarkdownText(post.description)}</p>
            </div>

            {/* Unified Metadata Dashboard Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)]">
              {/* Location Details */}
              <div className="flex gap-2.5 items-start">
                <MapPin className="text-[var(--teal-500)] mt-0.5 shrink-0" size={16} />
                <div>
                  <div className="text-[9px] uppercase text-[var(--text-muted)] tracking-wider font-extrabold">Location Address</div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">{post.district} District</div>
                  {post.address && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-normal">{post.address}</div>}
                </div>
              </div>

              {/* Severity & Category Details */}
              <div className="flex gap-2.5 items-start">
                <AlertTriangle className="text-[var(--teal-500)] mt-0.5 shrink-0" size={16} />
                <div>
                  <div className="text-[9px] uppercase text-[var(--text-muted)] tracking-wider font-extrabold">Civic Classification</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`severity-badge severity-${post.severity} text-[10px]`}>
                      {post.severity} severity
                    </span>
                    <span className="text-[10px] uppercase bg-[var(--bg-overlay)] border border-[var(--border-default)] text-[var(--text-secondary)] px-2 py-0.5 rounded font-bold">
                      {post.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feed interaction & Share Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[var(--border-subtle)] text-sm w-full">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 border border-[var(--border-default)] hover:border-red-500/20 transition-all cursor-pointer"
                aria-label="Toggle affected vote (like)"
              >
                <Heart size={16} className="text-red-500 fill-red-500/10 hover:fill-red-500" />
                <span className="font-bold">Affected Too ({post.likeCount || 0})</span>
              </button>

              <button
                onClick={speakPost}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all border cursor-pointer ${
                  isSpeaking
                    ? 'bg-[var(--teal-glow)] text-[var(--teal-500)] border-[rgba(13,148,136,0.3)] font-bold'
                    : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] border-[var(--border-default)]'
                }`}
                aria-label={isSpeaking ? "Stop narration" : "Read post aloud"}
              >
                {isSpeaking ? <VolumeX size={16} className="animate-bounce" /> : <Volume2 size={16} />}
                <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
              </button>

              {/* Share actions */}
              <div className="relative flex items-center gap-1.5">
                <button
                  onClick={() => handleShare('copy')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all cursor-pointer relative"
                >
                  <Share2 size={16} />
                  <span>Share</span>
                  {showShareTooltip && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-950 border border-gray-800 text-[10px] text-teal-400 font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap animate-bounce z-50">
                      Link copied!
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleShare('whatsapp')}
                  className="p-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-emerald-500/10 text-[var(--text-secondary)] hover:text-emerald-400 border border-[var(--border-default)] hover:border-emerald-500/20 transition-all cursor-pointer"
                  title="Share to WhatsApp"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.114-2.905-6.99C16.358 1.875 13.882 1.84 11.252 1.84c-5.438 0-9.862 4.42-9.866 9.865-.002 1.94.508 3.826 1.48 5.516L1.83 22.18l5.244-1.376z"/>
                  </svg>
                </button>
              </div>

              {(isOwner || role === 'admin') && (
                <button
                  onClick={handleDeletePost}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all cursor-pointer ml-auto"
                >
                  <Trash2 size={16} />
                  <span>Delete Report</span>
                </button>
              )}
            </div>

            {/* Resolution Timeline & Audit Log embedded inside Main Card */}
            <div className="pt-6 border-t border-[var(--border-subtle)] space-y-4">
              <h3 className="text-sm font-extrabold font-display flex items-center gap-2 text-[var(--text-primary)]">
                <Clock size={15} className="text-[var(--teal-500)]" />
                <span>Resolution Timeline & Audit Log</span>
              </h3>

              {post.statusHistory && post.statusHistory.length > 0 ? (
                <div className="relative pl-5 space-y-4 border-l border-[var(--border-default)]">
                  {post.statusHistory.map((h, i) => (
                    <div key={i} className="relative">
                      {/* Point */}
                      <span className={`absolute -left-[26px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-[var(--bg-surface)] flex items-center justify-center ${
                        h.status === 'resolved' ? 'border-emerald-500 bg-emerald-500' : h.status === 'in_progress' ? 'border-amber-500 bg-amber-500' : 'border-[var(--teal-500)] bg-[var(--teal-500)]'
                      }`} />

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.2 rounded border ${
                            h.status === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            h.status === 'in_progress' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)]'
                          }`}>
                            {h.status.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                            {new Date(h.updatedAt || post.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        {h.note && (
                          <p className="text-xs text-[var(--text-secondary)] italic pl-0.5">
                            "{h.note}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] italic">No updates recorded yet.</p>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="glass-panel p-6 rounded-2xl space-y-6" id="comments">
            <h3 className="text-base font-bold font-display flex items-center gap-2 text-[var(--text-primary)]">
              <MessageSquare size={18} className="text-[var(--teal-500)]" />
              <span>Anonymous Discussion ({post.commentCount || 0})</span>
            </h3>

            {/* Comment Form */}
            <form onSubmit={(e) => handleCommentSubmit(e)} className="flex items-start gap-3">
              <div className="flex-1">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share details or updates anonymously..."
                  rows={2}
                  className="w-full p-3 text-xs rounded-xl glass-input"
                />
              </div>
              <button
                type="submit"
                className="p-3 bg-[var(--teal-500)] text-white rounded-xl hover:bg-[var(--teal-400)] transition-colors flex-shrink-0 cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>

            {/* Empty Comments Placeholder */}
            {comments.length === 0 && (
              <div className="text-center py-8 space-y-2 select-none">
                <MessageSquare size={32} className="text-[var(--text-muted)] mx-auto opacity-20" />
                <p className="text-xs text-[var(--text-muted)] italic">No comments posted yet. Start the conversation!</p>
              </div>
            )}

            {/* Comments List with nested curved thread connectors */}
            <div className="space-y-4 pt-2">
              {comments.map((c) => {
                const commentLetter = c.senderAlias ? c.senderAlias.replace('Citizen #', '')[0] || c.senderAlias[0] : 'A';
                const avatarColorClass = getAvatarColor(c.senderAlias || 'Anonymous');

                return (
                  <div key={c._id} className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-3 relative">
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        {/* Custom visual avatar */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border ${avatarColorClass} shadow-inner`}>
                          {commentLetter}
                        </div>
                        <span className="font-bold text-[var(--text-primary)]">{c.senderAlias || 'Anonymous'}</span>
                        
                        {c.isPostAuthor && (
                          <span className="text-[8px] uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                            <Sparkles size={8} /> Author
                          </span>
                        )}
                        {['admin', 'officer', 'department'].includes(c.creatorRole) && !c.isPostAuthor && (
                          <span className="text-[8px] uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-extrabold">
                            {c.creatorRole}
                          </span>
                        )}
                      </div>
                      <span>{new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>

                    <p className="text-[var(--text-primary)] text-xs leading-relaxed pl-8">{c.text}</p>

                    {/* Reply trigger button */}
                    <div className="flex items-center justify-between pt-1 text-[10px] pl-8">
                      <button
                        onClick={() => setShowReplyForm(prev => ({ ...prev, [c._id]: !prev[c._id] }))}
                        className="text-[var(--teal-500)] font-bold hover:underline cursor-pointer"
                      >
                        Reply
                      </button>
                    </div>

                    {/* Replies Rendering */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="space-y-3 pl-8 pt-2 relative">
                        {c.replies.map(r => {
                          const replyLetter = r.senderAlias ? r.senderAlias.replace('Citizen #', '')[0] || r.senderAlias[0] : 'A';
                          const replyAvatarClass = getAvatarColor(r.senderAlias || 'Anonymous');

                          return (
                            <div key={r._id} className="relative p-3 bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-default)] space-y-2 ml-4">
                              {/* Thread connector line */}
                              <div className="absolute left-[-16px] top-[-10px] bottom-1/2 w-4 border-l-2 border-b-2 border-slate-700/40 rounded-bl-lg pointer-events-none"></div>

                              <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border ${replyAvatarClass}`}>
                                    {replyLetter}
                                  </div>
                                  <span className="font-bold text-[var(--text-secondary)]">{r.senderAlias || 'Anonymous'}</span>
                                  {r.isPostAuthor && (
                                    <span className="text-[7px] uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.2 rounded font-extrabold">
                                      Author
                                    </span>
                                  )}
                                  {['admin', 'officer', 'department'].includes(r.creatorRole) && !r.isPostAuthor && (
                                    <span className="text-[7px] uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-extrabold">
                                      {r.creatorRole}
                                    </span>
                                  )}
                                </div>
                                <span>{new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              </div>
                              <p className="text-[var(--text-secondary)] text-xs pl-7">{r.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reply Form */}
                    {showReplyForm[c._id] && (
                      <form onSubmit={(e) => handleCommentSubmit(e, c._id)} className="ml-8 mt-3 flex items-start gap-2 relative">
                        {/* Thread connector for reply form */}
                        <div className="absolute left-[-16px] top-[-25px] bottom-1/2 w-4 border-l-2 border-b-2 border-slate-700/40 rounded-bl-lg pointer-events-none"></div>
                        <input
                          type="text"
                          value={replyText[c._id] || ''}
                          onChange={(e) => setReplyText(prev => ({ ...prev, [c._id]: e.target.value }))}
                          placeholder="Write a reply..."
                          className="flex-1 p-2 text-xs rounded-lg glass-input"
                        />
                        <button type="submit" className="p-2 bg-[var(--teal-500)] text-white rounded-lg hover:bg-[var(--teal-400)] cursor-pointer">
                          <Send size={12} />
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Status Panel, Official Contacts & Polls */}
        <div className="space-y-6">

          {/* Strike Banner */}
          {strikeRoom ? (
            <div className="glass-panel p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-center space-y-3">
              <Flame className="w-6 h-6 text-rose-500 mx-auto animate-pulse" />
              <div>
                <h3 className="font-display text-xs font-bold text-rose-400">Escalated Protest Live</h3>
                <p className="text-[10px] text-gray-400 mt-1">
                  Active Member Count: {strikeRoom.memberCount} citizens support this strike.
                </p>
              </div>
              <Link to={`/strikes?roomId=${strikeRoom._id}`} className="block w-full py-2 bg-rose-500 hover:bg-rose-400 text-gray-900 font-bold text-[10px] rounded-lg transition-colors uppercase tracking-wider text-center cursor-pointer">
                Enter Strike Room
              </Link>
            </div>
          ) : (
            <div className="glass-panel p-4 rounded-xl border border-dashed border-rose-500/20 bg-rose-950/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-gray-500 shrink-0 opacity-55" />
                <div>
                  <h4 className="text-xs font-bold text-gray-400">No Active Strike</h4>
                  <p className="text-[9px] text-[var(--text-muted)] mt-0.5">Mobilize to demand action</p>
                </div>
              </div>
              <button
                onClick={handleCreateStrikeRoom}
                disabled={creatingStrikeRoom}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0"
              >
                {creatingStrikeRoom ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Flame size={10} />
                    <span>Start</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Status Editing Form (For Owner or Official) */}
          {showStatusEditControls && (
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div>
                <h3 className="font-display font-bold text-[var(--teal-500)]">Status Update</h3>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                  {isOwner ? 'Citizen Ownership Portal' : 'Official Officer Portal'}
                </p>
              </div>

              <form onSubmit={handleStatusUpdate} className="space-y-3">
                <div>
                   <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Update Status</label>
                   <select
                     value={statusForm.status}
                     onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))}
                     className="w-full glass-input text-xs"
                   >
                     <option value="reported">Reported</option>
                     <option value="in_progress">In Progress</option>
                     <option value="resolved">Resolved</option>
                     <option value="closed">Closed</option>
                   </select>
                 </div>

                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Timeline Note</label>
                  <textarea
                    value={statusForm.note}
                    onChange={(e) => setStatusForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Provide resolution details or work status..."
                    rows={2}
                    className="w-full glass-input text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="btn btn-primary w-full cursor-pointer"
                >
                  {updatingStatus ? 'Saving Status...' : 'Apply Status Update'}
                </button>
              </form>
            </div>
          )}

          {/* Trust & Witness Audit Card */}
          {post.images && post.images.length > 0 && (() => {
            const trustScore = post.legitimacyScore !== undefined ? post.legitimacyScore : 70;
            
            return (
              <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] animate-scaleIn">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <span>🛡️</span> Trust & Witness Audit
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">Legitimacy Verification</p>
                </div>

                {/* Trust Score Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[var(--text-secondary)]">AI Legitimacy Index</span>
                    <span className={trustScore >= 80 ? 'text-emerald-400' : trustScore >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                      {trustScore}% Trust
                    </span>
                  </div>
                  <div className="w-full bg-[var(--bg-overlay)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        trustScore >= 80 ? 'bg-emerald-500' : trustScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`} 
                      style={{ width: `${trustScore}%` }} 
                    />
                  </div>
                </div>

                {/* Witness Verification Section */}
                <div className="p-3 bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] flex items-center gap-1">
                      <CheckCircle size={11} className="text-[var(--teal-500)]" /> Local Witness
                    </span>
                    {userWitness && (
                      <span className="text-[8px] uppercase font-extrabold px-1.5 py-0.2 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Confirmed
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                    {post.localWitnessCount || 0} local citizens confirmed this report nearby (500m radius).
                  </p>

                  {userWitness ? (
                    <div className="text-[10px] text-[var(--text-secondary)] italic bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      ✓ You confirmed this from {Math.round(userWitness.distanceMeters || 0)}m away.
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={witnessNote}
                        onChange={(e) => setWitnessNote(e.target.value)}
                        maxLength={150}
                        placeholder="Optional witness note (heavy traffic...)"
                        className="w-full p-2 text-[10px] rounded-lg glass-input"
                      />
                      <button
                        type="button"
                        onClick={handleWitnessConfirm}
                        disabled={witnessLoading}
                        className="w-full py-1.5 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1"
                      >
                        {witnessLoading ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <MapPin size={10} />
                        )}
                        <span>{witnessLoading ? 'Verifying GPS...' : 'Verify Location (Requires GPS)'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Forensics analysis notes */}
                <div className="space-y-2 text-xs">
                  {post.originalityAnalysis && (
                    <div className="p-3 bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] space-y-1">
                      <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">AI Analysis</div>
                      <p className="text-[var(--text-secondary)] font-sans italic text-[11px] leading-relaxed">
                        "{post.originalityAnalysis}"
                      </p>
                    </div>
                  )}

                  {/* Compact details table */}
                  {post.imageMetadata && (
                    <div className="p-2.5 bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] text-[10px] space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Camera:</span>
                        <span className="text-[var(--text-primary)] font-semibold">{post.imageMetadata.camera || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Editor:</span>
                        <span className="text-[var(--text-primary)] font-semibold">{post.imageMetadata.software || 'None'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">GPS Tag:</span>
                        <span className={`text-[8px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                          post.imageMetadata.gpsMatchStatus === 'matched'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : post.imageMetadata.gpsMatchStatus === 'mismatch'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]'
                        }`}>
                          {post.imageMetadata.gpsMatchStatus === 'matched' ? 'Matched' : post.imageMetadata.gpsMatchStatus === 'mismatch' ? 'Mismatch' : 'None'}
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
              <h3 className="font-display font-bold text-[var(--text-primary)]">Attached Officials</h3>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Auto-Linked by District</p>
            </div>

            {post.attachedContacts && post.attachedContacts.length > 0 ? (
              <div className="space-y-4">
                {post.attachedContacts.map((c) => {
                  const phoneNum = c.phone?.[0] || '';
                  const waMessage = `Hello Officer ${c.officerName || ''}, I am alert you regarding this civic hazard on CivicTN: "${post?.title}" at ${post?.address || post?.district}. Please take action. Link: ${window.location.href}`;
                  const waUrl = phoneNum ? `https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMessage)}` : null;

                  return (
                    <div key={c._id} className="p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] space-y-2 relative overflow-hidden group">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {c.department}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <span>{c.officerName}</span>
                        {c.designation && <span className="text-[10px] text-[var(--text-muted)] font-normal">({c.designation})</span>}
                      </div>

                      <div className="space-y-1.5 pt-1 text-[11px]">
                        {c.phone && (
                          <div className="flex items-center justify-between gap-2">
                            <a href={`tel:${phoneNum}`} className="flex items-center space-x-1.5 text-[var(--teal-500)] hover:underline">
                              <Phone size={12} />
                              <span>{phoneNum}</span>
                            </a>
                            {waUrl && (
                              <a 
                                href={waUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded transition-all cursor-pointer font-bold uppercase tracking-wider"
                              >
                                WhatsApp DM
                              </a>
                            )}
                          </div>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center space-x-1.5 text-[var(--teal-500)] hover:underline truncate">
                            <Mail size={12} />
                            <span className="truncate">{c.email}</span>
                          </a>
                        )}
                        {c.portalUrl && (
                          <a href={c.portalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1.5 text-[var(--teal-500)] hover:underline">
                            <Globe size={12} />
                            <span>Official Website</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No officials configured for district: {post.district}</p>
            )}
          </div>

          {/* Poll widget */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-[var(--text-primary)]">Community Polls</h3>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Aggregate Intensity</p>
              </div>
              {!showPollForm && (
                <button
                  onClick={() => setShowPollForm(true)}
                  className="p-1 hover:bg-[var(--bg-overlay)] text-[var(--teal-500)] rounded-lg cursor-pointer animate-pulse"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Poll Creation Form */}
            {showPollForm && (
              <form onSubmit={handlePollCreate} className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] space-y-3">
                <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Create New Poll</div>
                <input
                  type="text"
                  placeholder="Poll question?"
                  value={pollForm.question}
                  onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-[var(--teal-500)]"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 1"
                  value={pollForm.option1}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option1: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-[var(--teal-500)]"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 2"
                  value={pollForm.option2}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option2: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-[var(--teal-500)]"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 3 (Optional)"
                  value={pollForm.option3}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option3: e.target.value }))}
                  className="w-full p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-[var(--teal-500)]"
                />

                <div className="flex items-center space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPollForm(false)}
                    className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold rounded-lg cursor-pointer"
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
                  <div key={poll._id} className="p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] space-y-3">
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between gap-2">
                      <span>{poll.question}</span>
                      {poll.userHasVoted && (
                        <span className="text-[9px] uppercase font-extrabold tracking-wider bg-[var(--teal-glow)] text-[var(--teal-500)] px-2 py-0.5 rounded border border-[var(--teal-500)]/20 animate-fadeIn">
                          Voted
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {poll.options.map((opt, oIdx) => {
                        const pct = poll.totalVotes ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                        const isVotedOption = poll.userHasVoted && poll.userVotedOptionIndex === oIdx;

                        return (
                          <button
                            key={oIdx}
                            onClick={() => !poll.userHasVoted && handlePollVote(poll._id, oIdx)}
                            disabled={poll.userHasVoted}
                            className={`w-full text-left relative overflow-hidden p-2.5 text-xs rounded-lg border transition-all ${
                              poll.userHasVoted 
                                ? isVotedOption
                                  ? 'border-[var(--teal-500)]/50 bg-[var(--teal-glow)] cursor-default'
                                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 cursor-default opacity-80'
                                : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--teal-500)]/40 cursor-pointer group'
                            }`}
                          >
                            {/* Bar display */}
                            <div
                              className={`absolute top-0 bottom-0 left-0 transition-all duration-700 ${
                                isVotedOption 
                                  ? 'bg-[var(--teal-500)]/15'
                                  : 'bg-[var(--teal-500)]/5'
                              }`}
                              style={{ width: `${pct}%` }}
                            />

                            <div className="relative z-10 flex items-center justify-between text-[var(--text-primary)]">
                              <span className="flex items-center gap-1.5">
                                {isVotedOption && <CheckCircle size={12} className="text-[var(--teal-500)]" />}
                                <span className={isVotedOption ? 'font-bold text-[var(--teal-500)]' : ''}>{opt.text}</span>
                              </span>
                              <span className="text-[10px] text-[var(--text-secondary)] font-semibold">{pct}% ({opt.voteCount})</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[9px] text-[var(--text-muted)] text-right uppercase font-semibold">
                      Total votes: {poll.totalVotes || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No community polls created for this post yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
