import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { motion } from 'framer-motion';
import { 
  Flame, Users, ArrowRight, Shield, Bell, 
  MapPin, Loader2, Send, MessageSquare,
  FileText, Printer, Download, Copy, Eye, Sparkles, X,
  Scale, FileCheck, Check, ChevronLeft, ChevronRight, Gavel, Briefcase
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
  const { isSignedIn, loadingProfile, socket, userProfile, fetchProfile } = useCivic();
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

  const messagesEndRef = useRef(null);

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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeRoom) return;
    if (!socket.connected) {
      toast.error('Chat is reconnecting. Try again in a moment.');
      return;
    }

    socket.timeout(8000).emit('message:send', {
      roomId: activeRoom._id,
      text: inputText.trim(),
    }, (err, response) => {
      if (err) {
        toast.error('Message send timed out. Please retry.');
        return;
      }

      if (!response?.ok) {
        toast.error(response?.error || 'Message could not be sent.');
        return;
      }

      setInputText('');
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
    <div className="h-[78vh] flex flex-col lg:flex-row gap-4">

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ SIDEBAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="w-full lg:w-72 flex flex-col glass-panel rounded-2xl h-[28vh] lg:h-auto overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
          <h2 className="text-sm font-bold font-display flex items-center gap-2 text-rose-600">
            <Flame size={16} className="text-rose-500 animate-pulse" />
            Strike Protest Rooms
          </h2>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">High intensity complaints mobilized for action.</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {loading ? (
            <div className="space-y-1.5 animate-pulse px-1">
              {[1, 2, 3].map(n => <div key={n} className="h-14 skeleton rounded-lg" />)}
            </div>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic py-6 text-center">No active community strike rooms found.</p>
          ) : (
            rooms.map((room) => (
              <button
                key={room._id}
                onClick={() => setActiveRoom(room)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                  activeRoom?._id === room._id
                    ? 'bg-rose-50 border-rose-300 shadow-sm'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-rose-200 hover:bg-rose-50/50'
                }`}
              >
                <div className="truncate pr-2 space-y-0.5 min-w-0">
                  <span className={`font-semibold block truncate ${
                    activeRoom?._id === room._id ? 'text-rose-700' : 'text-[var(--text-primary)]'
                  }`}>{room.name}</span>
                  {room.district && (
                    <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider">{room.district}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 text-[10px] text-rose-600 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-md font-bold">
                  <Users size={9} />
                  <span>{room.memberCount || 0}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ MAIN CANVAS Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col h-[50vh] lg:h-auto overflow-hidden">
        {activeRoom ? (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Top Bar */}
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0">
                  <Flame size={15} className="text-rose-500" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-[var(--text-primary)] text-sm truncate">{activeRoom.name}</h3>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 border border-rose-200 font-bold">
                    Protest Strike
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {canDeleteRoom && (
                  <button
                    onClick={handleDeleteStrikeRoom}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600 text-[10px] uppercase font-bold border border-[var(--border-default)] hover:border-red-200 transition-all"
                  >
                    Disband Protest
                  </button>
                )}
                {isJoined ? (
                  <button
                    onClick={handleLeaveStrike}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-gray-100 text-[var(--text-secondary)] text-[10px] uppercase font-bold border border-[var(--border-default)] transition-all"
                  >
                    Withdraw Support
                  </button>
                ) : (
                  <button
                    onClick={handleJoinStrike}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-md shadow-rose-200 transition-all"
                  >
                    🔥 Lend Support
                  </button>
                )}
              </div>
            </div>

            {/* Content Grid: Info + Chat */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-[var(--bg-base)]">

              {/* LEFT: Escalation + Legal + Map */}
              <div className="p-4 border-b md:border-b-0 md:border-r border-[var(--border-subtle)] overflow-y-auto space-y-3">

                {/* Escalation Card */}
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Live Escalation State</span>
                    <span className="text-[10px] text-rose-600 font-extrabold uppercase bg-white border border-rose-200 px-2 py-0.5 rounded">
                      {currentEscalation.name}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-rose-100 h-2 rounded-full overflow-hidden border border-rose-200">
                    <div
                      className="bg-gradient-to-r from-rose-500 to-orange-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (memberCount / 500) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-start gap-2 text-[10px] text-rose-700 leading-normal">
                    <Bell size={11} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <p>{currentEscalation.text}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-rose-600 font-bold">
                      <Users size={11} />
                      <span>{memberCount} citizens supporting</span>
                    </div>
                  </div>
                </div>

                {/* Responsible Authority Hierarchy Card */}
                <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <Users size={13} className="text-emerald-600" />
                      </div>
                      <span className="text-xs font-bold text-[var(--text-primary)]">Officials Hierarchy</span>
                    </div>
                    <span className="text-[8px] uppercase font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                      Line of Command
                    </span>
                  </div>

                  {loadingHierarchy ? (
                    <div className="flex flex-col items-center py-6 space-y-2">
                      <Loader2 size={16} className="animate-spin text-[var(--teal-500)]" />
                      <span className="text-[9px] text-[var(--text-muted)]">Resolving local authorities...</span>
                    </div>
                  ) : hierarchy && hierarchy.length > 0 ? (
                    <div className="relative pl-3 space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-emerald-500/20 before:via-teal-500/30 before:to-emerald-500/10">
                      {hierarchy.map((level, idx) => (
                        <div key={level.level} className="relative pl-5 group">
                          {/* Connector Dot */}
                          <div className="absolute left-[-21px] top-1 w-4.5 h-4.5 rounded-full bg-[var(--bg-surface)] border-2 border-emerald-500 flex items-center justify-center text-[8px] font-black text-emerald-400 group-hover:scale-110 transition-transform shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                            {idx + 1}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between flex-wrap gap-x-2">
                              <span className="text-[10px] font-extrabold text-[var(--text-primary)] tracking-wide group-hover:text-emerald-400 transition-colors">
                                {level.designation}
                              </span>
                              <span className="text-[8px] uppercase font-bold tracking-wider text-rose-400/80 bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10">
                                {level.timeframe}
                              </span>
                            </div>
                            
                            <p className="text-[8.5px] text-emerald-500 font-bold uppercase tracking-wider">
                              {level.department}
                            </p>
                            <p className="text-[9px] text-[var(--text-muted)] leading-relaxed italic">
                              "{level.role}"
                            </p>

                            {level.contact ? (
                              <div className="mt-1.5 p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1.5 text-[8.5px] group-hover:border-emerald-500/30 transition-colors">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-[var(--text-secondary)]">
                                    👤 {level.contact.officerName || 'Designated Official'}
                                  </span>
                                  <span className="text-[7.5px] font-bold uppercase text-[var(--teal-500)]">Active</span>
                                </div>
                                
                                {level.contact.phone && level.contact.phone.length > 0 && (
                                  <div className="text-[8px] text-[var(--text-muted)] font-mono">
                                    📞 {level.contact.phone.join(', ')}
                                  </div>
                                )}
                                {level.contact.email && (
                                  <div className="text-[8px] text-[var(--text-muted)] font-mono truncate">
                                    ✉️ {level.contact.email}
                                  </div>
                                )}
                                
                                <button
                                  onClick={() => {
                                    setAddressedAuth(level.designation);
                                    setShowDocModal(true);
                                    setDocStep(2);
                                  }}
                                  className="mt-1 w-full py-1 text-center bg-emerald-500/10 hover:bg-emerald-500 hover:text-gray-950 text-emerald-400 font-extrabold text-[8px] uppercase tracking-wider rounded border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer"
                                >
                                  Address Petition Here
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAddressedAuth(level.designation);
                                  setShowDocModal(true);
                                  setDocStep(2);
                                }}
                                className="mt-1 py-0.5 px-2 bg-[var(--bg-elevated)] hover:bg-emerald-500/20 text-[var(--text-secondary)] hover:text-emerald-400 font-bold text-[8px] uppercase tracking-wider rounded border border-[var(--border-default)] hover:border-emerald-500/30 transition-all cursor-pointer"
                              >
                                Address Petition here
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-[var(--text-muted)] italic text-center py-2">
                      Resolving local governance structure...
                    </p>
                  )}
                </div>

                {/* Relevant Legal Grounds Card */}
                <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                        <Scale size={13} className="text-teal-600 animate-pulse" />
                      </div>
                      <span className="text-xs font-bold text-[var(--text-primary)]">Statutory & Legal Grounds</span>
                    </div>
                    <span className="text-[8px] uppercase font-extrabold tracking-wider bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20">
                      Grievance Basis
                    </span>
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
                            className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--teal-500)]/30 transition-all space-y-2 cursor-pointer group"
                            onClick={() => toggleActExpand(act)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 border rounded uppercase ${badgeStyle} shrink-0`}>
                                  {badgeText}
                                </span>
                                <span className="text-[9px] font-bold text-[var(--text-primary)] truncate">
                                  {act.section}
                                </span>
                              </div>
                              <span className="text-[8px] text-[var(--text-muted)] group-hover:text-[var(--teal-500)] font-semibold transition-colors shrink-0">
                                {isExpanded ? 'Hide' : 'Expand'}
                              </span>
                            </div>
                            
                            <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">
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

                                    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] font-normal whitespace-pre-line max-h-36 overflow-y-auto pr-1 bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-subtle)]">
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
                    <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] italic select-none text-center">
                      No citable legal grounds fetched.
                    </div>
                  )}
                </div>

                {/* Legal Petitions Card */}
                <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                      <Shield size={13} className="text-teal-600" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">Legal Petitions & Complaints</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                    Draft a formal, legally structured representation from this strike room's data. Volunteers can print the generated document and take it directly to authorities.
                  </p>
                  <button
                    onClick={() => { setShowDocModal(true); setGeneratedDoc(null); setDocStep(1); }}
                    className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={12} />
                    <span>Generate Legal Document</span>
                  </button>
                </div>

                {/* Map */}
                {linkedPost?.location?.coordinates && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <MapPin size={11} className="text-[var(--teal-500)]" />
                      <span>Incident Location Map</span>
                    </div>
                    <div className="h-40 rounded-xl overflow-hidden border border-[var(--border-default)] shadow-sm">
                      <MapContainer
                        center={[linkedPost.location.coordinates[1], linkedPost.location.coordinates[0]]}
                        zoom={13}
                        className="h-full w-full"
                        zoomControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[linkedPost.location.coordinates[1], linkedPost.location.coordinates[0]]} />
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Coordinator Chat */}
              <div className="flex flex-col overflow-hidden">
                {/* Chat Header */}
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center gap-2 flex-shrink-0">
                  <MessageSquare size={13} className="text-rose-500" />
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Protest Coordinator Chat</span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-[var(--text-muted)]">{onlineCount} online</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 px-3 py-3 overflow-y-auto space-y-3 bg-[var(--bg-base)]">
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
                    messages.map((msg) => {
                      const isMe = msg.senderAlias === userAlias;
                      return (
                        <div
                          key={msg._id}
                          className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <span className="text-[8px] text-[var(--text-muted)] font-semibold px-1 uppercase">{msg.senderAlias || 'Anonymous'}</span>
                          <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed max-w-[80%] ${
                            isMe
                              ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-tr-sm'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-tl-sm'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send Input */}
                <form onSubmit={handleSendMessage} className="px-3 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Coordinate strike plans anonymously..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 glass-input text-xs py-2"
                  />
                  <button
                    type="submit"
                    disabled={roomDetailsLoading}
                    className="w-9 h-9 flex items-center justify-center bg-rose-500 text-white rounded-lg hover:bg-rose-400 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
              <Flame className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <h4 className="font-bold text-[var(--text-primary)] font-display text-sm">Select a Strike Room</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1.5 leading-relaxed">
                Enter an active protest room to lend digital support signatures and coordinate resolution demands.
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
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center space-x-1 cursor-pointer ${
                        isEditingDoc
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
