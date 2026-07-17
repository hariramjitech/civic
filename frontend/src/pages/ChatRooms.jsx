import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { 
  MessageSquare, Users, Send, Radio, Plus, Search, 
  X, Loader2, Sparkles, Shield, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Helper to generate initials & gradient color scheme based on user alias hash
const getAvatarProps = (alias) => {
  if (!alias) return { char: 'A', bg: 'from-slate-400 to-slate-500', text: 'text-white' };
  
  const cleanAlias = alias.replace('Citizen ', '');
  let char = 'C';
  if (cleanAlias.startsWith('#') && cleanAlias.length > 1) {
    char = cleanAlias[1].toUpperCase();
  } else if (cleanAlias.length > 0) {
    char = cleanAlias[0].toUpperCase();
  }
  
  // Simple hash function for alias
  let hash = 0;
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const gradients = [
    'from-teal-400 to-emerald-600',
    'from-blue-400 to-indigo-600',
    'from-purple-400 to-pink-600',
    'from-pink-400 to-rose-600',
    'from-amber-400 to-orange-600',
    'from-emerald-400 to-cyan-600',
  ];
  
  const gradient = gradients[Math.abs(hash) % gradients.length];
  return { char, bg: gradient, text: 'text-white' };
};

export default function ChatRooms() {
  const { isSignedIn, loadingProfile, socket } = useCivic();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Filters
  const [districtFilter, setDistrictFilter] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  // Create Room modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomForm, setNewRoomForm] = useState({
    name: '',
    description: '',
    district: '',
    category: 'other'
  });
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Real-time Chat States
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [userAlias, setUserAlias] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const districts = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
    'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur'
  ];

  const fetchRooms = async (attempt = 0) => {
    if (!isSignedIn) return false;

    try {
      const params = { type: 'discussion' };
      if (districtFilter) params.district = districtFilter;
      const res = await api.get('/rooms', { params });
      setRooms(res.data.rooms || []);
      return true;
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 && attempt < 5) {
        await sleep(400);
        return fetchRooms(attempt + 1);
      }
      if (err.response?.status !== 401) {
        toast.error('Failed to load chat channels.');
      }
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isSignedIn) {
        setLoadingRooms(false);
        return;
      }

      setLoadingRooms(true);
      const ok = await fetchRooms();
      if (!cancelled) {
        setLoadingRooms(false);
      }
      return ok;
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [districtFilter, isSignedIn, loadingProfile]);

  // Handle Socket Events for Active Room
  useEffect(() => {
    if (!socket || !activeRoom) return;

    const joinRoom = () => {
      socket.emit('room:join', { roomId: activeRoom._id });
    };

    // Load recent messages
    const fetchRecentMessages = async () => {
      try {
        const res = await api.get(`/rooms/${activeRoom._id}`);
        setMessages(res.data.messages || []);
        setMemberCount(res.data.room.memberCount || 0);
        setOnlineCount(1);
      } catch (err) {
        console.error(err);
      }
    };
    fetchRecentMessages();

    const handleRoomJoined = ({ roomId, alias, memberCount: count, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      setUserAlias(alias);
      if (typeof count === 'number') {
        setMemberCount(count);
      }
      if (typeof activeCount === 'number') {
        setOnlineCount(activeCount);
      }
      console.log('Joined room. Assigned alias:', alias);
    };

    const handleUserJoined = ({ roomId, memberCount: count, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (typeof count === 'number') setMemberCount(count);
      if (typeof activeCount === 'number') setOnlineCount(activeCount);
    };

    const handleUserLeft = ({ roomId, memberCount: count, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (typeof count === 'number') setMemberCount(count);
      if (typeof activeCount === 'number') setOnlineCount(activeCount);
    };

    const handleNewMessage = (msg) => {
      if (msg.roomId && msg.roomId !== activeRoom._id) return;
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    };

    const handleTyping = ({ roomId, alias }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (alias) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(alias);
          return next;
        });
      }
    };

    const handleStopTyping = ({ roomId, alias }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (alias) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(alias);
          return next;
        });
      }
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
      toast.error(message || 'Could not join chat room.');
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('room:user_joined', handleUserJoined);
    socket.on('room:user_left', handleUserLeft);
    socket.on('message:new', handleNewMessage);
    socket.on('message:typing', handleTyping);
    socket.on('message:stop_typing', handleStopTyping);
    socket.on('message:rejected', handleRejected);
    socket.on('message:flagged', handleMessageFlagged);
    socket.on('message:error', handleMessageError);
    socket.on('room:error', handleRoomError);

    // Join immediately if possible, otherwise wait for the socket to connect.
    if (socket.connected) {
      joinRoom();
    } else {
      socket.on('connect', joinRoom);
    }

    return () => {
      // Cleanup on active room change
      socket.off('connect', joinRoom);
      socket.emit('room:leave', { roomId: activeRoom._id });
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:user_joined', handleUserJoined);
      socket.off('room:user_left', handleUserLeft);
      socket.off('message:new', handleNewMessage);
      socket.off('message:typing', handleTyping);
      socket.off('message:stop_typing', handleStopTyping);
      socket.off('message:rejected', handleRejected);
      socket.off('message:flagged', handleMessageFlagged);
      socket.off('message:error', handleMessageError);
      socket.off('room:error', handleRoomError);
      setMessages([]);
      setTypingUsers(new Set());
    };
  }, [activeRoom, socket]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat message typing indicators
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeRoom) return;

    // Send typing notification
    socket.emit('message:typing', { roomId: activeRoom._id });

    // Clear timeout and set new stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('message:stop_typing', { roomId: activeRoom._id });
    }, 2000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeRoom) return;
    if (!socket.connected) {
      toast.error('Chat is reconnecting. Try again in a moment.');
      return;
    }

    // Send stop typing
    socket.emit('message:stop_typing', { roomId: activeRoom._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

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

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomForm.name.trim()) return;

    try {
      setCreatingRoom(true);
      const res = await api.post('/rooms', {
        name: newRoomForm.name.trim(),
        description: newRoomForm.description.trim(),
        district: newRoomForm.district || undefined,
        category: newRoomForm.category,
        type: 'discussion'
      });

      toast.success('Chat channel created successfully!');
      setShowCreateModal(false);
      setNewRoomForm({ name: '', description: '', district: '', category: 'other' });
      fetchRooms();
      setActiveRoom(res.data.room);
    } catch (err) {
      toast.error('Failed to create channel.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleLeaveCurrentRoom = async () => {
    if (!activeRoom) return;
    try {
      // Call REST api leave route for persistent sync
      await api.post(`/rooms/${activeRoom._id}/leave`);
      setActiveRoom(null);
      toast.success('Left room. Chat messages deleted from server.');
      fetchRooms();
    } catch (err) {
      setActiveRoom(null);
    }
  };

  // Filter channels list
  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(roomSearch.toLowerCase()))
  );

  return (
    <div className="h-[78vh] flex flex-col lg:flex-row gap-4 relative font-sans">
      {/* Sidebar - Channels list */}
      <div className="w-full lg:w-76 flex flex-col glass-panel rounded-2xl h-[28vh] lg:h-auto overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-translucent)] shadow-md">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <h2 className="text-sm font-extrabold font-display flex items-center gap-2 text-[var(--text-primary)]">
              <MessageSquare size={16} className="text-[var(--teal-500)]" />
              Discussion Channels
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--teal-500)] transition-colors border border-[var(--border-subtle)] shadow-3xs"
              title="Create new channel"
            >
              <Plus size={14} />
            </motion.button>
          </div>

          {/* Search/Filter Controls */}
          <div className="px-3.5 py-3 space-y-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
              <input
                type="text"
                placeholder="Search channels..."
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 text-xs rounded-lg glass-input border border-[var(--border-subtle)] focus:border-[var(--teal-500)] focus:ring-1 focus:ring-[var(--teal-500)] transition-all bg-[var(--bg-surface)]"
              />
            </div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full glass-input text-xs py-2 px-3 border border-[var(--border-subtle)] focus:border-[var(--teal-500)] transition-all rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium cursor-pointer"
            >
              <option value="">All Regions / Districts</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto px-2 py-3.5 space-y-1.5 scrollbar-thin">
            {loadingRooms ? (
              <div className="space-y-2 px-1">
                {[1, 2, 3].map(n => <div key={n} className="h-12 skeleton rounded-lg animate-pulse" />)}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Compass size={24} className="text-[var(--text-muted)] mb-2" />
                <p className="text-xs text-[var(--text-muted)] italic">No channels found</p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isActive = activeRoom?._id === room._id;
                return (
                  <button
                    key={room._id}
                    onClick={() => setActiveRoom(room)}
                    className={`channel-item flex items-center justify-between p-3 rounded-xl border text-left w-full transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? 'border-[rgba(13,148,136,0.35)] bg-[rgba(13,148,136,0.08)] shadow-2xs font-semibold' 
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--teal-500)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="truncate pr-2 space-y-0.5 min-w-0 flex-1">
                      <span className={`block truncate text-xs ${isActive ? 'text-[var(--teal-600)] font-bold' : 'text-[var(--text-primary)]'}`}>
                        {room.name}
                      </span>
                      {room.district && (
                        <span className="text-[9px] text-[var(--teal-500)] font-extrabold uppercase tracking-wider block">
                          {room.district}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] text-[var(--text-muted)] bg-[var(--bg-overlay)] px-2 py-1 rounded-md border border-[var(--border-subtle)]">
                      <Users size={10} className="text-[var(--text-secondary)]" />
                      <span className="font-semibold text-[var(--text-secondary)]">{room.memberCount || 0}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas - Chat Panel */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col h-[50vh] lg:h-auto overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md">
        {activeRoom ? (
          <>
            {/* Chat Room Top Bar Header */}
            <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)] shadow-3xs">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-extrabold text-[var(--text-primary)] text-sm md:text-base truncate">
                    {activeRoom.name}
                  </h3>
                  {activeRoom.district && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--bg-overlay)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shrink-0 select-none">
                      {activeRoom.district}
                    </span>
                  )}
                  
                  {/* Pulse indicator for online counts */}
                  <div className="flex items-center gap-1.5 ml-auto bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/10 px-2.5 py-1 rounded-full shrink-0 select-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                    <span className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-wider">
                      {onlineCount} online
                    </span>
                  </div>
                </div>
                {activeRoom.description && (
                  <p className="text-[10px] text-[var(--text-secondary)] truncate max-w-lg">
                    {activeRoom.description}
                  </p>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleLeaveCurrentRoom}
                className="ml-3 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] uppercase font-extrabold border border-rose-100 transition-all shrink-0 cursor-pointer shadow-3xs"
              >
                Leave Chat
              </motion.button>
            </div>

            {/* Message Feed Area */}
            <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4 bg-[var(--bg-base)]">
              {/* Ephemeral Warning */}
              <div className="p-3.5 bg-teal-50/75 dark:bg-[var(--teal-glow)] border border-teal-500/20 rounded-2xl text-center space-y-1.5 max-w-lg mx-auto shadow-4xs">
                <span className="text-[10px] text-[var(--teal-600)] uppercase font-extrabold tracking-widest flex items-center justify-center gap-1.5">
                  <Shield size={11} className="text-[var(--teal-500)]" />
                  🔒 Ephemeral Privacy Filter Active
                </span>
                <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed font-medium">
                  All messages you write in this channel are linked to your session alias. Leaving the room or closing the browser window permanently deletes your posts from the server database.
                </p>
              </div>

              {/* Message loop */}
              <div className="space-y-3.5">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isMe = msg.senderAlias === userAlias;
                    const avatar = getAvatarProps(msg.senderAlias);
                    return (
                      <motion.div
                        key={msg._id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className={`flex gap-2.5 items-end ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[10px] bg-gradient-to-br ${avatar.bg} ${avatar.text} shadow-sm shrink-0 select-none`}>
                            {avatar.char}
                          </div>
                        )}
                        <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] font-bold text-[var(--text-muted)] tracking-wider px-1">
                            {isMe ? 'You' : msg.senderAlias || 'Anonymous citizen'}
                          </span>
                          <div className={`px-4 py-2.5 text-xs shadow-3xs leading-relaxed break-words font-medium ${
                            isMe 
                              ? 'bg-gradient-to-br from-[var(--teal-500)] to-[var(--teal-600)] text-white rounded-2xl rounded-br-none' 
                              : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-2xl rounded-bl-none'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[8px] text-[var(--text-muted)] px-1 font-semibold select-none">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {isMe && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[10px] bg-gradient-to-br ${avatar.bg} ${avatar.text} shadow-sm shrink-0 select-none`}>
                            {avatar.char}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Typing indicators */}
              <AnimatePresence>
                {typingUsers.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex items-center gap-2.5 text-[10px] text-[var(--teal-600)] font-semibold bg-[var(--teal-glow)] border border-teal-500/10 px-3 py-1.5 rounded-full w-fit shadow-4xs"
                  >
                    <div className="flex gap-1 items-center select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal-500)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal-500)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal-500)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>
                      {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Input send bar footer */}
            <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center gap-2">
              <input
                type="text"
                placeholder="Write message anonymously..."
                value={inputText}
                onChange={handleInputChange}
                className="flex-1 glass-input text-xs py-2.5 px-4 rounded-xl border border-[var(--border-subtle)] focus:border-[var(--teal-500)] bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--teal-500)] transition-all outline-none"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="w-10 h-10 flex items-center justify-center bg-[var(--teal-500)] text-white rounded-xl hover:bg-[var(--teal-400)] transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                <Send size={15} />
              </motion.button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center bg-radial-gradient">
            <motion.div
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-16 h-16 rounded-2xl bg-[var(--teal-glow)] border border-teal-500/20 flex items-center justify-center shadow-sm"
            >
              <Radio className="w-8 h-8 text-[var(--teal-500)]" />
            </motion.div>
            <div className="space-y-2 max-w-sm">
              <h4 className="font-bold text-[var(--text-primary)] font-display text-base">
                CivicTN Discussion Canvas
              </h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Select a public ward channel from the list on the left to share updates and discuss civic issues anonymously with your community.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 max-w-lg mt-4 text-left">
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 rounded-xl">
                <span className="text-[11px] font-bold text-[var(--teal-600)] block mb-1">🔒 100% Anonymous</span>
                <span className="text-[9px] text-[var(--text-secondary)] block leading-normal">
                  No personal identity is associated with your chat. Profiles are randomized.
                </span>
              </div>
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 rounded-xl">
                <span className="text-[11px] font-bold text-[var(--teal-600)] block mb-1">⚡ Ephemeral Chat</span>
                <span className="text-[9px] text-[var(--text-secondary)] block leading-normal">
                  All messages are deleted permanently from database tables when you leave.
                </span>
              </div>
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 rounded-xl">
                <span className="text-[11px] font-bold text-[var(--teal-600)] block mb-1">📍 Ward Channels</span>
                <span className="text-[9px] text-[var(--text-secondary)] block leading-normal">
                  Discussion categories are filtered by local municipal districts.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Room Modal Popup */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 rounded-2xl max-w-md w-full space-y-4 animate-scaleIn shadow-xl bg-[var(--bg-surface)] border border-[var(--border-default)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <h3 className="font-display font-extrabold text-[var(--teal-500)] text-base flex items-center gap-2">
                  <Sparkles size={16} />
                  <span>Create New Channel</span>
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1.5">Channel Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai Sanitation Debate"
                    value={newRoomForm.name}
                    onChange={(e) => setNewRoomForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full glass-input text-xs py-2 px-3 border border-[var(--border-subtle)] rounded-lg outline-none focus:border-[var(--teal-500)] transition-all bg-[var(--bg-elevated)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1.5">Description</label>
                  <textarea
                    placeholder="Explain what local topics are discussed in this channel..."
                    value={newRoomForm.description}
                    onChange={(e) => setNewRoomForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full glass-input text-xs py-2 px-3 border border-[var(--border-subtle)] rounded-lg outline-none focus:border-[var(--teal-500)] transition-all bg-[var(--bg-elevated)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1.5">Region / District</label>
                    <select
                      value={newRoomForm.district}
                      onChange={(e) => setNewRoomForm(prev => ({ ...prev, district: e.target.value }))}
                      className="w-full glass-input text-xs py-2 px-3 border border-[var(--border-subtle)] rounded-lg outline-none focus:border-[var(--teal-500)] transition-all bg-[var(--bg-elevated)] text-[var(--text-secondary)] cursor-pointer"
                    >
                      <option value="">All Regions</option>
                      {districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1.5">Issue Category</label>
                    <select
                      value={newRoomForm.category}
                      onChange={(e) => setNewRoomForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full glass-input text-xs py-2 px-3 border border-[var(--border-subtle)] rounded-lg outline-none focus:border-[var(--teal-500)] transition-all bg-[var(--bg-elevated)] text-[var(--text-secondary)] cursor-pointer"
                    >
                      <option value="roads">Roads</option>
                      <option value="sanitation">Sanitation</option>
                      <option value="water">Water Supply</option>
                      <option value="electricity">Electricity</option>
                      <option value="municipal">Municipal</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={creatingRoom}
                  className="btn btn-primary w-full bg-[var(--teal-500)] text-white py-2.5 rounded-xl font-bold hover:bg-[var(--teal-600)] transition-all shadow-md text-xs cursor-pointer disabled:opacity-50"
                >
                  {creatingRoom ? 'Creating Channel...' : 'Publish Channel'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
