import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import {
  Heart, MessageSquare, Phone, Mail, Globe, MapPin,
  AlertTriangle, ArrowLeft, Send, Plus, Flame, Clock,
  CheckCircle, Loader2, Trash2, Volume2, VolumeX,
  Share2, Eye, Sparkles, Calendar, Users, Wrench,
  Scale, BookOpen, Gavel, FileText, Printer, Download, Copy, Check,
  ChevronRight, ChevronLeft, X, Briefcase, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

function highlightPlaceholders(text) {
  if (typeof text !== 'string') return text;
  const parts = [];
  const placeholderRegex = /(\[.+?\])/g;
  let lastIndex = 0;
  let match;

  while ((match = placeholderRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <span 
        key={`p-${match.index}`} 
        className="mx-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[11px] font-mono font-bold select-all inline-block hover:bg-amber-500/15 transition-colors"
      >
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function renderMarkdownText(text = '') {
  const lines = String(text).split(/\n+/).filter(Boolean);
  const boldPattern = /\*\*(.+?)\*\*/g;

  return lines.map((line, lineIndex) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldPattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...highlightPlaceholders(line.slice(lastIndex, match.index)));
      }
      parts.push(<strong key={`b-${lineIndex}-${match.index}`}>{highlightPlaceholders(match[1])}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(...highlightPlaceholders(line.slice(lastIndex)));
    }

    return (
      <span key={`line-${lineIndex}`} className="block mb-2 last:mb-0">
        {parts.map((part, partIndex) =>
          typeof part === 'string' ? <React.Fragment key={`t-${lineIndex}-${partIndex}`}>{part}</React.Fragment> : part
        )}
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
  const similarPosts = data?.similarPosts || [];

  // Status edit state (for owners/admin/officers)
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [myPostIds, setMyPostIds] = useState(new Set());

  // Poll creation state
  const [showPollForm, setShowPollForm] = useState(false);
  const [creatingStrikeRoom, setCreatingStrikeRoom] = useState(false);

  // Suggested legal acts state
  const [suggestedActs, setSuggestedActs] = useState([]);
  const [loadingActs, setLoadingActs] = useState(false);
  const [expandedAct, setExpandedAct] = useState(null);
  const [actDetails, setActDetails] = useState({});
  const [loadingActDetails, setLoadingActDetails] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState('en');

  // Legal Petition Generator Modal States
  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState('collector');
  const [docStep, setDocStep] = useState(1);
  const [repName, setRepName] = useState(userProfile?.fullName || '');
  const [petitionerFatherSpouseName, setPetitionerFatherSpouseName] = useState('');
  const [petitionerAge, setPetitionerAge] = useState('');
  const [petitionerResidingAddress, setPetitionerResidingAddress] = useState('');
  const [customAuth, setCustomAuth] = useState('');
  const [addressedAuth, setAddressedAuth] = useState('');
  const [customDemands, setCustomDemands] = useState('');
  const [selectedActs, setSelectedActs] = useState([]);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const handleGenerateDocument = async (e) => {
    e.preventDefault();
    if (!post) return;

    if (!isSignedIn) {
      toast.error('Please sign in to generate formal legal petitions.');
      return;
    }

    try {
      setGeneratingDoc(true);
      const authority = addressedAuth === 'Other' ? customAuth : (addressedAuth || post.attachedContacts?.[0]?.officerName || 'District Collector / Magistrate');
      
      const res = await api.post(`/posts/${post._id}/legal-document`, {
        representativeName: repName || userProfile?.fullName || 'Citizen Complainant',
        addressedAuthority: authority,
        customDemands,
        docType,
        petitionerFatherSpouseName,
        petitionerAge,
        petitionerResidingAddress,
        selectedActs: selectedActs.length > 0 ? selectedActs : suggestedActs
      });
      setGeneratedDoc(res.data.document);
    } catch (err) {
      console.error('Failed to generate document:', err);
      toast.error(err.response?.data?.error || 'Failed to generate legal petition draft.');
    } finally {
      setGeneratingDoc(false);
    }
  };

  const resetDocState = () => {
    setShowDocModal(false);
    setGeneratedDoc(null);
    setDocStep(1);
    setIsEditingDoc(false);
  };

  const handleCopyDoc = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc);
    setCopiedDoc(true);
    toast.success('Legal document draft copied to clipboard!');
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handlePrintDoc = () => {
    window.print();
  };

  // Campaign State
  const [campaign, setCampaign] = useState(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    meetingDate: '',
    meetingTime: '',
    meetingPoint: '',
    targetVolunteers: 5,
    materialsInput: 'Trash Bags, Brooms'
  });
  const [campaignSubmitting, setCampaignSubmitting] = useState(false);
  const [pledgingItem, setPledgingItem] = useState(null);
  const [pledgeQty, setPledgeQty] = useState(1);
  const [pledgingLoading, setPledgingLoading] = useState(false);
  const [volunteeringLoading, setVolunteeringLoading] = useState(false);

  const isOwner = post ? myPostIds.has(post._id) : false;
  const showStatusEditControls = post ? (isOwner || ['admin', 'department', 'officer'].includes(role)) : false;

  const toggleActExpand = async (act) => {
    const key = `${act.actName}-${act.section}`.toLowerCase();
    if (expandedAct === key) {
      setExpandedAct(null);
      return;
    }
    setExpandedAct(key);
    setActiveLangTab('en');

    if (actDetails[key]) return; // already cached

    setLoadingActDetails(true);
    try {
      let corpusName = 'bns';
      if (act.actName.toLowerCase().includes('constitution')) {
        corpusName = 'constitution';
      } else if (act.actName.toLowerCase().includes('penal')) {
        corpusName = 'ipc';
      }
      
      const num = act.section.replace(/\D/g, '');
      const endpoint = `/laws/${corpusName}/${corpusName === 'constitution' ? 'article' : 'section'}/${num}`;
      
      const res = await api.get(endpoint);
      setActDetails(prev => ({
        ...prev,
        [key]: res.data
      }));
    } catch (err) {
      console.error('Failed to load detail translations:', err);
      toast.error('Failed to load detail translations.');
    } finally {
      setLoadingActDetails(false);
    }
  };

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

  const handleCampaignCreate = async (e) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast.error('Please sign in to start a self-fix campaign.');
      return;
    }
    try {
      setCampaignSubmitting(true);
      const materialsArray = campaignForm.materialsInput
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);

      const res = await api.post(`/posts/${id}/campaign`, {
        meetingDate: campaignForm.meetingDate,
        meetingTime: campaignForm.meetingTime,
        meetingPoint: campaignForm.meetingPoint,
        targetVolunteers: campaignForm.targetVolunteers,
        requestedMaterials: materialsArray
      });

      setCampaign(res.data.campaign);
      setShowCampaignForm(false);
      toast.success('Community Self-Fix Campaign initiated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start campaign.');
    } finally {
      setCampaignSubmitting(false);
    }
  };

  const handleVolunteerClick = async () => {
    if (!isSignedIn) {
      toast.error('Please sign in to volunteer.');
      return;
    }
    try {
      setVolunteeringLoading(true);
      const res = await api.post(`/posts/${id}/campaign/volunteer`);
      setCampaign(res.data.campaign);
      const isVolunteered = res.data.campaign.volunteers.some(v => v.clerkId === userProfile?.clerkId);
      toast.success(isVolunteered ? 'You have signed up as a volunteer!' : 'Removed from volunteer list.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to volunteer.');
    } finally {
      setVolunteeringLoading(false);
    }
  };

  const handlePledgeClick = async (e) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast.error('Please sign in to pledge items.');
      return;
    }
    try {
      setPledgingLoading(true);
      const res = await api.post(`/posts/${id}/campaign/pledge`, {
        item: pledgingItem,
        quantity: pledgeQty
      });
      setCampaign(res.data.campaign);
      toast.success(`Successfully pledged ${pledgeQty} ${pledgingItem}!`);
      setPledgingItem(null);
      setPledgeQty(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit pledge.');
    } finally {
      setPledgingLoading(false);
    }
  };

  const handleCampaignCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      const res = await api.post(`/posts/${id}/campaign/cancel`);
      setCampaign(res.data.campaign);
      toast.success('Campaign has been cancelled.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel campaign.');
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

      // Fetch campaign
      try {
        const campaignRes = await api.get(`/posts/${id}/campaign`);
        setCampaign(campaignRes.data.campaign);
      } catch (cErr) {
        console.warn('Failed to load campaign:', cErr.message);
      }

      // Fetch suggested acts dynamically
      setLoadingActs(true);
      try {
        const actsRes = await api.get(`/posts/${id}/suggest-acts`);
        setSuggestedActs(actsRes.data.acts || []);
      } catch (aErr) {
        console.warn('Failed to fetch legal grounds:', aErr.message);
      } finally {
        setLoadingActs(false);
      }
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6 max-w-7xl mx-auto px-1"
    >
      {/* Return to Feed Nav */}
      <div className="flex items-center justify-between">
        <Link 
          to="/feed" 
          className="group inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--teal-500)] font-bold text-sm transition-all duration-200"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Return to Feed</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden shadow-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {/* Header Meta & Status Indicators */}
            <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-[var(--border-subtle)]">
              {/* Reporter Profile Info */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--teal-500)]/15 to-emerald-500/10 border border-[var(--teal-500)]/20 flex items-center justify-center font-extrabold text-[var(--teal-500)] text-sm shadow-sm select-none">
                  {post.category?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--teal-500)] transition-colors cursor-default">@{reporterHandle}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-extrabold flex items-center gap-1.5 mt-0.5 select-none">
                    <span className="bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded text-[9px] border border-[var(--border-subtle)]">Citizen Reporter</span>
                    <span>·</span>
                    <span>{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm select-none ${
                post.status === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5' :
                post.status === 'in_progress' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5 animate-pulse' :
                'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${post.status === 'resolved' ? 'bg-emerald-400 animate-ping' : post.status === 'in_progress' ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'}`} />
                <span>{post.status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Live viewer count banner */}
            <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-secondary)] select-none bg-[var(--teal-glow)]/45 border border-[var(--teal-500)]/15 px-3 py-2 rounded-xl w-fit">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>
                <strong className="text-[var(--teal-500)] font-extrabold">{liveViewers} active citizens</strong> reviewing this hazard report
              </span>
            </div>

            {/* Images Gallery */}
            {post.images && post.images.length > 0 && (
              <div className="space-y-3">
                <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-[var(--border-default)] bg-gray-950 relative group shadow-inner">
                  <img 
                    src={post.images[activeImg] || post.images[0]} 
                    alt={post.title} 
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.02]" 
                  />
                  {post.images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-gray-950/80 backdrop-blur-md text-[10px] text-gray-300 px-3.5 py-1.5 rounded-xl font-bold uppercase border border-gray-800 tracking-wider">
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
                        className={`relative w-20 aspect-video rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0 cursor-pointer ${
                          activeImg === idx 
                            ? 'border-[var(--teal-500)] scale-[0.98] shadow-md shadow-[var(--teal-500)]/20' 
                            : 'border-transparent opacity-70 hover:opacity-100 hover:scale-[1.02]'
                        }`}
                      >
                        <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Title & Desc */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--text-primary)] leading-tight tracking-tight">
                  {post.title}
                </h1>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs font-bold text-orange-400 shrink-0 select-none shadow-sm">
                  <Flame size={13} className="text-orange-400 animate-pulse" />
                  <span>{post.intensityScore} 🔥 Intensity</span>
                </div>
              </div>
              
              <div className="bg-[var(--bg-elevated)]/50 p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {renderMarkdownText(post.description)}
              </div>
            </div>

            {/* Unified Metadata Dashboard Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--bg-elevated)] p-4 sm:p-5 rounded-2xl border border-[var(--border-default)]">
              {/* Location Details */}
              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-xl bg-[var(--teal-glow)]/45 text-[var(--teal-500)] shrink-0 border border-[var(--teal-500)]/15">
                  <MapPin size={18} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase text-[var(--text-muted)] tracking-wider font-extrabold select-none">Location Details</div>
                  <div className="text-xs font-extrabold text-[var(--text-primary)]">{post.district} District</div>
                  {post.address && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{post.address}</div>}
                </div>
              </div>

              {/* Severity & Category Details */}
              <div className="flex gap-3 items-start sm:border-l sm:border-[var(--border-subtle)] sm:pl-4">
                <div className="p-2 rounded-xl bg-[var(--teal-glow)]/45 text-[var(--teal-500)] shrink-0 border border-[var(--teal-500)]/15">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="text-[9px] uppercase text-[var(--text-muted)] tracking-wider font-extrabold select-none">Civic Classification</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`severity-badge severity-${post.severity} text-[10px] shadow-sm select-none`}>
                      {post.severity} severity
                    </span>
                    <span className="text-[10px] uppercase bg-[var(--bg-overlay)] border border-[var(--border-default)] text-[var(--text-secondary)] px-2 py-0.5 rounded-md font-bold select-none">
                      {post.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feed interaction & Share Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-[var(--border-subtle)] text-xs w-full">
              <button
                onClick={handleLike}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500/5 to-rose-500/5 hover:from-red-500/10 hover:to-rose-500/10 text-[var(--text-secondary)] hover:text-rose-500 border border-[var(--border-default)] hover:border-rose-500/30 transition-all duration-300 shadow-sm cursor-pointer hover:shadow-rose-500/5"
                aria-label="Toggle affected vote (like)"
              >
                <Heart size={15} className="text-rose-500 fill-rose-500/10 hover:fill-rose-500 transition-colors" />
                <span className="font-bold font-display">Affected Too ({post.likeCount || 0})</span>
              </button>

              <button
                onClick={speakPost}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 border font-bold font-display cursor-pointer ${
                  isSpeaking
                    ? 'bg-[var(--teal-500)] text-white border-[var(--teal-500)] shadow-md shadow-teal-500/20'
                    : 'bg-gradient-to-r from-teal-500/5 to-emerald-500/5 hover:from-teal-500/10 hover:to-emerald-500/10 text-[var(--text-secondary)] hover:text-[var(--teal-500)] border-[var(--border-default)] hover:border-teal-500/30 shadow-sm'
                }`}
                aria-label={isSpeaking ? "Stop narration" : "Read post aloud"}
              >
                {isSpeaking ? <VolumeX size={15} className="animate-pulse" /> : <Volume2 size={15} className="text-[var(--teal-500)]" />}
                <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
              </button>

              {/* Share actions */}
              <div className="relative flex items-center gap-2">
                <button
                  onClick={() => handleShare('copy')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/5 to-indigo-500/5 hover:from-blue-500/10 hover:to-indigo-500/10 text-[var(--text-secondary)] hover:text-blue-500 border border-[var(--border-default)] hover:border-blue-500/30 transition-all duration-300 shadow-sm cursor-pointer relative font-bold font-display"
                >
                  <Share2 size={15} className="text-blue-500" />
                  <span>Share</span>
                  {showShareTooltip && (
                    <span className="absolute -top-11 left-1/2 -translate-x-1/2 bg-[var(--bg-surface)] border border-[var(--teal-500)]/30 text-[10px] text-[var(--teal-500)] font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap animate-bounce z-50">
                      Link copied!
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleShare('whatsapp')}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5 hover:from-emerald-500/10 hover:to-teal-500/10 text-[var(--text-secondary)] hover:text-emerald-500 border border-[var(--border-default)] hover:border-emerald-500/30 transition-all duration-300 shadow-sm cursor-pointer"
                  title="Share to WhatsApp"
                >
                  <svg className="w-4 h-4 text-emerald-500 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.114-2.905-6.99C16.358 1.875 13.882 1.84 11.252 1.84c-5.438 0-9.862 4.42-9.866 9.865-.002 1.94.508 3.826 1.48 5.516L1.83 22.18l5.244-1.376z"/>
                  </svg>
                </button>
              </div>

              {(isOwner || role === 'admin') && (
                <button
                  onClick={handleDeletePost}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-500 hover:text-red-600 transition-all duration-300 cursor-pointer ml-auto font-bold font-display"
                >
                  <Trash2 size={15} />
                  <span>Delete Report</span>
                </button>
              )}
            </div>

            {/* Resolution Timeline & Audit Log embedded inside Main Card */}
            <div className="pt-6 border-t border-[var(--border-subtle)] space-y-5">
              <h3 className="text-sm font-bold font-display flex items-center gap-2 text-[var(--text-primary)]">
                <Clock size={16} className="text-[var(--teal-500)]" />
                <span>Resolution Timeline & Audit Log</span>
              </h3>

              {post.statusHistory && post.statusHistory.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-[var(--teal-500)]/40 before:to-slate-500/10">
                  {post.statusHistory.map((h, i) => {
                    const isResolved = h.status === 'resolved';
                    const isInProgress = h.status === 'in_progress';
                    const isClosed = h.status === 'closed';

                    const dotColor = isResolved ? 'bg-emerald-500 ring-emerald-500/20' : isInProgress ? 'bg-amber-500 ring-amber-500/20' : isClosed ? 'bg-slate-500 ring-slate-500/20' : 'bg-[var(--teal-500)] ring-teal-500/20';
                    const badgeStyle = isResolved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5' : isInProgress ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5' : isClosed ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 'bg-teal-500/10 border-teal-500/20 text-[var(--teal-500)]';

                    return (
                      <div key={i} className="relative group select-text">
                        {/* Stepper Node dot */}
                        <div className={`absolute -left-[22px] top-1.5 w-3 h-3 rounded-full ${dotColor} ring-4 transition-all duration-300 group-hover:scale-125`} />

                        <div className="space-y-1.5 pl-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                              {h.status.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-semibold">
                              {new Date(h.updatedAt || post.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>
                          {h.note && (
                            <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-subtle)] max-w-xl">
                              <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">
                                "{h.note}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] italic bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-subtle)]">
                  <Clock size={14} className="opacity-60 text-[var(--teal-500)]" />
                  <span>No resolution logs or updates recorded yet for this complaint.</span>
                </div>
              )}
          </div>
        </div>

          {similarPosts && similarPosts.length > 0 && (
            <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div>
                <h3 className="font-display font-extrabold text-sm text-[var(--teal-500)] flex items-center gap-2">
                  <MapPin size={16} /> Related Reports Nearby
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Other reports matching the same or very similar issue coordinates and details.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similarPosts.map(simPost => (
                  <Link
                    key={simPost._id}
                    to={`/posts/${simPost._id}`}
                    className="p-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--teal-500)]/40 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-[var(--teal-400)]">
                          {simPost.category}
                        </span>
                        <span className={`status-pill status-${simPost.status}`} style={{ fontSize: 8 }}>
                          {simPost.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--teal-500)] transition-colors line-clamp-2">
                        {simPost.title}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                      <span className="truncate max-w-[70%]">📍 {simPost.address || 'Address not specified'}</span>
                      <span className="shrink-0 font-bold text-orange-400">⚡ {simPost.severity}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]" id="comments">
            <h3 className="text-base font-bold font-display flex items-center gap-2 text-[var(--text-primary)]">
              <MessageSquare size={18} className="text-[var(--teal-500)]" />
              <span>Anonymous Discussion</span>
              <span className="text-xs bg-[var(--bg-overlay)] border border-[var(--border-default)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full font-bold select-none">
                {post.commentCount || 0}
              </span>
            </h3>

            {/* Comment Form */}
            <form onSubmit={(e) => handleCommentSubmit(e)} className="flex items-start gap-3 bg-[var(--bg-elevated)] p-3 rounded-2xl border border-[var(--border-default)]">
              <div className="flex-1">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share details or updates anonymously..."
                  rows={2}
                  className="w-full p-3 text-xs bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
              </div>
              <button
                type="submit"
                className="p-3 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white rounded-xl shadow-md shadow-teal-500/10 hover:shadow-teal-500/20 hover:scale-[1.03] transition-all flex-shrink-0 cursor-pointer self-end"
                title="Post Comment"
              >
                <Send size={15} />
              </button>
            </form>

            {/* Empty Comments Placeholder */}
            {comments.length === 0 && (
              <div className="text-center py-10 space-y-3 select-none">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-overlay)] flex items-center justify-center mx-auto border border-[var(--border-subtle)]">
                  <MessageSquare size={20} className="text-[var(--text-muted)] opacity-60" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">No comments posted yet</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Start the conversation anonymously to share details.</p>
                </div>
              </div>
            )}

            {/* Comments List with nested curved thread connectors */}
            <div className="space-y-4 pt-2">
              {comments.map((c) => {
                const commentLetter = c.senderAlias ? c.senderAlias.replace('Citizen #', '')[0] || c.senderAlias[0] : 'A';
                const avatarColorClass = getAvatarColor(c.senderAlias || 'Anonymous');

                return (
                  <div key={c._id} className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-3 relative group transition-all hover:border-[var(--border-strong)]">
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Custom visual avatar */}
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] border ${avatarColorClass} shadow-sm select-none`}>
                          {commentLetter}
                        </div>
                        <span className="font-extrabold text-[var(--text-primary)]">{c.senderAlias || 'Anonymous'}</span>
                        
                        {c.isPostAuthor && (
                          <span className="text-[8px] uppercase tracking-wider bg-teal-500/10 text-teal-500 border border-teal-500/20 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                            <Sparkles size={8} /> Author
                          </span>
                        )}
                        {['admin', 'officer', 'department'].includes(c.creatorRole) && !c.isPostAuthor && (
                          <span className="text-[8px] uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-extrabold">
                            {c.creatorRole}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] select-none">
                        {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-[var(--text-primary)] text-xs leading-relaxed pl-8 whitespace-pre-wrap select-text">{c.text}</p>

                    {/* Reply trigger button */}
                    <div className="flex items-center justify-between pt-1 text-[10px] pl-8">
                      <button
                        onClick={() => setShowReplyForm(prev => ({ ...prev, [c._id]: !prev[c._id] }))}
                        className="text-[var(--teal-500)] font-extrabold hover:text-[var(--teal-600)] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <MessageSquare size={11} />
                        <span>Reply</span>
                      </button>
                    </div>

                    {/* Replies Rendering */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="space-y-3 pl-6 pt-2 relative">
                        {c.replies.map(r => {
                          const replyLetter = r.senderAlias ? r.senderAlias.replace('Citizen #', '')[0] || r.senderAlias[0] : 'A';
                          const replyAvatarClass = getAvatarColor(r.senderAlias || 'Anonymous');

                          return (
                            <div key={r._id} className="relative p-3.5 bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] space-y-2 ml-4">
                              {/* Thread connector line */}
                              <div className="absolute left-[-16px] top-[-10px] bottom-1/2 w-4 border-l-2 border-b-2 border-[var(--border-default)] rounded-bl-lg pointer-events-none"></div>

                              <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[9px] border ${replyAvatarClass}`}>
                                    {replyLetter}
                                  </div>
                                  <span className="font-extrabold text-[var(--text-secondary)]">{r.senderAlias || 'Anonymous'}</span>
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
                              <p className="text-[var(--text-secondary)] text-xs pl-7 whitespace-pre-wrap select-text">{r.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reply Form */}
                    {showReplyForm[c._id] && (
                      <form onSubmit={(e) => handleCommentSubmit(e, c._id)} className="ml-8 mt-3 flex items-start gap-2 relative bg-[var(--bg-overlay)] p-2 rounded-xl border border-[var(--border-subtle)]">
                        {/* Thread connector for reply form */}
                        <div className="absolute left-[-16px] top-[-25px] bottom-1/2 w-4 border-l-2 border-b-2 border-[var(--border-default)] rounded-bl-lg pointer-events-none"></div>
                        <input
                          type="text"
                          value={replyText[c._id] || ''}
                          onChange={(e) => setReplyText(prev => ({ ...prev, [c._id]: e.target.value }))}
                          placeholder="Write an anonymous reply..."
                          className="flex-1 p-2 text-xs bg-transparent border-0 focus:ring-0 focus:outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                        />
                        <button type="submit" className="p-2 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white rounded-lg shadow-sm cursor-pointer transition-colors shrink-0 self-end">
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
            <div className="glass-panel p-5 rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-500/10 to-orange-500/5 text-center space-y-4 shadow-lg shadow-rose-500/5 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto border border-rose-500/20">
                <Flame className="w-6 h-6 text-rose-500" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-sm font-extrabold text-rose-400 uppercase tracking-wider">Escalated Protest Live</h3>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <strong className="text-rose-400">{strikeRoom.memberCount} citizens</strong> are active in the live strike room coordinates.
                </p>
              </div>
              <Link 
                to={`/strikes?roomId=${strikeRoom._id}`} 
                className="block w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all duration-300 uppercase tracking-widest text-center shadow-md shadow-rose-600/15 hover:shadow-rose-600/35 hover:scale-[1.01] cursor-pointer"
              >
                Enter Strike Room
              </Link>
            </div>
          ) : (
            <div className="glass-panel p-4.5 rounded-2xl border border-dashed border-rose-500/20 bg-rose-950/5 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/5 text-rose-400 shrink-0 opacity-70">
                  <Flame size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">No Active Strike</h4>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">Mobilize to demand official action</p>
                </div>
              </div>
              <button
                onClick={handleCreateStrikeRoom}
                disabled={creatingStrikeRoom}
                className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-[10px] rounded-xl transition-all duration-200 uppercase tracking-wider disabled:opacity-50 flex items-center gap-1 shadow-sm cursor-pointer shrink-0"
              >
                {creatingStrikeRoom ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Plus size={11} />
                    <span>Protest</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Status Editing Form (For Owner or Official) */}
          {showStatusEditControls && (
            <div className="glass-panel p-5 sm:p-6 rounded-2xl space-y-4 shadow-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div>
                <h3 className="font-display font-extrabold text-sm text-[var(--teal-500)] flex items-center gap-2">
                  <span>⚙️</span> Portal Status Update
                </h3>
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-bold">
                  {isOwner ? 'Citizen Ownership Panel' : 'Official Officer Panel'}
                </p>
              </div>

              <form onSubmit={handleStatusUpdate} className="space-y-3.5 pt-1">
                <div>
                   <label className="block text-[9px] text-[var(--text-muted)] uppercase font-extrabold tracking-wider mb-1">Update Current Status</label>
                   <select
                     value={statusForm.status}
                     onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))}
                     className="w-full p-2.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/40 transition-colors"
                   >
                     <option value="reported">Reported</option>
                     <option value="in_progress">In Progress</option>
                     <option value="resolved">Resolved</option>
                     <option value="closed">Closed</option>
                   </select>
                 </div>

                <div>
                   <label className="block text-[9px] text-[var(--text-muted)] uppercase font-extrabold tracking-wider mb-1">Timeline Resolution Note</label>
                   <textarea
                     value={statusForm.note}
                     onChange={(e) => setStatusForm(prev => ({ ...prev, note: e.target.value }))}
                     placeholder="Provide details about updates, steps taken or resolution state..."
                     rows={3}
                     className="w-full p-3 text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/40 transition-colors placeholder-[var(--text-muted)] resize-none"
                   />
                 </div>

                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="w-full py-2 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold text-xs rounded-xl shadow-md shadow-teal-500/10 hover:shadow-teal-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {updatingStatus && <Loader2 size={13} className="animate-spin" />}
                  <span>{updatingStatus ? 'Saving Status...' : 'Apply Status Update'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Trust & Witness Audit Card */}
          {post.images && post.images.length > 0 && (() => {
            const trustScore = post.legitimacyScore !== undefined ? post.legitimacyScore : 70;
            const trustColor = trustScore >= 80 ? 'text-emerald-400 bg-emerald-500' : trustScore >= 50 ? 'text-amber-400 bg-amber-500' : 'text-rose-400 bg-rose-500';
            
            return (
              <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md select-none">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <span>🛡️</span> Trust & Witness Audit
                  </h3>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-extrabold mt-0.5">Legitimacy & GPS Verification</p>
                </div>

                {/* Trust Score Progress Bar */}
                <div className="space-y-2 bg-[var(--bg-elevated)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[var(--text-secondary)] text-[11px]">AI Legitimacy Index</span>
                    <span className={trustScore >= 80 ? 'text-emerald-500 font-extrabold' : trustScore >= 50 ? 'text-amber-500 font-extrabold' : 'text-rose-500 font-extrabold'}>
                      {trustScore}% Trust
                    </span>
                  </div>
                  <div className="w-full bg-[var(--bg-overlay)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        trustScore >= 80 ? 'bg-emerald-500' : trustScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`} 
                      style={{ width: `${trustScore}%` }} 
                    />
                  </div>
                </div>

                {/* Witness Verification Section */}
                <div className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[var(--text-secondary)] flex items-center gap-1.5">
                      <CheckCircle size={12} className="text-[var(--teal-500)]" /> Local Witness Logs
                    </span>
                    {userWitness && (
                      <span className="text-[8px] uppercase font-extrabold px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    <strong className="text-[var(--teal-500)] font-bold">{post.localWitnessCount || 0} local citizens</strong> verified this nearby (500m radius).
                  </p>

                  {userWitness ? (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10 italic">
                      ✓ GPS confirmed your position ({Math.round(userWitness.distanceMeters || 0)}m away).
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={witnessNote}
                        onChange={(e) => setWitnessNote(e.target.value)}
                        maxLength={150}
                        placeholder="Optional witness details (e.g., active issue now...)"
                        className="w-full p-2.5 text-xs rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/40 transition-colors placeholder-[var(--text-muted)]"
                      />
                      <button
                        type="button"
                        onClick={handleWitnessConfirm}
                        disabled={witnessLoading}
                        className="w-full py-2 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm hover:shadow-md hover:scale-[1.01]"
                      >
                        {witnessLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <MapPin size={12} />
                        )}
                        <span>{witnessLoading ? 'Verifying GPS...' : 'Confirm Witness (Requires GPS)'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Forensics analysis notes */}
                <div className="space-y-3">
                  {post.originalityAnalysis && (
                    <div className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] space-y-1.5">
                      <div className="text-[9px] uppercase font-extrabold text-[var(--text-muted)] tracking-wider">Image Metadata Forensics</div>
                      <p className="text-[var(--text-secondary)] font-sans italic text-[11px] leading-relaxed">
                        "{post.originalityAnalysis}"
                      </p>
                    </div>
                  )}

                  {/* Compact details table */}
                  {post.imageMetadata && (
                    <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] text-[10px] space-y-2 font-medium">
                      <div className="flex justify-between items-center pb-1 border-b border-[var(--border-subtle)]">
                        <span className="text-[var(--text-muted)] font-bold">CAMERA</span>
                        <span className="text-[var(--text-primary)] font-bold">{post.imageMetadata.camera || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-1 border-b border-[var(--border-subtle)]">
                        <span className="text-[var(--text-muted)] font-bold">SOFTWARE</span>
                        <span className="text-[var(--text-primary)] font-bold">{post.imageMetadata.software || 'None'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-muted)] font-bold">GPS METADATA</span>
                        <span className={`text-[8px] uppercase font-extrabold px-2 py-0.5 rounded border ${
                          post.imageMetadata.gpsMatchStatus === 'matched'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : post.imageMetadata.gpsMatchStatus === 'mismatch'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
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

          {/* Community Self-Fix Campaign Card */}
          {post && ['sanitation', 'roads', 'other', 'municipal'].includes(post.category) && (
            <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md">
              <div>
                <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <span>🛠️</span> Community Self-Fix Campaign
                </h3>
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-extrabold mt-0.5">Crowdsourced Meetup</p>
              </div>

              {!campaign && !showCampaignForm && (
                <div className="space-y-3 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)]">
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-medium">
                    This issue has been delayed by official authorities. You can organize an active community meetup to fix it together!
                  </p>
                  <button
                    onClick={() => setShowCampaignForm(true)}
                    className="w-full py-2 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.01]"
                  >
                    <Plus size={14} />
                    <span>Initiate Self-Fix Meetup</span>
                  </button>
                </div>
              )}

              {showCampaignForm && (
                <form onSubmit={handleCampaignCreate} className="space-y-3 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-default)]">
                  <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 border-b border-[var(--border-subtle)] pb-1.5 select-none">Schedule Clean-Up / Repair</div>
                  
                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] uppercase font-bold mb-1">Meeting Date</label>
                    <input
                      type="date"
                      value={campaignForm.meetingDate}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, meetingDate: e.target.value }))}
                      className="w-full p-2 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] uppercase font-bold mb-1">Meeting Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 09:00 AM"
                      value={campaignForm.meetingTime}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, meetingTime: e.target.value }))}
                      className="w-full p-2 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] uppercase font-bold mb-1">Meeting Point / Landmark</label>
                    <input
                      type="text"
                      placeholder="e.g. Near Water Tank"
                      value={campaignForm.meetingPoint}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, meetingPoint: e.target.value }))}
                      className="w-full p-2 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] uppercase font-bold mb-1">Target Volunteers Needed</label>
                    <input
                      type="number"
                      min={2}
                      value={campaignForm.targetVolunteers}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, targetVolunteers: parseInt(e.target.value) || 5 }))}
                      className="w-full p-2 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] uppercase font-bold mb-1">Requested Supplies (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Trash Bags, Brooms, Paint"
                      value={campaignForm.materialsInput}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, materialsInput: e.target.value }))}
                      className="w-full p-2 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCampaignForm(false)}
                      className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={campaignSubmitting}
                      className="px-4 py-1.5 text-xs bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                    >
                      {campaignSubmitting && <Loader2 size={12} className="animate-spin" />}
                      <span>Launch Campaign</span>
                    </button>
                  </div>
                </form>
              )}

              {campaign && !showCampaignForm && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex flex-col gap-2.5 ${
                    campaign.status === 'cancelled'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-1.5 select-none">
                      <span className="text-xs font-extrabold uppercase tracking-widest">
                        {campaign.status === 'cancelled' ? '🚫 Campaign Cancelled' : '📅 Meetup Scheduled'}
                      </span>
                      <span className="text-[9px] font-extrabold opacity-75 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                        {campaign.createdBy === userProfile?.clerkId ? 'YOURS' : 'COMMUNITY'}
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1.5 font-medium">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] select-text">
                        <Calendar size={13} className="text-[var(--teal-500)] shrink-0" />
                        <span>Date: {new Date(campaign.meetingDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text-primary)] select-text">
                        <Clock size={13} className="text-[var(--teal-500)] shrink-0" />
                        <span>Time: {campaign.meetingTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text-primary)] select-text">
                        <MapPin size={13} className="text-[var(--teal-500)] shrink-0" />
                        <span className="truncate">Meetup: {campaign.meetingPoint}</span>
                      </div>
                    </div>
                  </div>

                  {campaign.status === 'cancelled' && (
                    <button
                      onClick={() => setShowCampaignForm(true)}
                      className="w-full py-2 bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01]"
                    >
                      <Plus size={14} />
                      <span>Initiate New Meetup Campaign</span>
                    </button>
                  )}

                  {campaign.status !== 'cancelled' && (
                    <>
                      {/* Volunteer List Progress */}
                      <div className="space-y-2 bg-[var(--bg-elevated)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
                        <div className="flex items-center justify-between text-[11px] font-bold select-none">
                          <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                            <Users size={13} className="text-[var(--teal-500)]" /> Volunteers Joined
                          </span>
                          <span className="text-[var(--teal-500)]">
                            {campaign.volunteers.length} / {campaign.targetVolunteers}
                          </span>
                        </div>
                        <div className="w-full bg-[var(--bg-overlay)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)] select-none">
                          <div 
                            className="h-full rounded-full bg-[var(--teal-500)] transition-all duration-500" 
                            style={{ width: `${Math.min(100, (campaign.volunteers.length / campaign.targetVolunteers) * 100)}%` }} 
                          />
                        </div>

                        {/* Join / Leave Button */}
                        <button
                          onClick={handleVolunteerClick}
                          disabled={volunteeringLoading}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                            campaign.volunteers.some(v => v.clerkId === userProfile?.clerkId)
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          {volunteeringLoading && <Loader2 size={12} className="animate-spin" />}
                          <span>
                            {campaign.volunteers.some(v => v.clerkId === userProfile?.clerkId)
                              ? '✓ Leave Clean-Up Group'
                              : '🙋 Join Clean-Up Group'}
                          </span>
                        </button>

                        {/* Volunteer Name List */}
                        {campaign.volunteers && campaign.volunteers.length > 0 && (
                          <div className="text-[10px] text-[var(--text-secondary)] pl-1 pt-1.5 leading-normal select-text">
                            <span className="font-bold text-[var(--text-muted)] select-none">Volunteers: </span>
                            {campaign.volunteers.map(v => v.displayName).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Requested Supplies Checklist */}
                      {campaign.materials && campaign.materials.length > 0 && (
                        <div className="space-y-3 pt-1">
                          <div className="text-[10px] uppercase font-extrabold text-[var(--text-muted)] tracking-wider flex items-center gap-1.5 select-none">
                            <Wrench size={12} className="text-[var(--teal-500)]" /> Required Supplies Checklist
                          </div>
                          
                          <div className="space-y-2.5">
                            {campaign.materials.map((mat, mIdx) => {
                              const pledgedTotal = mat.pledges.reduce((sum, p) => sum + p.quantity, 0);
                              const isPledgedByUser = mat.pledges.some(p => p.clerkId === userProfile?.clerkId);
                              const userPledgeQty = mat.pledges.find(p => p.clerkId === userProfile?.clerkId)?.quantity || 0;

                              return (
                                <div key={mIdx} className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] space-y-2 hover:border-[var(--border-strong)] transition-all">
                                  <div className="flex items-center justify-between text-xs font-bold select-text">
                                    <span className="text-[var(--text-primary)] font-bold">{mat.item}</span>
                                    <span className="text-[var(--text-secondary)]">{pledgedTotal} / {mat.targetCount}</span>
                                  </div>

                                  <div className="w-full bg-[var(--bg-overlay)] rounded-full h-1.5 overflow-hidden select-none border border-[var(--border-subtle)]">
                                    <div 
                                      className="h-full bg-emerald-500 transition-all duration-500" 
                                      style={{ width: `${Math.min(100, (pledgedTotal / mat.targetCount) * 100)}%` }} 
                                    />
                                  </div>

                                  {/* Pledge Input / Stats */}
                                  <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                                    <span className="text-[var(--text-muted)] italic font-medium select-text">
                                      {isPledgedByUser ? `Your Pledge: ${userPledgeQty} units` : 'No personal pledge'}
                                    </span>
                                    
                                    {pledgingItem === mat.item ? (
                                      <form onSubmit={handlePledgeClick} className="flex items-center gap-1.5 animate-fadeIn">
                                        <input
                                          type="number"
                                          min={0}
                                          value={pledgeQty}
                                          onChange={(e) => setPledgeQty(parseInt(e.target.value) || 0)}
                                          className="w-12 p-1 text-[10px] rounded bg-[var(--bg-surface)] border border-[var(--border-default)] text-center font-bold text-[var(--text-primary)]"
                                        />
                                        <button
                                          type="submit"
                                          disabled={pledgingLoading}
                                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold uppercase tracking-wider text-[8px] cursor-pointer"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPledgingItem(null)}
                                          className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[8px] cursor-pointer"
                                        >
                                          Exit
                                        </button>
                                      </form>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPledgingItem(mat.item);
                                          setPledgeQty(isPledgedByUser ? userPledgeQty : 1);
                                        }}
                                        className="text-[var(--teal-500)] font-extrabold hover:text-[var(--teal-600)] transition-colors cursor-pointer select-none"
                                      >
                                        {isPledgedByUser ? 'Edit Pledge' : 'Pledge Items'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Cancel Campaign Button (Creator Only) */}
                      {(campaign.createdBy === userProfile?.clerkId || role === 'admin') && (
                        <button
                          onClick={handleCampaignCancel}
                          className="w-full py-2 text-[10px] border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 font-bold rounded-xl transition-all cursor-pointer text-center font-display uppercase tracking-widest mt-2"
                        >
                          Cancel Meetup Campaign
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Relevant Legal Grounds Card */}
          <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Scale size={16} className="text-[var(--teal-500)] animate-pulse" />
                  Statutory & Legal Grounds
                </h3>
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-bold">Citable Legal Protections</p>
              </div>
              <button
                onClick={() => {
                  setSelectedActs(suggestedActs);
                  setRepName(userProfile?.fullName || '');
                  setShowDocModal(true);
                  setGeneratedDoc(null);
                  setDocStep(1);
                }}
                className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Gavel size={11} />
                <span>Draft Petition</span>
              </button>
            </div>

            {loadingActs ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <Loader2 size={16} className="animate-spin text-[var(--teal-500)]" />
                <span className="text-[9px] text-[var(--text-muted)]">Resolving legal grounds...</span>
              </div>
            ) : suggestedActs && suggestedActs.length > 0 ? (
              <div className="space-y-3">
                {suggestedActs.map((act, idx) => {
                  const key = `${act.actName}-${act.section}`.toLowerCase();
                  const isExpanded = expandedAct === key;
                  
                  let badgeText = 'BNS';
                  let badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                  if (act.actName.toLowerCase().includes('constitution')) {
                    badgeText = 'Const';
                    badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                  } else if (act.actName.toLowerCase().includes('penal')) {
                    badgeText = 'IPC';
                    badgeStyle = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                  }

                  return (
                    <div 
                      key={idx} 
                      className="py-3 px-1 border-b border-slate-100 dark:border-zinc-800 last:border-0 transition-all space-y-2 cursor-pointer group"
                      onClick={() => toggleActExpand(act)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 border rounded uppercase ${badgeStyle} shrink-0`}>
                            {badgeText}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                            {act.section}
                          </span>
                        </div>
                        <span className="text-[8px] text-[var(--text-muted)] group-hover:text-[var(--teal-500)] font-semibold transition-colors shrink-0">
                          {isExpanded ? 'Hide' : 'Expand'}
                        </span>
                      </div>
                      
                      <p className="text-[10.5px] font-medium text-[var(--text-secondary)] leading-relaxed">
                        {act.summary}
                      </p>

                      {isExpanded && (
                        <div 
                          className="pt-3 mt-3 border-t border-[var(--border-subtle)] space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {loadingActDetails && !actDetails[key] ? (
                            <div className="flex flex-col items-center py-4 gap-1.5">
                              <Loader2 size={12} className="animate-spin text-[var(--teal-500)]" />
                              <span className="text-[8px] text-[var(--text-muted)]">Fetching official translations...</span>
                            </div>
                          ) : actDetails[key] ? (
                            <div className="space-y-2.5 animate-fade-in select-text">
                              <div className="flex border-b border-[var(--border-subtle)] pb-1 gap-1">
                                {[
                                  { id: 'en', label: 'English' },
                                  { id: 'ml', label: 'മലയാളം' },
                                  { id: 'hi', label: 'हिन्दी' }
                                ].map(lang => (
                                  <button
                                    key={lang.id}
                                    type="button"
                                    onClick={() => setActiveLangTab(lang.id)}
                                    className={`px-2 py-0.5 text-[8.5px] font-extrabold rounded-md cursor-pointer transition-colors ${
                                      activeLangTab === lang.id
                                        ? 'bg-[var(--teal-glow)] text-[var(--teal-500)] border border-[var(--teal-500)]/20'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                  >
                                    {lang.label}
                                  </button>
                                ))}
                              </div>

                              <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] font-normal whitespace-pre-line max-h-36 overflow-y-auto pr-1 bg-[var(--bg-surface)] p-2 rounded-xl border border-[var(--border-subtle)]">
                                {actDetails[key].languages?.[activeLangTab] || 'Translation unavailable.'}
                              </p>

                              {actDetails[key].note && (
                                <div className="text-[8px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 leading-normal">
                                  ⚠️ {actDetails[key].note}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[8.5px] text-[var(--text-muted)] italic text-center py-2">
                              Could not load details.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] italic select-none text-center">
                No statutory grounds resolved for this category.
              </div>
            )}
          </div>

          {/* Official Contacts Info Card */}
          <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md">
            <div>
              <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)]">Attached Officials</h3>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-bold">Auto-Linked by District</p>
            </div>

            {post.attachedContacts && post.attachedContacts.length > 0 ? (
              <div className="space-y-3.5">
                {post.attachedContacts.map((c) => {
                  const phoneNum = c.phone?.[0] || '';
                  const waMessage = `Hello Officer ${c.officerName || ''}, I am alert you regarding this civic hazard on CivicTN: "${post?.title}" at ${post?.address || post?.district}. Please take action. Link: ${window.location.href}`;
                  const waUrl = phoneNum ? `https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMessage)}` : null;

                  return (
                    <div key={c._id} className="py-3 px-1 border-b border-slate-100 dark:border-zinc-800 last:border-0 space-y-2 relative overflow-hidden transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded select-none">
                          {c.department}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 select-text">
                        <span>{c.officerName}</span>
                        {c.designation && <span className="text-[10px] text-[var(--text-muted)] font-normal">({c.designation})</span>}
                      </div>

                      <div className="space-y-2 pt-1 text-[11px] font-medium select-text">
                        {c.phone && (
                          <div className="flex items-center justify-between gap-3">
                            <a href={`tel:${phoneNum}`} className="flex items-center space-x-1.5 text-[var(--teal-500)] hover:text-[var(--teal-600)] transition-colors">
                              <Phone size={12} className="shrink-0" />
                              <span>{phoneNum}</span>
                            </a>
                            {waUrl && (
                              <a 
                                href={waUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-lg transition-all cursor-pointer font-bold uppercase tracking-wider select-none shrink-0"
                              >
                                WhatsApp DM
                              </a>
                            )}
                          </div>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center space-x-1.5 text-[var(--teal-500)] hover:text-[var(--teal-600)] transition-colors truncate">
                            <Mail size={12} className="shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        )}
                        {c.portalUrl && (
                          <a href={c.portalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1.5 text-[var(--teal-500)] hover:text-[var(--teal-600)] transition-colors">
                            <Globe size={12} className="shrink-0" />
                            <span>Official Website</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] italic select-none text-center">
                No officials configured for district: {post.district}
              </div>
            )}
          </div>

          {/* Poll widget */}
          <div className="glass-panel p-5 rounded-2xl space-y-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-sm text-[var(--text-primary)]">Community Polls</h3>
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-bold select-none">Aggregate Intensity</p>
              </div>
              {!showPollForm && (
                <button
                  onClick={() => setShowPollForm(true)}
                  className="p-1 hover:bg-[var(--bg-elevated)] text-[var(--teal-500)] rounded-lg cursor-pointer animate-pulse select-none transition-colors border border-transparent hover:border-[var(--border-subtle)]"
                  title="Create Poll"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Poll Creation Form */}
            {showPollForm && (
              <form onSubmit={handlePollCreate} className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] space-y-3">
                <div className="text-[10px] text-[var(--text-muted)] font-extrabold uppercase tracking-wider mb-1 select-none">Create New Poll</div>
                <input
                  type="text"
                  placeholder="Poll question?"
                  value={pollForm.question}
                  onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 1"
                  value={pollForm.option1}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option1: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 2"
                  value={pollForm.option2}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option2: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                  required
                />
                <input
                  type="text"
                  placeholder="Option 3 (Optional)"
                  value={pollForm.option3}
                  onChange={(e) => setPollForm(prev => ({ ...prev, option3: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]/30 transition-colors"
                />

                <div className="flex items-center space-x-2 justify-end pt-1 select-none">
                  <button
                    type="button"
                    onClick={() => setShowPollForm(false)}
                    className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-white font-bold rounded-lg cursor-pointer transition-all shadow-sm"
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
                  <div key={poll._id} className="p-4 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-default)] space-y-3.5 hover:border-[var(--border-strong)] transition-all">
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between gap-2 select-text">
                      <span>{poll.question}</span>
                      {poll.userHasVoted && (
                        <span className="text-[8px] uppercase font-extrabold tracking-wider bg-[var(--teal-glow)] text-[var(--teal-500)] px-2 py-0.5 rounded-md border border-[var(--teal-500)]/20 animate-fadeIn select-none shrink-0">
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
                            className={`w-full text-left relative overflow-hidden p-3 text-xs rounded-xl border transition-all duration-300 ${
                              poll.userHasVoted 
                                ? isVotedOption
                                  ? 'border-[var(--teal-500)] bg-[var(--teal-glow)]/45 cursor-default shadow-sm shadow-[var(--teal-500)]/5'
                                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 cursor-default opacity-70'
                                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--teal-500)]/45 cursor-pointer group hover:shadow-sm'
                            }`}
                          >
                            {/* Bar display */}
                            <div
                              className={`absolute top-0 bottom-0 left-0 transition-all duration-1000 ${
                                isVotedOption 
                                  ? 'bg-[var(--teal-500)]/15'
                                  : 'bg-[var(--text-muted)]/5'
                              }`}
                              style={{ width: `${pct}%` }}
                            />

                            <div className="relative z-10 flex items-center justify-between text-[var(--text-primary)]">
                              <span className="flex items-center gap-2">
                                {isVotedOption && <CheckCircle size={13} className="text-[var(--teal-500)] shrink-0" />}
                                <span className={isVotedOption ? 'font-extrabold text-[var(--teal-500)]' : 'font-semibold'}>{opt.text}</span>
                              </span>
                              <span className="text-[10px] text-[var(--text-secondary)] font-extrabold">{pct}% ({opt.voteCount})</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[9px] text-[var(--text-muted)] text-right uppercase font-bold select-none border-t border-[var(--border-subtle)] pt-1.5">
                      Total votes: {poll.totalVotes || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] italic select-none text-center">
                No active community polls for this post yet.
              </div>
            )}
          </div>

        </div>
      </div>
      {/* ── LEGAL PETITION GENERATOR MODAL ── */}
      {showDocModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="glass-panel p-6 rounded-2xl max-w-3xl w-full space-y-4 animate-scaleIn my-8 max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl border border-emerald-500/20 bg-[var(--bg-surface)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Gavel size={18} className="text-emerald-400" />
                <h3 className="font-display font-extrabold text-sm sm:text-base text-[var(--teal-500)]">
                  Prepare Official Legal Grievance Petition Wizard
                </h3>
              </div>
              <button onClick={resetDocState} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Wizard Steps Header */}
            {!generatedDoc && (
              <div className="flex items-center justify-center space-x-4 border-b border-gray-800 pb-3 flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wider select-none">
                <div className={`flex items-center space-x-1.5 ${docStep === 1 ? 'text-emerald-400 animate-pulse' : 'text-[var(--text-muted)]'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] ${docStep === 1 ? 'border-emerald-400 bg-emerald-500/10' : 'border-[var(--border-default)]'}`}>1</span>
                  <span>Type & Acts</span>
                </div>
                <div className="w-8 h-[1px] bg-gray-800" />
                <div className={`flex items-center space-x-1.5 ${docStep === 2 ? 'text-emerald-400 animate-pulse' : 'text-[var(--text-muted)]'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] ${docStep === 2 ? 'border-emerald-400 bg-emerald-500/10' : 'border-[var(--border-default)]'}`}>2</span>
                  <span>Credentials</span>
                </div>
                <div className="w-8 h-[1px] bg-gray-800" />
                <div className={`flex items-center space-x-1.5 ${docStep === 3 ? 'text-emerald-400 animate-pulse' : 'text-[var(--text-muted)]'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] ${docStep === 3 ? 'border-emerald-400 bg-emerald-500/10' : 'border-[var(--border-default)]'}`}>3</span>
                  <span>Authority</span>
                </div>
              </div>
            )}

            {/* Modal Content */}
            {!generatedDoc ? (
              <div className="flex-1 overflow-y-auto pr-1">
                {/* STEP 1: GRIEVANCE TYPE & ACTS */}
                {docStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Select Target Filing Body / Document Format
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {/* District Collector */}
                        <div 
                          onClick={() => setDocType('collector')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-1.5 ${docType === 'collector' ? 'bg-emerald-500/10 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-overlay)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                        >
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Gavel size={13} className="text-amber-400" />
                            Collectorate Grievance
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                            District Collector & Magistrate Mass Representation for Grievance Day.
                          </span>
                        </div>

                        {/* Municipal */}
                        <div 
                          onClick={() => setDocType('municipal')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-1.5 ${docType === 'municipal' ? 'bg-emerald-500/10 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-overlay)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                        >
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                            <FileText size={13} className="text-emerald-400" />
                            Municipal Complaint
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                            Formal administrative complaint representation to corporate/municipal heads.
                          </span>
                        </div>

                        {/* High Court PIL */}
                        <div 
                          onClick={() => setDocType('court')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-1.5 ${docType === 'court' ? 'bg-emerald-500/10 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-overlay)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                        >
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Scale size={13} className="text-teal-400" />
                            Writ PIL Petition
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                            Public Interest Writ Petition under Art 226 before Madras High Court.
                          </span>
                        </div>

                        {/* RTI */}
                        <div 
                          onClick={() => setDocType('rti')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-1.5 ${docType === 'rti' ? 'bg-emerald-500/10 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-overlay)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                        >
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Eye size={13} className="text-cyan-400" />
                            RTI Application
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                            Section 6(1) queries requesting quality checks, contractor, and budget logs.
                          </span>
                        </div>

                        {/* Police */}
                        <div 
                          onClick={() => setDocType('police')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-1.5 ${docType === 'police' ? 'bg-emerald-500/10 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-overlay)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                        >
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Shield size={13} className="text-rose-400" />
                            Police Complaint
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                            Citing public endangerment, negligence, and nuisance against officers.
                          </span>
                        </div>

                        {/* Consumer notice */}
                        <div 
                          onClick={() => setDocType('consumer')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-1.5 ${docType === 'consumer' ? 'bg-emerald-500/10 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-overlay)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                        >
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Briefcase size={13} className="text-orange-400" />
                            Consumer Notice
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                            Demand notice for deficiency of service by utilities under CP Act 2019.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-gray-800 pt-4">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold flex items-center gap-1">
                          <Scale size={13} className="text-emerald-400" />
                          Select Statutory Grounds & Acts (Citable Provisions)
                        </span>
                        {loadingActs && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                      </div>

                      {loadingActs ? (
                        <div className="py-4 text-center text-[10px] text-[var(--text-muted)]">
                          Retrieving relevant legal provisions...
                        </div>
                      ) : suggestedActs && suggestedActs.length > 0 ? (
                        <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                          {suggestedActs.map((act) => {
                            const isChecked = selectedActs.some(a => a.actName === act.actName && a.section === act.section);
                            const key = `${act.actName}-${act.section}`.toLowerCase();
                            const isExpanded = expandedAct === key;

                            return (
                              <div 
                                key={`${act.actName}-${act.section}`}
                                className={`p-2.5 rounded-lg border text-xs transition-colors flex flex-col gap-2 ${isChecked ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-[var(--bg-elevated)] border-[var(--border-default)] hover:border-emerald-500/20'}`}
                              >
                                <div 
                                  className="flex items-start gap-3 cursor-pointer w-full"
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedActs(selectedActs.filter(a => !(a.actName === act.actName && a.section === act.section)));
                                    } else {
                                      setSelectedActs([...selectedActs, act]);
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="mt-0.5 rounded border border-[var(--border-default)] text-[var(--teal-500)] focus:ring-[var(--teal-500)] cursor-pointer"
                                  />
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <div className="font-extrabold text-[var(--text-primary)] flex items-center justify-between gap-2">
                                      <span className="truncate">{act.actName} (Section/Article: {act.section})</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleActExpand(act);
                                        }}
                                        className="text-[9px] text-[var(--teal-500)] hover:underline font-bold shrink-0 cursor-pointer"
                                      >
                                        {isExpanded ? 'Hide Info' : 'Read Text'}
                                      </button>
                                    </div>
                                    <div className="text-[9.5px] text-[var(--text-muted)] leading-relaxed">
                                      {act.summary}
                                    </div>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div 
                                    className="pl-8 pt-2 mt-2 border-t border-[var(--border-subtle)] space-y-2 select-text"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {loadingActDetails && !actDetails[key] ? (
                                      <div className="flex items-center gap-1.5 py-2">
                                        <Loader2 size={10} className="animate-spin text-[var(--teal-500)]" />
                                        <span className="text-[8px] text-[var(--text-muted)]">Fetching official translations...</span>
                                      </div>
                                    ) : actDetails[key] ? (
                                      <div className="space-y-2 animate-fade-in">
                                        <div className="flex border-b border-[var(--border-subtle)] pb-1 gap-1">
                                          {[
                                            { id: 'en', label: 'English' },
                                            { id: 'ml', label: 'മലയാളം' },
                                            { id: 'hi', label: 'हिन्दी' }
                                          ].map(lang => (
                                            <button
                                              key={lang.id}
                                              type="button"
                                              onClick={() => setActiveLangTab(lang.id)}
                                              className={`px-2 py-0.5 text-[8px] font-extrabold rounded-md cursor-pointer transition-colors ${
                                                activeLangTab === lang.id
                                                  ? 'bg-[var(--teal-glow)] text-[var(--teal-500)] border border-[var(--teal-500)]/20'
                                                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                              }`}
                                            >
                                              {lang.label}
                                            </button>
                                          ))}
                                        </div>

                                        <p className="text-[9.5px] leading-relaxed text-[var(--text-secondary)] font-normal whitespace-pre-line max-h-24 overflow-y-auto pr-1 bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-subtle)]">
                                          {actDetails[key].languages?.[activeLangTab] || 'Translation unavailable.'}
                                        </p>

                                        {actDetails[key].note && (
                                          <div className="text-[8px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 p-1 px-2 rounded-md border border-amber-500/10 leading-normal">
                                            ⚠️ {actDetails[key].note}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-[8.5px] text-[var(--text-muted)] italic text-center py-2">
                                        Could not load details.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 text-[9px] text-[var(--text-muted)] italic text-center">
                          Standard statutory fallbacks will be included in draft.
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-3 border-t border-gray-800">
                      <button
                        onClick={() => setDocStep(2)}
                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-emerald-950/20 cursor-pointer"
                      >
                        <span>Petitioner Credentials</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: CREDENTIALS */}
                {docStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-[10px] text-[var(--text-muted)] italic leading-relaxed">
                      * Formal legal representations and notices require verified petitioner details (name, age, parent/spouse name, and residential address) to be legally binding and registered officially in government indices.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                          Lead Petitioner Full Name
                        </label>
                        <input
                          type="text"
                          value={repName}
                          onChange={(e) => setRepName(e.target.value)}
                          placeholder="e.g. R. K. Sundaram"
                          className="glass-input text-xs w-full py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                          Father / Spouse Name
                        </label>
                        <input
                          type="text"
                          value={petitionerFatherSpouseName}
                          onChange={(e) => setPetitionerFatherSpouseName(e.target.value)}
                          placeholder="e.g. S/o Late K. Ramanathan"
                          className="glass-input text-xs w-full py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                          Age (Years)
                        </label>
                        <input
                          type="text"
                          value={petitionerAge}
                          onChange={(e) => setPetitionerAge(e.target.value)}
                          placeholder="e.g. 42"
                          className="glass-input text-xs w-full py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Residential Address
                      </label>
                      <input
                        type="text"
                        value={petitionerResidingAddress}
                        onChange={(e) => setPetitionerResidingAddress(e.target.value)}
                        placeholder="e.g. Door No 14/B, 2nd Cross Street, Anna Nagar, Chennai"
                        className="glass-input text-xs w-full py-2"
                      />
                    </div>

                    <div className="flex justify-between pt-3 border-t border-gray-800">
                      <button
                        onClick={() => setDocStep(1)}
                        className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] font-bold text-xs uppercase tracking-wider flex items-center space-x-1 border border-[var(--border-default)] cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Back</span>
                      </button>
                      <button
                        onClick={() => setDocStep(3)}
                        className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-emerald-950/20 cursor-pointer"
                      >
                        <span>Target Authority</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: AUTHORITY & GENERATE */}
                {docStep === 3 && (
                  <form onSubmit={handleGenerateDocument} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Addressed Authority Title / Respondent
                      </label>
                      <select
                        value={addressedAuth}
                        onChange={(e) => setAddressedAuth(e.target.value)}
                        className="glass-input text-xs w-full py-2 text-[var(--text-primary)]"
                      >
                        <option value="">Select Addressed Authority / Officer...</option>
                        <option value="The District Collector & District Magistrate">The District Collector & Magistrate (Collectorate Office)</option>
                        <option value="The Commissioner, Municipal Corporation">The Commissioner (Municipal Corporation)</option>
                        <option value="The Executive Engineer (Public Works Department / Highways)">The Executive Engineer (PWD / Highways)</option>
                        <option value="The Inspector of Police (Local Station)">The Inspector of Police (Local Station)</option>
                        <option value="Other">Other / Custom Authority Name...</option>
                      </select>

                      {addressedAuth === 'Other' && (
                        <input
                          type="text"
                          value={customAuth}
                          onChange={(e) => setCustomAuth(e.target.value)}
                          placeholder="e.g. The Superintending Engineer, TANGEDCO"
                          className="glass-input text-xs w-full py-2 mt-2"
                          required
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Specific Relief Demands / Prayers (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={customDemands}
                        onChange={(e) => setCustomDemands(e.target.value)}
                        placeholder="e.g. 1. Order immediate field inspection within 24 hours. 2. Direct delinquent contractors to resurface road defect within 48 hours. 3. Issue safety barricading immediately."
                        className="glass-input text-xs w-full p-2.5"
                      />
                    </div>

                    <div className="flex justify-between pt-3 border-t border-gray-800">
                      <button
                        type="button"
                        onClick={() => setDocStep(2)}
                        className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] font-bold text-xs uppercase tracking-wider flex items-center space-x-1 border border-[var(--border-default)] cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Back</span>
                      </button>
                      <button
                        type="submit"
                        disabled={generatingDoc}
                        className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-emerald-950/30 disabled:opacity-50 cursor-pointer"
                      >
                        {generatingDoc ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Drafting Legal Document...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Generate Formal Legal Petition</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* GENERATED DOCUMENT PREVIEW & ACTIONS */
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 animate-fadeIn">
                <div className="flex items-center justify-between bg-[var(--bg-elevated)] p-2.5 rounded-xl border border-[var(--border-subtle)] flex-wrap gap-2 print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                      ✅ Legal Draft Ready to Print
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintDoc}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Printer size={12} />
                      <span>Print / Save PDF</span>
                    </button>
                    <button
                      onClick={handleCopyDoc}
                      className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--teal-500)] border border-[var(--teal-500)]/30 font-extrabold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedDoc ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedDoc ? 'Copied!' : 'Copy Draft'}</span>
                    </button>
                    <button
                      onClick={() => setIsEditingDoc(!isEditingDoc)}
                      className="px-3 py-1.5 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] font-extrabold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isEditingDoc ? 'Preview' : 'Edit Text'}</span>
                    </button>
                    <button
                      onClick={() => setGeneratedDoc(null)}
                      className="px-3 py-1.5 bg-[var(--bg-surface)] text-[var(--text-muted)] font-extrabold text-[10px] uppercase tracking-wider rounded-lg hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                {isEditingDoc ? (
                  <textarea
                    rows={20}
                    value={generatedDoc}
                    onChange={(e) => setGeneratedDoc(e.target.value)}
                    className="w-full p-4 rounded-xl font-mono text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none leading-relaxed"
                  />
                ) : (
                  <div className="p-6 bg-white text-gray-950 rounded-xl font-serif text-xs leading-relaxed space-y-3 select-text shadow-inner border border-gray-300 print:p-0 print:border-none print:shadow-none">
                    {renderMarkdownText(generatedDoc)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
