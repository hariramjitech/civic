import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { 
  Flame, Users, ArrowRight, Shield, Bell, 
  MapPin, Loader2, Send, MessageSquare,
  FileText, Printer, Download, Copy, Eye, Sparkles, X
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
  const [destinationType, setDestinationType] = useState('municipal');
  const [petitionerFatherSpouseName, setPetitionerFatherSpouseName] = useState('');
  const [petitionerAge, setPetitionerAge] = useState('');
  const [petitionerResidingAddress, setPetitionerResidingAddress] = useState('');
  const [statutoryAct, setStatutoryAct] = useState('district_municipalities');

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
      return;
    }

    const loadRoomDetails = async () => {
      try {
        setRoomDetailsLoading(true);
        const res = await api.get(`/rooms/${activeRoom._id}`);
        setMessages(res.data.messages || []);
        setMemberCount(res.data.room.memberCount || 0);

        if (activeRoom.postId) {
          try {
            const postRes = await api.get(`/posts/${activeRoom.postId}`);
            setLinkedPost(postRes.data.post);
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
        destinationType,
        petitionerFatherSpouseName,
        petitionerAge,
        petitionerResidingAddress,
        statutoryAct
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
      .replace(/###\s+(.+)/g, '<h3 style="font-family: Arial, sans-serif; font-size: 15px; margin-top: 15px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">$1</h3>')
      .replace(/##\s+(.+)/g, '<h2 style="font-family: Arial, sans-serif; font-size: 17px; margin-top: 20px; border-bottom: 1.5px solid #bbb; padding-bottom: 6px;">$1</h2>')
      .replace(/#\s+(.+)/g, '<h1 style="text-align: center; text-transform: uppercase; font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px;">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/-\s+(.+)/g, '<li style="margin-bottom: 6px; font-size: 13.5px;">$1</li>')
      .replace(/\n\n/g, '<p style="font-size: 13.5px; text-align: justify; line-height: 1.6; margin-bottom: 15px;"></p>');

    const petitionHtml = `
      <html>
        <head>
          <title>Grievance Petition - ${linkedPost.title}</title>
          <style>
            @media print {
              body {
                padding: 10px;
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
              font-size: 14px;
            }
            .official-contacts {
              margin-top: 30px;
              padding: 15px;
              border: 1px solid #ccc;
              background-color: #f9f9f9;
              border-radius: 5px;
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
              font-size: 12px;
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
            <h3 style="font-family: Arial, sans-serif; font-size: 14px; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #aaa; padding-bottom: 3px;">
              OFFICIAL DEPT CONTACT DETAILS (FOR SUBMISSION REFERENCE)
            </h3>
            ${contactsText}
          </div>

          ${includeSignatures ? `
            <div class="page-break"></div>
            <h1 style="text-align: center; font-family: Arial, sans-serif; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
              Supporting Citizens & Local Residents Endorsement Signatures Log
            </h1>
            <p style="font-size: 11.5px; margin-bottom: 15px; text-align: justify; line-height: 1.4;">
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
            <p style="font-size: 10px; color: #555; text-align: right; margin-top: 10px;">
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
    setAddressedAuth('District Collector');
    setCustomAuth('');
    setCustomDemands('');
    setGeneratedDoc(null);
    setIsEditingDoc(false);
    setDestinationType('municipal');
    setPetitionerFatherSpouseName('');
    setPetitionerAge('');
    setPetitionerResidingAddress('');
    setStatutoryAct('district_municipalities');
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
                    onClick={() => { setShowDocModal(true); setGeneratedDoc(null); }}
                    className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
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
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="glass-panel p-6 rounded-2xl max-w-3xl w-full space-y-4 animate-scaleIn my-8 max-h-[90vh] overflow-y-auto flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 flex-shrink-0">
              <h3 className="font-display font-extrabold text-[var(--teal-500)] text-sm sm:text-base flex items-center gap-2">
                <Shield size={18} className="text-[var(--teal-500)]" />
                <span>Prepare Legal Grievance Petition</span>
              </h3>
              <button onClick={resetDocState} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            {!generatedDoc ? (
              /* SETUP FORM FORM */
              <form onSubmit={handleGenerateDocument} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed info-row">
                  Fill out the parameters below to draft an official, ready-to-submit representation. The platform will compile details of <strong>{linkedPost?.title}</strong>,
                  including coordinates, active supporting citizens ({memberCount}), and mapped department officials, to construct a highly professional document.
                </p>

                {/* Section 1: Submission & Destination */}
                <div className="space-y-3">
                  <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center space-x-1.5 border-b border-gray-900 pb-1.5">
                    <span>1. Grievance Submission Destination</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Grievance Destination / Purpose
                      </label>
                      <select
                        value={destinationType}
                        onChange={(e) => setDestinationType(e.target.value)}
                        className="w-full glass-input text-xs"
                      >
                        <option value="municipal">Municipal/Administrative Office (Official Letter Complaint)</option>
                        <option value="court">Madras High Court / District Court (PIL Writ Petition)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Addressed Authority Designation
                      </label>
                      <select
                        value={addressedAuth}
                        onChange={(e) => setAddressedAuth(e.target.value)}
                        className="w-full glass-input text-xs"
                      >
                        <option value="District Collector">District Collector & District Magistrate</option>
                        <option value="Municipal Corporation Commissioner">Commissioner of Municipal Corporation</option>
                        <option value="Divisional Engineer (Highways Department)">Divisional Engineer (Highways Department)</option>
                        <option value="Chief Engineer (Water Supply and Sewage Board)">Chief Engineer (Water Supply & Sewage Board)</option>
                        <option value="Superintending Engineer (Electricity Distribution)">Superintending Engineer (Electricity Distribution)</option>
                        <option value="Regional Transport Officer">Regional Transport Officer (RTO)</option>
                        <option value="Other">Other / Custom Authority</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Petitioner Credentials */}
                <div className="space-y-3 border-t border-gray-900 pt-3">
                  <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center space-x-1.5 border-b border-gray-900 pb-1.5">
                    <span>2. Lead Petitioner Legal Credentials</span>
                  </h4>
                  <p className="text-[9px] text-[var(--text-muted)] italic mt-0.5 leading-normal">
                    * Formal legal petitions require verification of name, age, parentage, and residency to register officially in municipal databases and court registries.
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                          Complete Residential Address
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

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 font-bold">
                        Applicable TN Statutory Act
                      </label>
                      <select
                        value={statutoryAct}
                        onChange={(e) => setStatutoryAct(e.target.value)}
                        className="w-full glass-input text-xs"
                      >
                        <option value="district_municipalities">TN District Municipalities Act, 1920 (Ward roads/Drains)</option>
                        <option value="chennai_corporation">Chennai City Municipal Corp. Act, 1919 (Chennai boundaries)</option>
                        <option value="highways">Tamil Nadu Highways Act, 2001 (Highways/Bypasses)</option>
                        <option value="water_drainage">TN Water Supply & Drainage Board Act, 1970 (Water/Sewage)</option>
                        <option value="public_nuisance">Section 133 of CrPC / 152 of BNSS (Public Nuisance Order)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Additional Demands */}
                <div className="space-y-3 border-t border-gray-900 pt-3">
                  <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center space-x-1.5 border-b border-gray-900 pb-1.5">
                    <span>3. Additional Demands & Custom Instructions</span>
                  </h4>
                  
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
                </div>

                {/* Submit Action */}
                <div className="flex justify-end space-x-2.5 pt-2 border-t border-gray-900 flex-shrink-0">
                  <button
                    type="button"
                    onClick={resetDocState}
                    className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingDoc}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-emerald-950/20"
                  >
                    {generatingDoc ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Drafting Representation...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Generate Legal Petition</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* DRAFT PREVIEW AND REVIEW MODE */
              <div className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
                <div className="flex items-center justify-between bg-gray-950/50 p-2.5 rounded-lg border border-gray-900 flex-shrink-0">
                  <span className="text-[11px] text-[var(--text-secondary)] font-semibold">
                    State: AI Draft Completed. Verify and edit details below.
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditingDoc(!isEditingDoc)}
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center space-x-1 ${
                        isEditingDoc
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'
                      }`}
                    >
                      <span>{isEditingDoc ? 'View Preview' : 'Edit Text'}</span>
                    </button>
                    <button
                      onClick={() => setGeneratedDoc(null)}
                      className="px-3 py-1 rounded bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[10px] font-bold uppercase"
                    >
                      Redraft
                    </button>
                  </div>
                </div>

                {/* Editor or Previewer Canvas */}
                <div className="flex-1 min-h-0 overflow-y-auto border border-gray-900 rounded-xl bg-gray-950/20 p-4">
                  {isEditingDoc ? (
                    <textarea
                      value={generatedDoc}
                      onChange={(e) => setGeneratedDoc(e.target.value)}
                      className="w-full h-full min-h-[300px] bg-transparent text-[var(--text-primary)] font-mono text-xs border-0 outline-none focus:ring-0 p-0 resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-3 font-serif selection:bg-emerald-950 selection:text-emerald-300">
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
                    className="rounded border border-[var(--border-default)] text-[var(--teal-500)] focus:ring-[var(--teal-500)]"
                  />
                  <label htmlFor="includeSignaturesOpt" className="text-[10px] text-gray-450 font-bold uppercase cursor-pointer selection:none">
                    Include physical signature sheets log in final printable package
                  </label>
                </div>

                {/* Review Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-900 flex-shrink-0">
                  <button
                    type="button"
                    onClick={resetDocState}
                    className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold"
                  >
                    Close
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] text-xs font-bold border border-[var(--border-default)] flex items-center space-x-1.5 transition-all"
                    >
                      <Copy size={13} />
                      <span>Copy Text</span>
                    </button>
                    <button
                      onClick={handleDownloadMarkdown}
                      className="px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] text-xs font-bold border border-[var(--border-default)] flex items-center space-x-1.5 transition-all"
                    >
                      <Download size={13} />
                      <span>Download MD</span>
                    </button>
                    <button
                      onClick={handlePrintDoc}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-emerald-950/20"
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
