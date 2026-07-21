import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { motion } from 'framer-motion';
import { 
  Flame, Users, ArrowRight, Shield, Bell, 
  MapPin, Loader2, Send, MessageSquare 
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [roomDetailsLoading, setRoomDetailsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForSession = async (attempts = 12, delayMs = 250) => {
    for (let i = 0; i < attempts; i += 1) {
      if (isSignedIn && !loadingProfile) return true;
      await sleep(delayMs);
    }
    return isSignedIn && !loadingProfile;
  };

  const fetchStrikeRooms = async () => {
    const ready = await waitForSession();
    if (!ready) return;

    try {
      setLoading(true);
      const res = await api.get('/rooms', { params: { type: 'strike' } });
      setRooms(res.data.rooms);
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
          const postRes = await api.get(`/posts/${activeRoom.postId}`);
          setLinkedPost(postRes.data.post);
        }
      } catch (err) {
        console.error('Failed to load strike room linked post:', err);
      } finally {
        setRoomDetailsLoading(false);
      }
    };
    loadRoomDetails();
  }, [activeRoom]);

  // Setup Socket Listeners
  useEffect(() => {
    if (!socket || !activeRoom) return;

    socket.emit('room:join', { roomId: activeRoom._id });

    socket.on('room:joined', ({ alias }) => {
      setUserAlias(alias);
    });

    socket.on('room:user_joined', ({ alias, memberCount: count }) => {
      setMemberCount(count);
    });

    // Global strike counts broadcaster
    socket.on('strike:count_update', ({ roomId, memberCount: count }) => {
      setRooms(prev => prev.map(r => r._id === roomId ? { ...r, memberCount: count } : r));
      if (activeRoom?._id === roomId) {
        setMemberCount(count);
      }
    });

    socket.on('message:new', (msg) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });

    return () => {
      socket.emit('room:leave', { roomId: activeRoom._id });
      socket.off('room:joined');
      socket.off('room:user_joined');
      socket.off('strike:count_update');
      socket.off('message:new');
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

    socket.emit('message:send', { 
      roomId: activeRoom._id, 
      text: inputText.trim() 
    });
    setInputText('');
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

  // Escalation utility helper
  const getEscalationLevel = (count) => {
    if (count >= 500) return { lvl: 4, name: 'City Commissioner Action Required', text: 'Highest Alert. Direct escalation sent to District Commissioner.' };
    if (count >= 100) return { lvl: 3, name: 'Executive Engineer Escalated', text: 'Severity High. Notification dispatched to department Chief Engineer.' };
    if (count >= 50) return { lvl: 2, name: 'District Officer Notified', text: 'Protest Active. Local field officer alerted for resolution.' };
    return { lvl: 1, name: 'Community Support Gathering', text: 'Protest Open. Building support. Need 50 members for official notification.' };
  };

  const currentEscalation = getEscalationLevel(memberCount);
  const isJoined = userProfile?.joinedRooms?.includes(activeRoom?._id);

  return (
    <div className="h-[78vh] flex flex-col lg:flex-row gap-6">
      
      {/* Sidebar - Strikes Grid List */}
      <div
        className="w-full lg:w-80 flex flex-col justify-between p-4 rounded-2xl h-[30vh] lg:h-auto overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="space-y-3 overflow-hidden flex flex-col h-full">
          <div>
            <h2 className="text-lg font-bold font-display flex items-center space-x-1.5 text-rose-400">
              <Flame size={18} className="text-rose-500 animate-pulse" />
              <span>Strike Protest Rooms</span>
            </h2>
            <p className="text-[10px] text-gray-500 mt-1">High intensity public complaints mobilized for action.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pt-2">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map(n => <div key={n} className="h-14 bg-gray-900 rounded-lg" />)}
              </div>
            ) : rooms.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4 text-center">No active community strike rooms found.</p>
            ) : (
              rooms.map((room) => (
                <button
                  key={room._id}
                  onClick={() => setActiveRoom(room)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex items-center justify-between group ${
                    activeRoom?._id === room._id
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-gray-950/20 border-transparent text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                  }`}
                >
                  <div className="truncate pr-2 space-y-0.5">
                    <span className="font-bold block truncate">{room.name}</span>
                    {room.district && (
                      <span className="text-[9px] text-gray-600 font-semibold uppercase">{room.district}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-rose-400 bg-rose-950/40 px-2 py-0.5 border border-rose-900/30 rounded font-bold">
                    <Users size={10} />
                    <span>{room.memberCount || 0}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Strike Canvas details */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col justify-between h-[45vh] lg:h-auto overflow-hidden border border-gray-900">
        {activeRoom ? (
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            {/* Top Bar Details */}
            <div className="p-4 border-b border-gray-900 bg-gray-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="font-display font-extrabold text-rose-400 text-sm sm:text-base">{activeRoom.name}</h3>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-950/40 text-rose-300 border border-rose-900/20">
                    Protest Strike
                  </span>
                </div>
                {linkedPost && (
                  <p className="text-[10px] text-gray-400 truncate max-w-sm sm:max-w-md">{linkedPost.description}</p>
                )}
              </div>

              <div className="flex items-center space-x-2.5">
                {isJoined ? (
                  <button
                    onClick={handleLeaveStrike}
                    className="px-3 py-1.5 rounded bg-gray-900 hover:bg-gray-850 text-gray-400 text-[10px] uppercase font-bold border border-gray-800"
                  >
                    Withdraw Support
                  </button>
                ) : (
                  <button
                    onClick={handleJoinStrike}
                    className="px-3.5 py-1.5 rounded bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-gray-900 font-extrabold text-[10px] uppercase tracking-wider shadow-lg shadow-rose-500/15"
                  >
                    Lend support
                  </button>
                )}
              </div>
            </div>

            {/* Content area: Split Grid between Info details / Chat */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-gray-950/15">
              
              {/* Left pane: Escalation and Maps */}
              <div className="p-4 border-b md:border-b-0 md:border-r border-gray-900 overflow-y-auto space-y-4">
                {/* Escalation bar */}
                <div className="p-4 rounded-xl border border-rose-900/25 bg-rose-950/5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-semibold">Live Escalation State</span>
                    <span className="text-rose-400 font-bold uppercase">{currentEscalation.name}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-850">
                    <div 
                      className="bg-gradient-to-r from-rose-500 to-orange-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (memberCount / 500) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-start space-x-2 text-[10px] text-gray-500 leading-normal">
                    <Bell size={12} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <p>{currentEscalation.text}</p>
                  </div>
                </div>

                {/* Map pinning */}
                {linkedPost?.location?.coordinates && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider flex items-center space-x-1">
                      <MapPin size={12} />
                      <span>Incident Location Map</span>
                    </div>
                    <div className="h-40 rounded-xl overflow-hidden border border-gray-900">
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

              {/* Right pane: Chat coordination */}
              <div className="flex flex-col justify-between overflow-hidden">
                {/* Message Log */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-gray-950/30">
                  <div className="text-[9px] text-gray-500 text-center uppercase font-bold tracking-widest pb-2 border-b border-gray-900/60">Protest Coordinator Chat</div>
                  {roomDetailsLoading ? (
                    <div className="h-full min-h-[220px] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                          Loading chat room...
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderAlias === userAlias;
                      return (
                        <div
                          key={msg._id}
                          className={`flex flex-col max-w-[80%] space-y-0.5 ${isMe ? 'ml-auto items-end' : 'items-start'}`}
                        >
                          <span className="text-[8px] text-gray-650 font-semibold">{msg.senderAlias || 'Anonymous'}</span>
                          <div className={`p-2.5 rounded-lg text-xs leading-normal ${
                            isMe
                              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-tr-none'
                              : 'bg-gray-900 text-gray-300 border border-gray-850 rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send chat block */}
                <form onSubmit={handleSendMessage} className="p-2 border-t border-gray-900 bg-gray-950/20 flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Coordinate strike plans anonymously..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 p-2 text-xs rounded-lg glass-input focus:ring-1 focus:ring-rose-500"
                  />
                  <button
                    type="submit"
                    disabled={roomDetailsLoading}
                    className="p-2 bg-rose-500 text-gray-900 rounded-lg hover:bg-rose-400"
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8 text-center text-gray-500">
            <Flame className="w-12 h-12 text-gray-800 animate-pulse" />
            <div>
              <h4 className="font-bold text-gray-400 font-display text-sm">Select Strike Room</h4>
              <p className="text-xs text-gray-650 max-w-xs mt-1">
                Enter an active protest room to lend digital support signatures and coordinate resolution demands.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
