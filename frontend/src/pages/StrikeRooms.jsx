import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { useLocation, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Users, ArrowRight, Shield, Bell,
  MapPin, Loader2, Send, MessageSquare,
  FileText, Printer, Download, Copy, Eye, Sparkles, X,
  Scale, FileCheck, Check, ChevronLeft, ChevronRight, Gavel, Briefcase, Trash2,
  TrendingUp, BookOpen, Navigation2
} from 'lucide-react';
import toast from 'react-hot-toast';

function renderMarkdownText(text = '') {
  const blocks = String(text).split('\n\n').filter(Boolean);
  const boldPattern = /\*\*(.+?)\*\*/g;

  const parseInline = (line, blockIdx, lineIdx) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldPattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`b-${blockIdx}-${lineIdx}-${match.index}`} className="font-extrabold text-gray-900">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts;
  };

  return blocks.map((block, blockIdx) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={`h3-${blockIdx}`} className="text-xs font-extrabold text-gray-900 border-b border-gray-200 pb-1 mt-3 mb-1 uppercase tracking-wide font-sans">
          {parseInline(trimmed.replace('### ', ''), blockIdx, 0)}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={`h2-${blockIdx}`} className="text-sm font-extrabold text-gray-900 border-b-2 border-gray-300 pb-1.5 mt-5 mb-2 uppercase tracking-wide font-sans">
          {parseInline(trimmed.replace('## ', ''), blockIdx, 0)}
        </h2>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h1 key={`h1-${blockIdx}`} className="text-base font-black text-center text-gray-900 border-b-4 border-gray-950 pb-2 mb-6 uppercase tracking-wider font-sans">
          {parseInline(trimmed.replace('# ', ''), blockIdx, 0)}
        </h1>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split(/\n[-*]\s+/);
      return (
        <ul key={`ul-${blockIdx}`} className="list-disc pl-5 my-2 space-y-1 text-xs">
          {items.map((item, idx) => (
            <li key={`li-${blockIdx}-${idx}`} className="text-gray-800">
              {parseInline(item.replace(/^[-*]\s+/, ''), blockIdx, idx)}
            </li>
          ))}
        </ul>
      );
    }

    const lines = trimmed.split('\n');
    return (
      <p key={`p-${blockIdx}`} className="text-xs text-gray-850 leading-relaxed text-justify space-y-1 font-serif">
        {lines.map((line, lineIdx) => (
          <React.Fragment key={`l-${blockIdx}-${lineIdx}`}>
            {parseInline(line, blockIdx, lineIdx)}
            {lineIdx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

export default function StrikeRooms() {
  const { isSignedIn, loadingProfile, socket, userProfile, fetchProfile, setHideMobileBottomNav } = useCivic();
  const location = useLocation();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Linked post information for active room
  const [linkedPost, setLinkedPost] = useState(null);

  // Real-time Chat States
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [userAlias, setUserAlias] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(1);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [heartsAnimating, setHeartsAnimating] = useState({});
  const [locating, setLocating] = useState(false);
  const [roomDetailsLoading, setRoomDetailsLoading] = useState(false);

  // Legal Document Generator States
  const [showDocModal, setShowDocModal] = useState(false);
  const [repName, setRepName] = useState('');
  const [addressedAuth, setAddressedAuth] = useState('District Collector');
  const [customAuth, setCustomAuth] = useState('');
  const [customDemands, setCustomDemands] = useState('');
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [petitionerFatherSpouseName, setPetitionerFatherSpouseName] = useState('');
  const [petitionerAge, setPetitionerAge] = useState('');
  const [petitionerResidingAddress, setPetitionerResidingAddress] = useState('');

  const [hierarchy, setHierarchy] = useState([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [suggestedActs, setSuggestedActs] = useState([]);
  const [loadingActs, setLoadingActs] = useState(false);
  const [selectedActs, setSelectedActs] = useState([]);
  const [expandedAct, setExpandedAct] = useState(null);
  const [actDetails, setActDetails] = useState({});
  const [loadingActDetails, setLoadingActDetails] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState('en');
  const [docType, setDocType] = useState('collector');
  const [docStep, setDocStep] = useState(1);
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' | 'details'
  const [detailsTab, setDetailsTab] = useState('status'); // 'status' | 'officials' | 'legal' | 'petition' | 'map'

  const messagesEndRef = useRef(null);
  const lastClickTimeRef = useRef({});

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForSession = async (attempts = 12, delayMs = 250) => {
    for (let i = 0; i < attempts; i += 1) {
      if (isSignedIn && !loadingProfile) return true;
      await sleep(delayMs);
    }
    return isSignedIn && !loadingProfile;
  };

  const [ownedPostIds, setOwnedPostIds] = useState(new Set());

  const fetchStrikeRooms = async () => {
    const ready = await waitForSession();
    if (!ready) return;

    try {
      setLoading(true);
      const [roomsRes, postsRes] = await Promise.all([
        api.get('/rooms', { params: { type: 'strike' } }),
        api.get('/auth/my-posts').catch(() => ({ data: { posts: [] } }))
      ]);
      setRooms(roomsRes.data.rooms);
      setOwnedPostIds(new Set(postsRes.data.posts.map(p => p._id)));
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        return;
      }
      toast.error('Failed to load strike channels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrikeRooms();
  }, [isSignedIn, loadingProfile]);

  useEffect(() => {
    if (setHideMobileBottomNav) {
      setHideMobileBottomNav(!!activeRoom);
    }
    return () => {
      if (setHideMobileBottomNav) {
        setHideMobileBottomNav(false);
      }
    };
  }, [activeRoom, setHideMobileBottomNav]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomId = params.get('roomId');

    if (!roomId || activeRoom?._id === roomId) return;

    let cancelled = false;

    const loadRoomById = async () => {
      try {
        const res = await api.get(`/rooms/${roomId}`);
        if (cancelled) return;

        setActiveRoom(res.data.room);
        setMessages(res.data.messages || []);
        setMemberCount(res.data.room.memberCount || 0);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load strike room by id:', err);
        }
      }
    };

    loadRoomById();

    return () => {
      cancelled = true;
    };
  }, [location.search, activeRoom?._id]);

  useEffect(() => {
    if (!rooms.length) return;

    const params = new URLSearchParams(location.search);
    const roomId = params.get('roomId');
    const postId = params.get('postId');

    if (roomId && activeRoom?._id === roomId) return;

    const targetRoom = rooms.find(room =>
      String(room._id) === String(roomId) ||
      (postId && String(room.postId) === String(postId))
    );
    if (targetRoom && activeRoom?._id !== targetRoom._id) {
      setActiveRoom(targetRoom);
    }
  }, [rooms, location.search, activeRoom?._id]);

  // Fetch linked post details when active room changes
  useEffect(() => {
    if (!activeRoom) {
      setLinkedPost(null);
      setRoomDetailsLoading(false);
      setHierarchy([]);
      setSuggestedActs([]);
      setSelectedActs([]);
      setGeneratedDoc(null);
      setDocStep(1);
      return;
    }

    setMobileTab('chat');

    const loadRoomDetails = async () => {
      setHierarchy([]);
      setSuggestedActs([]);
      setSelectedActs([]);
      setGeneratedDoc(null);
      setDocStep(1);
      try {
        setRoomDetailsLoading(true);
        const res = await api.get(`/rooms/${activeRoom._id}`);
        setMessages(res.data.messages || []);
        setMemberCount(res.data.room.memberCount || 0);

        if (activeRoom.postId) {
          try {
            const postRes = await api.get(`/posts/${activeRoom.postId}`);
            setLinkedPost(postRes.data.post);
            // Fetch hierarchy and suggested acts
            fetchOfficialsHierarchy(activeRoom._id);
            fetchSuggestedActs(activeRoom._id);
          } catch (postErr) {
            console.error('Failed to load linked post:', postErr);
            if (postErr.response?.status === 404) {
              toast.error('The linked civic post has been resolved or removed. This room is now closed.');
              setActiveRoom(null);
              setLinkedPost(null);
              fetchStrikeRooms();
              return;
            }
          }
        }
      } catch (err) {
        console.error('Failed to load strike room details:', err);
        if (err.response?.status === 404) {
          toast.error('Protest room no longer active.');
          setActiveRoom(null);
          setLinkedPost(null);
          fetchStrikeRooms();
        }
      } finally {
        setRoomDetailsLoading(false);
      }
    };
    loadRoomDetails();
  }, [activeRoom]);

  // Reset message options menu when room changes
  useEffect(() => {
    if (activeRoom) {
      setActiveMessageMenu(null);
    }
  }, [activeRoom]);

  const fetchRecentMessages = async (roomId) => {
    if (!roomId) return;
    try {
      const res = await api.get(`/rooms/${roomId}`);
      setMessages(res.data.messages || []);
      setMemberCount(res.data.room.memberCount || 0);
    } catch (err) {
      console.error('Failed to reload strike room messages:', err);
    }
  };

  // Setup Socket Listeners
  useEffect(() => {
    if (!socket || !activeRoom) return;

    const joinRoom = () => {
      socket.emit('room:join', { roomId: activeRoom._id });
    };

    const handleRoomJoined = ({ roomId, alias, memberCount: count, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      setUserAlias(alias);
      if (typeof count === 'number') setMemberCount(count);
      if (typeof activeCount === 'number') setOnlineCount(activeCount);
    };

    const handleUserJoined = ({ roomId, memberCount: count, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (typeof count === 'number') setMemberCount(count);
      if (typeof activeCount === 'number') setOnlineCount(activeCount);
    };

    const handleUserLeft = ({ roomId, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (typeof activeCount === 'number') setOnlineCount(activeCount);
    };

    // Global strike counts broadcaster
    const handleStrikeCountUpdate = ({ roomId, memberCount: count }) => {
      setRooms(prev => prev.map(r => r._id === roomId ? { ...r, memberCount: count } : r));
      if (activeRoom?._id === roomId) {
        setMemberCount(count);
      }
    };

    const handleNewMessage = (msg) => {
      if (msg.roomId && msg.roomId !== activeRoom._id) return;
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const handleMessageUpdated = ({ messageId, text }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, text } : m));
    };

    const handleMessageReacted = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
    };

    const handleRejected = ({ reason }) => {
      toast.error(`Message Blocked: ${reason}`);
    };

    const handleMessageFlagged = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, text: '[Message deleted by AI content moderation]' }
            : m
        )
      );
    };

    const handleMessageError = ({ message }) => {
      toast.error(message || 'Message could not be sent.');
    };

    const handleRoomError = ({ message }) => {
      toast.error(message || 'Could not join strike room.');
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('room:user_joined', handleUserJoined);
    socket.on('room:user_left', handleUserLeft);
    socket.on('strike:count_update', handleStrikeCountUpdate);
    socket.on('message:new', handleNewMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:reacted', handleMessageReacted);
    socket.on('message:rejected', handleRejected);
    socket.on('message:flagged', handleMessageFlagged);
    socket.on('message:error', handleMessageError);
    socket.on('room:error', handleRoomError);

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on('connect', joinRoom);
    }

    return () => {
      socket.off('connect', joinRoom);
      socket.emit('room:leave', { roomId: activeRoom._id });
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:user_joined', handleUserJoined);
      socket.off('room:user_left', handleUserLeft);
      socket.off('strike:count_update', handleStrikeCountUpdate);
      socket.off('message:new', handleNewMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:reacted', handleMessageReacted);
      socket.off('message:rejected', handleRejected);
      socket.off('message:flagged', handleMessageFlagged);
      socket.off('message:error', handleMessageError);
      socket.off('room:error', handleRoomError);
    };
  }, [activeRoom, socket]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleReactToMessage = (messageId, emoji) => {
    if (!socket || !activeRoom) return;

    // Optimistic toggle locally
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== messageId) return m;

        const currentReactions = { ...(m.reactions || {}) };
        let usersList = currentReactions[emoji] || [];

        if (usersList.includes(userAlias)) {
          usersList = usersList.filter((u) => u !== userAlias);
        } else {
          usersList = [...usersList, userAlias];
        }

        if (usersList.length === 0) {
          delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = usersList;
        }

        return { ...m, reactions: currentReactions };
      })
    );

    socket.emit('message:react', { messageId, roomId: activeRoom._id, emoji }, (response) => {
      if (!response?.ok) {
        toast.error(response?.error || 'Failed to toggle reaction.');
        fetchRecentMessages(activeRoom._id);
      }
    });
  };

  const handleDoubleTap = (messageId) => {
    const now = Date.now();
    const lastClick = lastClickTimeRef.current[messageId] || 0;
    if (now - lastClick < 250) {
      if (lastClickTimeRef.current[`timeout-${messageId}`]) {
        clearTimeout(lastClickTimeRef.current[`timeout-${messageId}`]);
      }
      handleReactToMessage(messageId, '❤️');
      setHeartsAnimating((prev) => ({ ...prev, [messageId]: true }));
      setTimeout(() => {
        setHeartsAnimating((prev) => ({ ...prev, [messageId]: false }));
      }, 800);
    } else {
      lastClickTimeRef.current[`timeout-${messageId}`] = setTimeout(() => {
        setActiveMessageMenu((prev) => (prev === messageId ? null : messageId));
      }, 250);
    }
    lastClickTimeRef.current[messageId] = now;
  };

  const handleUnsendMessage = (messageId) => {
    if (!socket || !activeRoom) return;
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
    setActiveMessageMenu(null);
    socket.emit('message:unsend', { messageId, roomId: activeRoom._id }, (response) => {
      if (!response?.ok) {
        toast.error(response?.error || 'Failed to unsend.');
        fetchRecentMessages(activeRoom._id);
      } else {
        toast.success('Message unsent.');
      }
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !socket || !activeRoom) return;
    if (!socket.connected) {
      toast.error('Chat is reconnecting. Try again in a moment.');
      return;
    }

    setInputText('');

    socket.timeout(8000).emit('message:send', {
      roomId: activeRoom._id,
      text,
    }, (err, response) => {
      if (err) {
        toast.error('Message send timed out. Please retry.');
        setInputText(text);
        return;
      }

      if (!response?.ok) {
        toast.error(response?.error || 'Message could not be sent.');
        setInputText(text);
        return;
      }
    });
  };

  const handleJoinStrike = async () => {
    if (!isSignedIn) {
      toast.error('You must join the platform to support strikes.');
      return;
    }
    try {
      const res = await api.post(`/rooms/${activeRoom._id}/join`);
      setMemberCount(res.data.memberCount);
      toast.success('Joined protest! Your support is logged.');

      // Update local room list cache
      setRooms(prev => prev.map(r => r._id === activeRoom._id ? { ...r, memberCount: res.data.memberCount } : r));

      // Notify socket server
      if (socket) {
        socket.emit('strike:join', { roomId: activeRoom._id });
      }

      // Sync profile joinedRooms lists
      fetchProfile();
    } catch (err) {
      toast.error('Already supported or connection failure.');
    }
  };

  const handleLeaveStrike = async () => {
    try {
      await api.post(`/rooms/${activeRoom._id}/leave`);
      toast.success('Withdrew strike support.');
      fetchProfile();
      fetchStrikeRooms();
      setActiveRoom(null);
    } catch (err) {
      toast.error('Failed to withdraw support.');
    }
  };

  const handleDeleteStrikeRoom = async () => {
    if (!window.confirm('Are you sure you want to permanently delete/disband this strike protest room? This action cannot be undone.')) return;
    try {
      await api.delete(`/rooms/${activeRoom._id}`);
      toast.success('Protest room deleted successfully.');
      setActiveRoom(null);
      fetchStrikeRooms();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete protest room.');
    }
  };

  const fetchOfficialsHierarchy = async (roomId) => {
    try {
      setLoadingHierarchy(true);
      const res = await api.get(`/rooms/${roomId}/officials-hierarchy`);
      setHierarchy(res.data.hierarchy || []);
      const l4 = res.data.hierarchy?.find(h => h.level === 'L4');
      if (l4) {
        setAddressedAuth(l4.designation);
      }
    } catch (err) {
      console.error('Failed to load officials hierarchy:', err);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const fetchSuggestedActs = async (roomId) => {
    try {
      setLoadingActs(true);
      const res = await api.get(`/rooms/${roomId}/suggest-acts`);
      setSuggestedActs(res.data.acts || []);
      setSelectedActs(res.data.acts?.filter(act => act.selectedByDefault) || []);
    } catch (err) {
      console.error('Failed to load suggested acts:', err);
    } finally {
      setLoadingActs(false);
    }
  };

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

  const handleGenerateDocument = async (e) => {
    e.preventDefault();
    if (!activeRoom) return;

    try {
      setGeneratingDoc(true);
      const authority = addressedAuth === 'Other' ? customAuth : addressedAuth;
      const res = await api.post(`/rooms/${activeRoom._id}/legal-document`, {
        representativeName: repName,
        addressedAuthority: authority,
        customDemands,
        docType,
        petitionerFatherSpouseName,
        petitionerAge,
        petitionerResidingAddress,
        selectedActs
      });
      setGeneratedDoc(res.data.document);
      setIsEditingDoc(false);
      toast.success('Legal document draft generated successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to generate legal document.');
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc);
    toast.success('Copied to clipboard!');
  };

  const handleDownloadMarkdown = () => {
    if (!generatedDoc || !linkedPost) return;
    const element = document.createElement("a");
    const file = new Blob([generatedDoc], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `grievance_petition_${linkedPost._id}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Downloaded petition file!');
  };

  const handlePrintDoc = () => {
    if (!generatedDoc || !linkedPost) return;

    const printWindow = window.open('', '_blank');
    const contactsText = linkedPost.attachedContacts && linkedPost.attachedContacts.length > 0
      ? linkedPost.attachedContacts.map(c => `
        <div style="margin-bottom: 5px; font-size: 13px;">
          <strong>Officer Name:</strong> ${c.officerName || 'N/A'}<br/>
          <strong>Designation:</strong> ${c.designation || 'N/A'}<br/>
          <strong>Department:</strong> ${c.department}<br/>
          <strong>Contact:</strong> ${c.phone?.join(', ') || 'N/A'} | ${c.email || 'N/A'}
        </div>
      `).join('')
      : '<p style="font-size: 13px;">No direct official contact details mapped. (Address to District Collector / Municipal Commissioner)</p>';

    // Render markdown headings and list elements in printing HTML
    let bodyHtml = generatedDoc
      .replace(/###\s+(.+)/g, '<h3 style="font-family: Arial, sans-serif; font-size: 14px; margin-top: 15px; border-bottom: 1px solid #ddd; padding-bottom: 4px; text-transform: uppercase;">$1</h3>')
      .replace(/##\s+(.+)/g, '<h2 style="font-family: Arial, sans-serif; font-size: 16px; margin-top: 20px; border-bottom: 1.5px solid #bbb; padding-bottom: 6px; text-transform: uppercase;">$1</h2>')
      .replace(/#\s+(.+)/g, '<h1 style="text-align: center; text-transform: uppercase; font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px; font-family: Arial, sans-serif;">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/-\s+(.+)/g, '<li style="margin-bottom: 6px; font-size: 13px;">$1</li>')
      .replace(/\n\n/g, '<p style="font-size: 13px; text-align: justify; line-height: 1.6; margin-bottom: 15px;"></p>');

    const petitionHtml = `
      <html>
        <head>
          <title>Grievance Petition - ${linkedPost.title}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            @media print {
              body {
                padding: 0;
                color: #000 !important;
                background: #fff !important;
              }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
            }
            body {
              font-family: 'Georgia', 'Times New Roman', serif;
              line-height: 1.6;
              color: #111;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              background: #fff;
            }
            .petition-body {
              white-space: pre-wrap;
              font-size: 13px;
              text-align: justify;
            }
            .official-contacts {
              margin-top: 30px;
              padding: 15px;
              border: 1px solid #ccc;
              background-color: #f9f9f9;
              border-radius: 5px;
              font-family: Arial, sans-serif;
            }
            .signature-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            .signature-table th, .signature-table td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
              font-size: 11px;
            }
            .signature-table th {
              background-color: #f2f2f2;
            }
            li {
              list-style-type: square;
              margin-left: 20px;
            }
          </style>
        </head>
        <body>
          <div class="petition-body">
            ${bodyHtml}
          </div>
          
          <div class="official-contacts">
            <h3 style="font-family: Arial, sans-serif; font-size: 13px; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #aaa; padding-bottom: 3px; text-transform: uppercase;">
              Official Department Contact Details (For Submission Reference)
            </h3>
            ${contactsText}
          </div>

          ${includeSignatures ? `
            <div class="page-break"></div>
            <h1 style="text-align: center; font-family: Arial, sans-serif; font-size: 16px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
              Supporting Citizens & Local Residents Endorsement Signatures Log
            </h1>
            <p style="font-size: 11px; margin-bottom: 15px; text-align: justify; line-height: 1.4; color: #333;">
              We, the undersigned residents, voters, and local stakeholders of the area, do hereby endorse the facts and statements detailed in the attached Civic Grievance Petition (Grievance Ref: ${linkedPost._id}) regarding <strong>"${linkedPost.title}"</strong>. We formally petition the municipal administration and regional departments to initiate repairs/inspections immediately to ensure safety and restore public welfare.
            </p>
            <table class="signature-table">
              <thead>
                <tr>
                  <th style="width: 5%">S.No</th>
                  <th style="width: 25%">Name of Resident / Supporter</th>
                  <th style="width: 35%">Residential Address / Ward Number</th>
                  <th style="width: 20%">Contact / Mobile Number</th>
                  <th style="width: 15%">Signature</th>
                </tr>
              </thead>
              <tbody>
                ${Array.from({ length: 15 }).map((_, i) => `
                  <tr style="height: 35px;">
                    <td style="text-align: center;">${i + 1}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="font-size: 9px; color: #555; text-align: right; margin-top: 10px;">
              * Verified Mobilized CivicTN Petition Log. Total digital supporters on app: ${memberCount}.
            </p>
          ` : ''}
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(petitionHtml);
    printWindow.document.close();
  };

  const resetDocState = () => {
    setShowDocModal(false);
    setRepName('');
    const l4 = hierarchy?.find(h => h.level === 'L4');
    setAddressedAuth(l4 ? l4.designation : 'District Collector');
    setCustomAuth('');
    setCustomDemands('');
    setGeneratedDoc(null);
    setIsEditingDoc(false);
    setPetitionerFatherSpouseName('');
    setPetitionerAge('');
    setPetitionerResidingAddress('');
    setSelectedActs(suggestedActs?.filter(act => act.selectedByDefault) || []);
    setDocType('municipal');
    setDocStep(1);
  };

  const handleAutoFillLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await api.get('/contacts/by-location', {
            params: { lat: latitude, lng: longitude }
          });
          if (res.data?.address) {
            setPetitionerResidingAddress(res.data.address);
            toast.success('Location detected and address filled!');
          } else {
            toast.error('Could not resolve location coordinates to address.');
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to reverse-geocode location.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.error(err);
        let msg = 'Could not retrieve your location.';
        if (err.code === 1) msg = 'Location access denied. Please enable location permissions.';
        toast.error(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Escalation utility helper
  const getEscalationLevel = (count) => {
    if (count >= 500) return { lvl: 4, name: 'City Commissioner Action Required', text: 'Highest Alert. Direct escalation sent to District Commissioner.' };
    if (count >= 100) return { lvl: 3, name: 'Executive Engineer Escalated', text: 'Severity High. Notification dispatched to department Chief Engineer.' };
    if (count >= 50) return { lvl: 2, name: 'District Officer Notified', text: 'Protest Active. Local field officer alerted for resolution.' };
    return { lvl: 1, name: 'Community Support Gathering', text: 'Protest Open. Building support. Need 50 members for official notification.' };
  };

  const currentEscalation = getEscalationLevel(memberCount);
  const isJoined = userProfile?.joinedRooms?.includes(activeRoom?._id);
  const canDeleteRoom = activeRoom && (
    activeRoom.createdBy === userProfile?.clerkId ||
    (activeRoom.postId && ownedPostIds.has(activeRoom.postId)) ||
    userProfile?.role === 'admin'
  );

  return (
    <div className={`${activeRoom ? 'h-[calc(100vh-3.5rem)]' : 'h-[calc(100vh-7.25rem)]'} lg:h-screen flex flex-col lg:flex-row gap-0 overflow-hidden relative`}>

      {/* ———— SIDEBAR ———— */}
      <div className={`w-full lg:w-72 flex flex-col h-full overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] ${activeRoom ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link
              to="/feed"
              className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Back to feed"
            >
              <ChevronLeft size={16} />
            </Link>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Strikes</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Active community protests</p>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(n => <div key={n} className="h-14 rounded-xl bg-[var(--bg-elevated)]" />)}
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center">
              <Flame size={24} className="mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-xs text-[var(--text-muted)]">No active strike rooms</p>
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room._id}
                onClick={() => setActiveRoom(room)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all text-xs flex items-center justify-between cursor-pointer ${
                  activeRoom?._id === room._id
                    ? 'bg-[var(--bg-elevated)] font-semibold'
                    : 'hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="truncate pr-2 space-y-0.5 min-w-0">
                  <span className="font-semibold block truncate text-[var(--text-primary)] text-[13px]">{room.name}</span>
                  {room.district && (
                    <span className="text-[10px] text-[var(--text-muted)] font-medium">{room.district}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] px-2 py-1 rounded-lg font-semibold">
                  <Users size={10} />
                  <span>{room.memberCount || 0}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ———— MAIN CANVAS ———— */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-surface)] ${activeRoom ? 'flex' : 'hidden lg:flex'}`}>
        {activeRoom ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar — WhatsApp group header style */}
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveRoom(null)}
                  className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] transition-colors cursor-pointer flex-shrink-0"
                  aria-label="Back to channels"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* WhatsApp-style group avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
                >
                  <Flame size={17} className="text-white" />
                </div>

                {/* Group name + member pill */}
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--text-primary)] text-[14px] truncate leading-tight">{activeRoom.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-secondary)]">{memberCount}</span> members
                    </span>
                    <span className="text-[var(--text-muted)] text-[10px]">·</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[11px] text-[var(--text-muted)]">{onlineCount} online</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {canDeleteRoom && (
                  <button
                    onClick={handleDeleteStrikeRoom}
                    className="px-3 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-medium border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-all"
                  >
                    Disband
                  </button>
                )}
                {isJoined ? (
                  <button
                    onClick={handleLeaveStrike}
                    className="px-4 py-1.5 rounded-lg text-[var(--text-muted)] text-xs font-semibold border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-all"
                  >
                    Withdraw
                  </button>
                ) : (
                  <button
                    onClick={handleJoinStrike}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold transition-all"
                    style={{ background: 'var(--teal-500)' }}
                  >
                    Lend Support
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Tab Toggle — Chat vs Details */}
            <div className="flex lg:hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className={`flex-1 py-2.5 text-center text-[11px] font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === 'chat'
                    ? 'border-[var(--teal-500)] text-[var(--teal-500)] bg-[var(--teal-glow)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MessageSquare size={13} />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('details')}
                className={`flex-1 py-2.5 text-center text-[11px] font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === 'details'
                    ? 'border-[var(--teal-500)] text-[var(--teal-500)] bg-[var(--teal-glow)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Shield size={13} />
                <span>Action & Legal</span>
              </button>
            </div>

            {/* Content Grid: Info + Chat */}
            <div className="flex-1 flex lg:grid lg:grid-cols-12 overflow-hidden bg-[var(--bg-base)]">

              {/* LEFT: Details Panel */}
              <div className={`w-full lg:col-span-5 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-base)] ${mobileTab === 'details' ? 'flex' : 'hidden lg:flex'}`}>

                {/* ── Tab Nav — icon + label underline style */}
                <div className="flex-shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                  <div className="flex items-center overflow-x-auto scrollbar-none">
                    {[
                      { id: 'status',   label: 'Status',   Icon: TrendingUp },
                      { id: 'officials',label: 'Officials', Icon: Users },
                      { id: 'legal',    label: 'Legal',     Icon: BookOpen },
                      { id: 'petition', label: 'Petition',  Icon: FileText },
                      ...(linkedPost?.location?.coordinates ? [{ id: 'map', label: 'Map', Icon: Navigation2 }] : [])
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setDetailsTab(tab.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-4 py-3 text-[11px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                          detailsTab === tab.id
                            ? 'border-[var(--teal-500)] text-[var(--teal-500)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                        }`}
                      >
                        <tab.Icon size={12} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content — min-h-0 is critical so flex-1 actually constrains height */}
                <div className="flex-1 min-h-0 overflow-y-auto">

                {/* Status Tab */}
                {detailsTab === 'status' && (
                <div className="p-4 space-y-3">

                  {/* Escalation name + level pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1">Escalation Level {currentEscalation.lvl}</p>
                      <p className="text-[15px] font-bold text-[var(--text-primary)] leading-snug">{currentEscalation.name}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border" style={{ color: 'var(--teal-500)', borderColor: 'var(--teal-500)', background: 'var(--teal-glow)' }}>
                      {memberCount}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">Progress to next level</span>
                      <span className="text-[10px] font-semibold text-[var(--text-muted)]">{memberCount} / 500</span>
                    </div>
                    <div className="w-full bg-[var(--border-subtle)] h-[3px] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (memberCount / 500) * 100)}%`, background: 'var(--teal-500)' }} />
                    </div>
                  </div>

                  {/* Status text */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)] mb-1">What this means</p>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{currentEscalation.text}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 text-center">
                      <p className="text-[22px] font-black text-[var(--text-primary)] leading-none">{memberCount}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">Supporting</p>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 text-center">
                      <p className="text-[22px] font-black leading-none" style={{ color: 'var(--teal-500)' }}>{currentEscalation.lvl}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">Tier Level</p>
                    </div>
                  </div>
                </div>
                )}

                {/* ── Officials Tab */}
                {detailsTab === 'officials' && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[12px] font-bold text-[var(--text-primary)]">Line of Command</span>
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">{hierarchy.length} levels</span>
                  </div>

                  {loadingHierarchy ? (
                    <div className="flex items-center justify-center gap-2 py-10">
                      <Loader2 size={16} className="animate-spin text-[var(--teal-500)]" />
                      <span className="text-[11px] text-[var(--text-muted)]">Resolving local authorities...</span>
                    </div>
                  ) : hierarchy && hierarchy.length > 0 ? (
                    <div className="space-y-2.5">
                      {hierarchy.map((level, idx) => (
                        <div key={level.level} className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
                          {/* Header row */}
                          <div className="px-4 py-3 flex items-center justify-between gap-2 bg-[var(--bg-surface)]">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--teal-glow)', border: '1px solid var(--teal-500)30' }}>
                                <Users size={13} className="text-[var(--teal-500)]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-snug truncate">{level.designation}</p>
                                <p className="text-[10px] text-[var(--text-muted)] truncate">{level.department}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-semibold shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-1 rounded-lg">{level.timeframe}</span>
                          </div>

                          {/* Role */}
                          <div className="px-4 py-2.5 border-t border-[var(--border-subtle)]">
                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">{level.role}</p>
                          </div>

                          {/* Contact */}
                          {level.contact && (
                            <div className="px-4 pb-3 border-t border-[var(--border-subtle)] pt-2.5 space-y-0.5">
                              <p className="text-[12px] font-semibold text-[var(--text-primary)]">{level.contact.officerName || 'Designated Official'}</p>
                              {level.contact.phone?.length > 0 && (
                                <p className="text-[11px] text-[var(--text-muted)] font-mono">{level.contact.phone.join(' · ')}</p>
                              )}
                              {level.contact.email && (
                                <p className="text-[11px] text-[var(--teal-500)] font-mono truncate">{level.contact.email}</p>
                              )}
                            </div>
                          )}

                          {/* Action */}
                          <button
                            onClick={() => { setAddressedAuth(level.designation); setShowDocModal(true); setDocStep(2); }}
                            className="w-full py-2.5 text-center text-[11px] font-bold border-t border-[var(--border-subtle)] transition-all cursor-pointer"
                            style={{ color: 'var(--teal-500)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-glow)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            Address Petition →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)] text-center py-8">Resolving local governance structure...</p>
                  )}
                </div>
                )}

                {/* ── Legal Tab */}
                {detailsTab === 'legal' && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[12px] font-bold text-[var(--text-primary)]">Statutory & Legal Grounds</span>
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">Grievance Basis</span>
                  </div>

                  {loadingActs ? (
                    <div className="flex items-center justify-center gap-2 py-10">
                      <Loader2 size={16} className="animate-spin text-[var(--teal-500)]" />
                      <span className="text-[11px] text-[var(--text-muted)]">Resolving legal grounds...</span>
                    </div>
                  ) : suggestedActs && suggestedActs.length > 0 ? (
                    <div className="space-y-2.5">
                      {suggestedActs.map((act, idx) => {
                        const key = `${act.actName}-${act.section}`.toLowerCase();
                        const isExpanded = expandedAct === key;

                        let badgeText = 'BNS';
                        let badgeColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
                        if (act.actName.toLowerCase().includes('constitution')) { badgeText = 'Const'; badgeColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'; }
                        else if (act.actName.toLowerCase().includes('penal')) { badgeText = 'IPC'; badgeColor = 'text-blue-500 bg-blue-500/10 border-blue-500/20'; }

                        return (
                          <div
                            key={idx}
                            className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden cursor-pointer hover:border-[var(--teal-500)]/30 transition-all"
                            onClick={() => toggleActExpand(act)}
                          >
                            <div className="px-4 py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded-md shrink-0 ${badgeColor}`}>
                                  {badgeText}
                                </span>
                                <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{act.section}</span>
                              </div>
                              <span className="text-[10px] font-semibold shrink-0" style={{ color: 'var(--teal-500)' }}>{isExpanded ? '↑ Hide' : '↓ More'}</span>
                            </div>

                            <div className="px-4 pb-3 border-t border-[var(--border-subtle)] pt-2.5">
                              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{act.summary}</p>
                            </div>

                            {isExpanded && (
                              <div
                                className="px-3 pb-3 border-t border-[var(--border-subtle)] pt-2 space-y-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {loadingActDetails && !actDetails[key] ? (
                                  <div className="flex items-center gap-2 py-3 justify-center">
                                    <Loader2 size={12} className="animate-spin text-[var(--teal-500)]" />
                                    <span className="text-[9px] text-[var(--text-muted)]">Fetching translations...</span>
                                  </div>
                                ) : actDetails[key] ? (
                                  <div className="space-y-2 select-text">
                                    <div className="flex gap-1 pb-1 border-b border-[var(--border-subtle)]">
                                      {[
                                        { id: 'en', label: 'English' },
                                        { id: 'ml', label: 'മലയാളം' },
                                        { id: 'hi', label: 'हिन्दी' }
                                      ].map(lang => (
                                        <button
                                          key={lang.id}
                                          type="button"
                                          onClick={() => setActiveLangTab(lang.id)}
                                          className={`px-2 py-0.5 text-[8px] font-bold rounded cursor-pointer transition-colors ${activeLangTab === lang.id
                                            ? 'bg-[var(--teal-glow)] text-[var(--teal-500)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                          }`}
                                        >
                                          {lang.label}
                                        </button>
                                      ))}
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line max-h-32 overflow-y-auto">
                                      {actDetails[key].languages?.[activeLangTab] || 'Translation unavailable.'}
                                    </p>
                                    {actDetails[key].note && (
                                      <p className="text-[9px] text-amber-500 font-medium bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/10">
                                        ⚠️ {actDetails[key].note}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[9px] text-[var(--text-muted)] italic text-center py-2">Could not load details.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)] italic text-center py-8">No citable legal grounds fetched.</p>
                  )}
                </div>
                )}

                {/* Petition Tab */}
                {detailsTab === 'petition' && (
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1">Legal Petition</p>
                    <p className="text-[15px] font-bold text-[var(--text-primary)]">Generate a formal document</p>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    Draft a formally structured petition from this room's data for submission to authorities.
                  </p>
                  <button
                    onClick={() => { setShowDocModal(true); setGeneratedDoc(null); setDocStep(1); }}
                    className="w-full py-3 text-white text-[13px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: 'var(--teal-500)' }}
                  >
                    <FileText size={14} />
                    <span>Generate Document</span>
                  </button>
                </div>
                )}

                {/* ── Map Tab */}
                {detailsTab === 'map' && linkedPost?.location?.coordinates && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <MapPin size={12} className="text-[var(--teal-500)]" />
                      <span className="text-[12px] font-bold text-[var(--text-primary)]">Incident Location</span>
                    </div>
                    <div className="h-[calc(100vh-22rem)] min-h-48 rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
                      <MapContainer
                        center={[linkedPost.location.coordinates[1], linkedPost.location.coordinates[0]]}
                        zoom={14}
                        className="h-full w-full"
                        zoomControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[linkedPost.location.coordinates[1], linkedPost.location.coordinates[0]]} />
                      </MapContainer>
                    </div>
                  </div>
                )}

                </div>{/* end tab content */}
              </div>

              {/* RIGHT: Coordinator Chat */}
              <div className={`flex-1 lg:col-span-7 flex flex-col h-full overflow-hidden ${mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
                {/* Chat Header */}
                <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3 flex-shrink-0">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">Coordinator Chat</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[11px] text-[var(--text-muted)]">{onlineCount} online</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 px-3 py-3 overflow-y-auto bg-[var(--bg-base)] flex flex-col gap-y-1">
                  {roomDetailsLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="w-7 h-7 text-rose-400 animate-spin" />
                        <p className="text-xs text-[var(--text-muted)] font-medium">Loading chat room...</p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs text-[var(--text-muted)] italic text-center">No messages yet. Start coordinating!</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-h-0" />
                      {(() => {
                        const groupedMessages = messages.reduce((acc, m, idx) => {
                          const prev = messages[idx - 1];
                          const sameUser = prev?.senderAlias === m.senderAlias;
                          const timeDiff = prev ? (new Date(m.createdAt) - new Date(prev.createdAt)) : Infinity;
                          const sameGroup = sameUser && timeDiff < 300000; // 5 mins
                          acc.push({ ...m, sameUser, sameGroup });
                          return acc;
                        }, []);
                        return groupedMessages.map((msg) => {
                          const isMe = msg.senderAlias === userAlias;
                          return (
                            <div
                              key={msg._id}
                              className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'} ${msg.sameGroup ? 'mt-0.5' : 'mt-3.5'} ${msg.reactions && Object.keys(msg.reactions).length > 0 ? 'mb-2' : ''}`}
                            >
                              {!msg.sameGroup && (
                                <span className="text-[8px] text-[var(--text-muted)] font-semibold px-1 uppercase mb-0.5">{isMe ? 'You' : msg.senderAlias || 'Anonymous'}</span>
                              )}

                              <div className="flex flex-col gap-1 max-w-full">
                                <div className="flex items-center gap-1.5 group relative max-w-full">
                                  {/* Emoji Bar popup */}
                                  <div className={`absolute z-10 -top-8.5 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1.5 bg-white dark:bg-slate-900 backdrop-blur-md px-2.5 py-1 rounded-full shadow-md border border-[var(--border-subtle)] transition-all duration-150 ${activeMessageMenu === msg._id
                                      ? 'opacity-100 scale-100 translate-y-0'
                                      : 'opacity-0 scale-90 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:pointer-events-auto'
                                    }`}>
                                    {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
                                      <button
                                        key={emoji}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReactToMessage(msg._id, emoji);
                                          setActiveMessageMenu(null);
                                        }}
                                        className="hover:scale-125 active:scale-95 transition-transform duration-100 px-0.5 text-xs cursor-pointer bg-transparent border-0"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>

                                  {isMe && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnsendMessage(msg._id);
                                      }}
                                      className={`transition-all p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-450 hover:text-rose-500 cursor-pointer flex items-center justify-center shrink-0 ${activeMessageMenu === msg._id
                                          ? 'opacity-100 scale-100'
                                          : 'opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:pointer-events-auto'
                                        }`}
                                      title="Unsend"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}

                                  <div className="relative max-w-full">
                                    <div
                                      onClick={() => handleDoubleTap(msg._id)}
                                      className={`px-4 py-2.5 rounded-2xl text-[12px] leading-relaxed cursor-pointer select-text transition-all duration-150 shrink-0 max-w-full relative overflow-hidden ${isMe
                                          ? 'text-white rounded-tr-sm'
                                          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-tl-sm'
                                        } ${activeMessageMenu === msg._id ? 'scale-[0.99]' : ''
                                        }`}
                                      style={isMe ? { background: 'var(--teal-500)' } : {}}
                                    >
                                      {/* Heart double tap pop-up animation */}
                                      <AnimatePresence>
                                        {heartsAnimating[msg._id] && (
                                          <motion.div
                                            initial={{ scale: 0.3, opacity: 0 }}
                                            animate={{ scale: [0.3, 1.4, 1], opacity: [0, 1, 1, 0] }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.7, ease: 'easeOut' }}
                                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/5"
                                          >
                                            <span className="text-2xl filter drop-shadow-md select-none">❤️</span>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                      {msg.text}
                                    </div>

                                    {/* Reactions list */}
                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                      <div className={`absolute -bottom-2.5 ${isMe ? 'right-2' : 'left-2'} flex flex-wrap gap-0.5 z-10 select-none`}>
                                        {Object.entries(msg.reactions).map(([emoji, users]) => {
                                          if (!users || users.length === 0) return null;
                                          const hasReacted = users.includes(userAlias);
                                          return (
                                            <button
                                              key={emoji}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReactToMessage(msg._id, emoji);
                                              }}
                                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-100 cursor-pointer shadow-xs ${hasReacted
                                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 scale-105 animate-[bounce_0.2s_ease-out_1]'
                                                  : 'bg-white dark:bg-slate-855 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:scale-105'
                                                }`}
                                            >
                                              <span>{emoji}</span>
                                              <span className="text-[8px] opacity-80">{users.length}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Timestamp */}
                              {(!msg.sameGroup || activeMessageMenu === msg._id) && (
                                <span className="text-[8px] text-[var(--text-muted)] px-1 select-none font-medium mt-0.5">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send Input */}
                <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-2.5 flex-shrink-0">
                  <div className="relative flex-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-full px-4 py-2 focus-within:border-[var(--teal-500)] transition-all">
                    <input
                      type="text"
                      placeholder="Coordinate strike plans anonymously..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 bg-transparent text-[12px] outline-none border-none focus:ring-0 shadow-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={roomDetailsLoading}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                    style={{ background: 'var(--teal-500)' }}
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
              <Flame className="w-7 h-7 text-[var(--text-muted)]" />
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] text-[15px] tracking-tight">Select a Strike Room</h4>
              <p className="text-[12px] text-[var(--text-muted)] max-w-xs mt-1.5 leading-relaxed">
                Enter an active protest room to lend support and coordinate resolution demands.
              </p>
            </div>
          </div>
        )}
      </div>
      {/* ── LEGAL PETITION GENERATOR MODAL ── */}
      {showDocModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="glass-panel p-6 rounded-2xl max-w-3xl w-full space-y-4 animate-scaleIn my-8 max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl border border-emerald-500/20">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Gavel size={18} className="text-emerald-400" />
                <h3 className="font-display font-extrabold text-sm sm:text-base text-[var(--teal-500)]">
                  Prepare Legal Grievance Petition Wizard
                </h3>
              </div>
              <button onClick={resetDocState} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Wizard Steps Header (if not generated yet) */}
            {!generatedDoc && (
              <div className="flex items-center justify-center space-x-4 border-b border-gray-900 pb-3 flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wider select-none">
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
                        Select Legal Document Format
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {/* Collectorate Grievance */}
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

                    <div className="space-y-3 border-t border-gray-900 pt-4">
                      <div className="flex items-center justify-between border-b border-gray-900 pb-2">
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
                                    onChange={() => { }}
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
                                              className={`px-2 py-0.5 text-[8px] font-extrabold rounded-md cursor-pointer transition-colors ${activeLangTab === lang.id
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
                          Failed to load acts. Standard fallbacks will be included.
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-3 border-t border-gray-900">
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
                          placeholder="e.g. R. Subramanian"
                          value={repName}
                          onChange={(e) => setRepName(e.target.value)}
                          className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                          Father's / Spouse's Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. S. Ramasamy"
                          value={petitionerFatherSpouseName}
                          onChange={(e) => setPetitionerFatherSpouseName(e.target.value)}
                          className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                          Petitioner Age (Years)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 45"
                          value={petitionerAge}
                          onChange={(e) => setPetitionerAge(e.target.value)}
                          className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-emerald-500"
                          required
                          min="18"
                          max="120"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                          Petitioner Residential Address
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoFillLocation}
                          disabled={locating}
                          className="text-[9px] text-[var(--teal-500)] hover:text-[var(--teal-600)] font-bold flex items-center gap-1 bg-transparent border-0 cursor-pointer disabled:opacity-50 select-none animate-pulse"
                        >
                          {locating ? (
                            <>
                              <Loader2 size={10} className="animate-spin" />
                              <span>Detecting...</span>
                            </>
                          ) : (
                            <>
                              <span>📍 Auto-fill GPS Location</span>
                            </>
                          )}
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Door No. 42, Temple Street, Ward 5, Salem - 636001"
                        value={petitionerResidingAddress}
                        onChange={(e) => setPetitionerResidingAddress(e.target.value)}
                        className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-900">
                      <button
                        onClick={() => setDocStep(1)}
                        className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Back</span>
                      </button>

                      <button
                        onClick={() => setDocStep(3)}
                        disabled={!repName || !petitionerFatherSpouseName || !petitionerAge || !petitionerResidingAddress}
                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-emerald-950/20 cursor-pointer"
                      >
                        <span>Target Authority</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: TARGET AUTHORITY & TIMELINES */}
                {docStep === 3 && (
                  <form onSubmit={handleGenerateDocument} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                          Addressed Authority Designation
                        </label>
                        <select
                          value={addressedAuth}
                          onChange={(e) => setAddressedAuth(e.target.value)}
                          className="w-full glass-input text-xs"
                        >
                          {hierarchy && hierarchy.length > 0 ? (
                            <>
                              {hierarchy.map(level => (
                                <option key={level.level} value={level.designation}>{level.designation} ({level.department})</option>
                              ))}
                              <option value="Other">Other / Custom Authority</option>
                            </>
                          ) : (
                            <>
                              <option value="District Collector">District Collector & District Magistrate</option>
                              <option value="Municipal Corporation Commissioner">Commissioner of Municipal Corporation</option>
                              <option value="Divisional Engineer (Highways Department)">Divisional Engineer (Highways Department)</option>
                              <option value="Chief Engineer (Water Supply and Sewage Board)">Chief Engineer (Water Supply & Sewage Board)</option>
                              <option value="Superintending Engineer (Electricity Distribution)">Superintending Engineer (Electricity Distribution)</option>
                              <option value="Other">Other / Custom Authority</option>
                            </>
                          )}
                        </select>
                      </div>

                      {addressedAuth === 'Other' && (
                        <div className="animate-fadeIn">
                          <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                            Enter Custom Addressed Authority Title
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Division Forest Officer, Wildlife Division"
                            value={customAuth}
                            onChange={(e) => setCustomAuth(e.target.value)}
                            className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-emerald-500"
                            required
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Specific Action Timelines / Demands (Optional)
                      </label>
                      <textarea
                        placeholder="e.g. requesting inspection within 48 hours, completion within 7 days, or installing hazard barricades immediately..."
                        value={customDemands}
                        onChange={(e) => setCustomDemands(e.target.value)}
                        rows={3}
                        className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-900">
                      <button
                        type="button"
                        onClick={() => setDocStep(2)}
                        className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Back</span>
                      </button>

                      <button
                        type="submit"
                        disabled={generatingDoc}
                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-emerald-950/20 cursor-pointer"
                      >
                        {generatingDoc ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Drafting Legal Document...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Compile & Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* DRAFT PREVIEW AND REVIEW MODE */
              <div className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
                <div className="flex items-center justify-between bg-gray-950/50 p-2.5 rounded-lg border border-gray-900 flex-shrink-0">
                  <span className="text-[11px] text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                    <FileCheck size={14} className="text-emerald-400" />
                    State: AI Draft Completed. Verify details below.
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditingDoc(!isEditingDoc)}
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center space-x-1 cursor-pointer ${isEditingDoc
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'
                        }`}
                    >
                      <span>{isEditingDoc ? 'View Preview' : 'Edit Text'}</span>
                    </button>
                    <button
                      onClick={() => setGeneratedDoc(null)}
                      className="px-3 py-1 rounded bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Redraft
                    </button>
                  </div>
                </div>

                {/* Editor or A4 Previewer Canvas */}
                <div className="flex-1 min-h-0 overflow-y-auto border border-gray-900 rounded-xl bg-gray-950/20 p-4">
                  {isEditingDoc ? (
                    <textarea
                      value={generatedDoc}
                      onChange={(e) => setGeneratedDoc(e.target.value)}
                      className="w-full h-full min-h-[350px] bg-transparent text-[var(--text-primary)] font-mono text-xs border-0 outline-none focus:ring-0 p-0 resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="min-h-[297mm] font-serif leading-relaxed text-xs text-justify p-8 bg-white border border-gray-200 shadow-md printable-area text-gray-900 space-y-4 select-text">
                      {renderMarkdownText(generatedDoc)}
                    </div>
                  )}
                </div>

                {/* Signatures check */}
                <div className="flex items-center space-x-2 flex-shrink-0 py-1 bg-gray-950/20 px-3 rounded-lg border border-gray-900">
                  <input
                    type="checkbox"
                    id="includeSignaturesOpt"
                    checked={includeSignatures}
                    onChange={(e) => setIncludeSignatures(e.target.checked)}
                    className="rounded border border-[var(--border-default)] text-[var(--teal-500)] focus:ring-[var(--teal-500)] cursor-pointer"
                  />
                  <label htmlFor="includeSignaturesOpt" className="text-[10px] text-gray-400 font-bold uppercase cursor-pointer select-none">
                    Include physical signature sheets log in final printable package
                  </label>
                </div>

                {/* Review Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-900 flex-shrink-0">
                  <button
                    type="button"
                    onClick={resetDocState}
                    className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] text-xs font-bold border border-[var(--border-default)] flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>Copy Text</span>
                    </button>
                    <button
                      onClick={handleDownloadMarkdown}
                      className="px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] text-xs font-bold border border-[var(--border-default)] flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download MD</span>
                    </button>
                    <button
                      onClick={handlePrintDoc}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-emerald-950/20 cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>Print / Save PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
