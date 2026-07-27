import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Users, Send, Radio, Plus, Search, 
  X, Loader2, Sparkles, Shield, Compass, ChevronLeft,
  Hash, Lock, Globe, Mic
} from 'lucide-react';
import toast from 'react-hot-toast';

const getAvatarProps = (alias) => {
  if (!alias) return { char: 'A', bg: 'from-slate-400 to-slate-500' };
  const cleanAlias = alias.replace('Citizen ', '');
  let char = 'C';
  if (cleanAlias.startsWith('#') && cleanAlias.length > 1) {
    char = cleanAlias[1].toUpperCase();
  } else if (cleanAlias.length > 0) {
    char = cleanAlias[0].toUpperCase();
  }
  let hash = 0;
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradients = [
    'from-violet-400 to-purple-600',
    'from-blue-400 to-indigo-600',
    'from-teal-400 to-emerald-600',
    'from-pink-400 to-rose-600',
    'from-amber-400 to-orange-600',
    'from-cyan-400 to-sky-600',
  ];
  return { char, bg: gradients[Math.abs(hash) % gradients.length] };
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatRooms() {
  const { isSignedIn, loadingProfile, socket, setHideMobileBottomNav } = useCivic();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [districtFilter, setDistrictFilter] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomForm, setNewRoomForm] = useState({ name: '', description: '', district: '', category: 'other' });
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [userAlias, setUserAlias] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
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
      if (err.response?.status === 401 && attempt < 5) {
        await sleep(400);
        return fetchRooms(attempt + 1);
      }
      if (err.response?.status !== 401) toast.error('Failed to load channels.');
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSignedIn) { setLoadingRooms(false); return; }
      setLoadingRooms(true);
      await fetchRooms();
      if (!cancelled) setLoadingRooms(false);
    };
    load();
    return () => { cancelled = true; };
  }, [districtFilter, isSignedIn, loadingProfile]);

  useEffect(() => {
    if (!socket || !activeRoom) return;
    const joinRoom = () => socket.emit('room:join', { roomId: activeRoom._id });
    const fetchRecentMessages = async () => {
      try {
        const res = await api.get(`/rooms/${activeRoom._id}`);
        setMessages(res.data.messages || []);
        setMemberCount(res.data.room.memberCount || 0);
        setOnlineCount(1);
      } catch {}
    };
    fetchRecentMessages();

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
    const handleUserLeft = ({ roomId, memberCount: count, onlineCount: activeCount }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (typeof count === 'number') setMemberCount(count);
      if (typeof activeCount === 'number') setOnlineCount(activeCount);
    };
    const handleNewMessage = (msg) => {
      if (msg.roomId && msg.roomId !== activeRoom._id) return;
      setMessages((prev) => [...prev, msg]);
    };
    const handleTyping = ({ roomId, alias }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (alias) setTypingUsers(prev => { const next = new Set(prev); next.add(alias); return next; });
    };
    const handleStopTyping = ({ roomId, alias }) => {
      if (roomId && roomId !== activeRoom._id) return;
      if (alias) setTypingUsers(prev => { const next = new Set(prev); next.delete(alias); return next; });
    };
    const handleRejected = ({ reason }) => toast.error(`Blocked: ${reason}`);
    const handleMessageFlagged = ({ messageId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: '[Removed by AI moderation]' } : m));
    };
    const handleMessageError = ({ message }) => toast.error(message || 'Send failed.');
    const handleRoomError = ({ message }) => toast.error(message || 'Could not join.');

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

    if (socket.connected) joinRoom();
    else socket.on('connect', joinRoom);

    return () => {
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

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [messages]);

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

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeRoom) return;
    socket.emit('message:typing', { roomId: activeRoom._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('message:stop_typing', { roomId: activeRoom._id });
    }, 2000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeRoom) return;
    if (!socket.connected) { toast.error('Reconnecting...'); return; }
    socket.emit('message:stop_typing', { roomId: activeRoom._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.timeout(8000).emit('message:send', { roomId: activeRoom._id, text: inputText.trim() }, (err, response) => {
      if (err) { toast.error('Send timed out.'); return; }
      if (!response?.ok) { toast.error(response?.error || 'Send failed.'); return; }
      setInputText('');
      inputRef.current?.focus();
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
      toast.success('Channel created!');
      setShowCreateModal(false);
      setNewRoomForm({ name: '', description: '', district: '', category: 'other' });
      fetchRooms();
      setActiveRoom(res.data.room);
    } catch { toast.error('Failed to create.'); } 
    finally { setCreatingRoom(false); }
  };

  const handleLeaveCurrentRoom = async () => {
    if (!activeRoom) return;
    try {
      await api.post(`/rooms/${activeRoom._id}/leave`);
      setActiveRoom(null);
      toast.success('Left room.');
      fetchRooms();
    } catch { setActiveRoom(null); }
  };

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(roomSearch.toLowerCase()))
  );

  // Group messages by date + consecutive sender
  const groupedMessages = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const sameUser = prev?.senderAlias === msg.senderAlias;
    const sameMinute = prev && (new Date(msg.createdAt) - new Date(prev.createdAt)) < 60000;
    acc.push({ ...msg, compact: sameUser && sameMinute });
    return acc;
  }, []);

  return (
    <div className={`${activeRoom ? 'h-[calc(100vh-3.5rem)]' : 'h-[calc(100vh-7.25rem)]'} lg:h-[calc(100vh-2.5rem)] flex flex-col lg:flex-row overflow-hidden relative font-sans bg-[var(--bg-base)]`}>
      
      {/* ── CHANNELS SIDEBAR ── */}
      <div className={`w-full lg:w-72 flex flex-col h-full overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] ${activeRoom ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-sm font-black font-display text-[var(--text-primary)] flex items-center gap-1.5">
              <Link
                to="/feed"
                className="lg:hidden p-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors cursor-pointer mr-0.5 flex items-center justify-center"
                aria-label="Back to feed"
              >
                <ChevronLeft size={18} />
              </Link>
              <Hash size={15} className="text-[var(--teal-500)]" />
              Channels
            </h2>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Civic discussion forums</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--teal-500)] bg-[var(--teal-glow)] border border-[var(--teal-500)]/20 cursor-pointer hover:bg-[var(--teal-500)] hover:text-white transition-all"
          >
            <Plus size={15} />
          </motion.button>
        </div>

        {/* Search + Filter */}
        <div className="px-3 py-3 space-y-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search channels..."
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--teal-500)] focus:ring-1 focus:ring-[var(--teal-500)] outline-none transition-all text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="w-full text-xs py-2 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--teal-500)] transition-all outline-none text-[var(--text-secondary)] cursor-pointer"
          >
            <option value="">All Districts</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin">
          {loadingRooms ? (
            <div className="space-y-1.5 px-1 pt-2">
              {[1, 2, 3, 4].map(n => <div key={n} className="h-14 skeleton rounded-xl animate-pulse" />)}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Compass size={28} className="text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-xs font-semibold text-[var(--text-muted)]">No channels found</p>
              <button onClick={() => setShowCreateModal(true)} className="mt-3 text-xs font-bold text-[var(--teal-500)] hover:underline cursor-pointer bg-transparent border-none">
                Create one
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isActive = activeRoom?._id === room._id;
              return (
                <motion.button
                  key={room._id}
                  onClick={() => setActiveRoom(room)}
                  whileHover={{ x: 2 }}
                  className={`channel-list-item flex items-center gap-3 p-3 rounded-xl text-left w-full transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[var(--teal-glow)] border border-[var(--teal-500)]/25'
                      : 'hover:bg-[var(--bg-elevated)] border border-transparent'
                  }`}
                >
                  {/* Channel avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${
                    isActive ? 'bg-[var(--teal-500)] text-white shadow-teal' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                  }`}>
                    <Hash size={14} className={isActive ? 'text-white' : 'text-[var(--text-muted)]'} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className={`block text-xs font-bold truncate ${isActive ? 'text-[var(--teal-500)]' : 'text-[var(--text-primary)]'}`}>
                      {room.name}
                    </span>
                    {room.district && (
                      <span className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">{room.district}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 text-[9px] text-[var(--text-muted)] font-bold">
                    <Users size={9} />
                    <span>{room.memberCount || 0}</span>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {/* ── CHAT PANEL ── */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${activeRoom ? 'flex' : 'hidden lg:flex'}`}>
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm flex-shrink-0">
              <button
                onClick={() => setActiveRoom(null)}
                className="lg:hidden p-2 rounded-xl hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Room icon */}
              <div className="w-9 h-9 rounded-xl bg-[var(--teal-glow)] border border-[var(--teal-500)]/20 flex items-center justify-center flex-shrink-0">
                <Hash size={16} className="text-[var(--teal-500)]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-black text-sm text-[var(--text-primary)] truncate">{activeRoom.name}</h3>
                  {activeRoom.district && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                      {activeRoom.district}
                    </span>
                  )}
                </div>
                {activeRoom.description && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate max-w-xs">{activeRoom.description}</p>
                )}
              </div>

              {/* Online indicator */}
              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1.5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse" />
                <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider">{onlineCount} live</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleLeaveCurrentRoom}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 text-[10px] font-black border border-rose-200 dark:border-rose-500/20 cursor-pointer transition-all"
              >
                Leave
              </motion.button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-0.5 bg-[var(--bg-base)]">
              {/* Privacy Notice */}
              <div className="flex items-center gap-3 mb-5 px-3 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl max-w-md mx-auto">
                <Lock size={14} className="text-[var(--teal-500)] flex-shrink-0" />
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed font-medium">
                  Ephemeral & anonymous — messages delete permanently when you leave.
                </p>
              </div>

              <AnimatePresence initial={false}>
                {groupedMessages.map((msg) => {
                  const isMe = msg.senderAlias === userAlias;
                  const avatar = getAvatarProps(msg.senderAlias);
                  return (
                    <motion.div
                      key={msg._id}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={`flex gap-2.5 items-end ${isMe ? 'justify-end' : 'justify-start'} ${msg.compact ? 'mt-0.5' : 'mt-3'}`}
                    >
                      {/* Other user avatar */}
                      {!isMe && (
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatar.bg} flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 select-none ${msg.compact ? 'opacity-0' : ''}`}>
                          {avatar.char}
                        </div>
                      )}

                      <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender name (only first in group) */}
                        {!msg.compact && !isMe && (
                          <span className="text-[9px] font-bold text-[var(--text-muted)] px-1 select-none">
                            {msg.senderAlias || 'Anonymous'}
                          </span>
                        )}
                        
                        {/* Message bubble */}
                        <div className={`chat-bubble ${isMe ? 'chat-bubble-me' : 'chat-bubble-other'}`}>
                          {msg.text}
                        </div>

                        {/* Timestamp */}
                        {!msg.compact && (
                          <span className="text-[8px] text-[var(--text-muted)] px-1 select-none font-medium">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* My avatar placeholder */}
                      {isMe && <div className="w-7 flex-shrink-0" />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing indicator */}
              <AnimatePresence>
                {typingUsers.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex items-center gap-2 mt-2 ml-9"
                  >
                    <div className="flex gap-1 px-3.5 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl rounded-bl-sm shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[9px] text-[var(--text-muted)] font-semibold">
                      {Array.from(typingUsers).slice(0, 2).join(', ')} typing…
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2.5 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="flex-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl px-4 py-2 gap-2 focus-within:border-[var(--teal-500)] focus-within:ring-2 focus-within:ring-[var(--teal-glow)] transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Message anonymously…"
                  value={inputText}
                  onChange={handleInputChange}
                  className="flex-1 bg-transparent text-sm outline-none border-none focus:ring-0 py-0.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-2xl text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-teal transition-all"
                style={{ background: inputText.trim() ? 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' : 'var(--bg-elevated)' }}
              >
                <Send size={15} className={inputText.trim() ? 'text-white' : 'text-[var(--text-muted)]'} />
              </motion.button>
            </form>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-3xl bg-[var(--teal-glow)] border border-[var(--teal-500)]/20 flex items-center justify-center shadow-teal"
            >
              <MessageSquare className="w-9 h-9 text-[var(--teal-500)]" />
            </motion.div>

            <div className="space-y-2 max-w-sm">
              <h4 className="font-display font-black text-lg text-[var(--text-primary)]">CivicTN Channels</h4>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Pick a channel from the sidebar to join anonymous civic discussions in your district.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-sm w-full mt-2">
              {[
                { icon: '🔒', title: 'Anonymous', desc: 'No identity attached' },
                { icon: '⚡', title: 'Ephemeral', desc: 'Deletes on exit' },
                { icon: '📍', title: 'Local', desc: 'District-filtered' },
              ].map(card => (
                <div key={card.title} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 rounded-2xl text-center">
                  <div className="text-xl mb-1">{card.icon}</div>
                  <div className="text-[10px] font-black text-[var(--text-primary)]">{card.title}</div>
                  <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE ROOM MODAL ── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--teal-glow)] border border-[var(--teal-500)]/20 flex items-center justify-center">
                    <Hash size={13} className="text-[var(--teal-500)]" />
                  </div>
                  <h3 className="font-display font-black text-sm text-[var(--text-primary)]">Create Channel</h3>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider mb-1.5">Channel Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai Sanitation Debate"
                    value={newRoomForm.name}
                    onChange={(e) => setNewRoomForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full glass-input text-sm py-2.5 px-3.5 rounded-xl outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider mb-1.5">Description</label>
                  <textarea
                    placeholder="What topics are discussed here?"
                    value={newRoomForm.description}
                    onChange={(e) => setNewRoomForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full glass-input text-sm py-2.5 px-3.5 rounded-xl outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider mb-1.5">District</label>
                    <select value={newRoomForm.district} onChange={(e) => setNewRoomForm(prev => ({ ...prev, district: e.target.value }))}
                      className="w-full glass-input text-xs py-2.5 px-3 rounded-xl outline-none cursor-pointer">
                      <option value="">All Regions</option>
                      {districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider mb-1.5">Category</label>
                    <select value={newRoomForm.category} onChange={(e) => setNewRoomForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full glass-input text-xs py-2.5 px-3 rounded-xl outline-none cursor-pointer">
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
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={creatingRoom || !newRoomForm.name.trim()}
                  className="w-full py-3 rounded-xl text-sm font-black text-white shadow-teal cursor-pointer disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))' }}
                >
                  {creatingRoom ? 'Creating…' : 'Create Channel'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
