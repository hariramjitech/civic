import React, { useState, useEffect, useRef } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { motion } from 'framer-motion';
import { 
  MessageSquare, Users, Send, Radio, Plus, Search, 
  MapPin, X, Loader2, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';

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
      } catch (err) {
        console.error(err);
      }
    };
    fetchRecentMessages();

    // Listeners
    socket.on('room:joined', ({ alias, memberCount: count }) => {
      setUserAlias(alias);
      if (typeof count === 'number') {
        setMemberCount(count);
      }
      console.log('Joined room. Assigned alias:', alias);
    });

    socket.on('room:user_joined', ({ alias, memberCount: count }) => {
      if (typeof count === 'number') setMemberCount(count);
      // Optional: append system log message
    });

    socket.on('room:user_left', ({ alias, memberCount: count }) => {
      if (typeof count === 'number') setMemberCount(count);
      // Optional: append system log
    });

    socket.on('message:new', (msg) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });

    socket.on('message:typing', ({ alias }) => {
      if (alias) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(alias);
          return next;
        });
      }
    });

    socket.on('message:stop_typing', ({ alias }) => {
      if (alias) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(alias);
          return next;
        });
      }
    });

    socket.on('message:rejected', ({ reason }) => {
      toast.error(`Message Blocked: ${reason}`);
    });

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
      socket.off('room:joined');
      socket.off('room:user_joined');
      socket.off('room:user_left');
      socket.off('message:new');
      socket.off('message:typing');
      socket.off('message:stop_typing');
      socket.off('message:rejected');
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

    // Send stop typing
    socket.emit('message:stop_typing', { roomId: activeRoom._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    socket.emit('message:send', { 
      roomId: activeRoom._id, 
      text: inputText.trim() 
    });
    
    setInputText('');
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
    <div className="h-[78vh] flex flex-col lg:flex-row gap-6 relative">
      {/* Sidebar - Channels list */}
      <div
        className="w-full lg:w-80 flex flex-col justify-between p-4 rounded-2xl h-[30vh] lg:h-auto overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="space-y-3 overflow-hidden flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-display flex items-center space-x-1.5">
              <MessageSquare size={18} className="text-teal-400" />
              <span>Discussion Channels</span>
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 hover:bg-gray-800 text-teal-400 rounded-lg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Search/Filter Controls */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="text"
                placeholder="Search channels..."
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
              />
            </div>
            
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full bg-gray-900 border border-gray-850 rounded-lg p-2 text-[10px] text-gray-400 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Regions / Districts</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Channels Grid List */}
          <div className="flex-1 overflow-y-auto space-y-1 pt-2">
            {loadingRooms ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map(n => <div key={n} className="h-10 bg-gray-900 rounded-lg" />)}
              </div>
            ) : filteredRooms.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4 text-center">No discussion channels found.</p>
            ) : (
              filteredRooms.map((room) => (
                <button
                  key={room._id}
                  onClick={() => setActiveRoom(room)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between group ${
                    activeRoom?._id === room._id
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                      : 'bg-gray-950/20 border-transparent text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                  }`}
                >
                  <div className="truncate pr-2 space-y-0.5">
                    <span className="font-bold block truncate">{room.name}</span>
                    {room.district && (
                      <span className="text-[9px] text-gray-600 font-semibold uppercase">{room.district}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0 text-[10px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                    <Users size={10} />
                    <span>{room.memberCount || 0}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas - Chat Panel */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col justify-between h-[45vh] lg:h-auto overflow-hidden border border-gray-900">
        {activeRoom ? (
          <>
            {/* Chat Room Top Bar Header */}
            <div className="p-4 border-b border-gray-900 bg-gray-950/40 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="font-display font-extrabold text-gray-200 text-sm sm:text-base">{activeRoom.name}</h3>
                  {activeRoom.district && (
                    <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-gray-900 text-gray-400 border border-gray-800">
                      {activeRoom.district}
                    </span>
                  )}
                </div>
                {activeRoom.description && (
                  <p className="text-[10px] text-gray-500 truncate max-w-sm sm:max-w-md">{activeRoom.description}</p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleLeaveCurrentRoom}
                  className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] uppercase font-bold border border-rose-500/20 transition-all"
                >
                  Leave Chat
                </button>
              </div>
            </div>

            {/* Message Feed Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-950/15">
              {/* Ephemeral Warning Notification */}
              <div className="p-3 bg-teal-950/10 border border-teal-500/10 rounded-xl text-center space-y-1 max-w-xl mx-auto">
                <span className="text-[10px] text-teal-400 uppercase font-extrabold tracking-wider block">🔒 Ephemeral Privacy Filter Active</span>
                <p className="text-[9px] text-gray-500 leading-normal">
                  All messages you write in this channel are linked to your session alias. Leaving the room or closing the browser window permanently deletes your posts from the server database.
                </p>
              </div>

              {/* Message loop */}
              {messages.map((msg) => {
                const isMe = msg.senderAlias === userAlias;
                return (
                  <div 
                    key={msg._id} 
                    className={`flex flex-col max-w-[70%] space-y-0.5 ${isMe ? 'ml-auto items-end' : 'items-start'}`}
                  >
                    <div className="text-[9px] text-gray-500 font-semibold uppercase px-1">
                      {isMe ? 'Me' : msg.senderAlias || 'Anonymous citizen'}
                    </div>
                    <div className={`p-3 rounded-xl text-xs leading-normal font-sans ${
                      isMe 
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-gray-900 font-semibold rounded-tr-none' 
                        : 'bg-gray-900 text-gray-300 border border-gray-850 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <div className="text-[8px] text-gray-650 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicators */}
              {typingUsers.size > 0 && (
                <div className="flex items-center space-x-1.5 text-[9px] text-teal-400/80 italic animate-pulse">
                  <Loader2 size={10} className="animate-spin" />
                  <span>
                    {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input send bar footer */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-900 bg-gray-950/20 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Write message anonymously..."
                value={inputText}
                onChange={handleInputChange}
                className="flex-1 p-2.5 text-xs rounded-xl glass-input focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="submit"
                className="p-2.5 bg-teal-500 text-gray-900 rounded-xl hover:bg-teal-400 transition-colors"
              >
                <Send size={14} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8 text-center text-gray-500">
            <Radio className="w-12 h-12 text-gray-700 animate-pulse" />
            <div>
              <h4 className="font-bold text-gray-400 font-display text-sm">Select Discussion Channel</h4>
              <p className="text-xs text-gray-650 max-w-xs mt-1">
                Enter an existing region discussion board to start talking to citizens anonymously.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Room Modal Popup */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-gray-900 pb-3">
              <h3 className="font-display font-extrabold text-teal-400 text-base flex items-center space-x-2">
                <Sparkles size={16} />
                <span>Create New Channel</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Channel Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chennai Sanitation Debate"
                  value={newRoomForm.name}
                  onChange={(e) => setNewRoomForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  placeholder="Explain what local topics are discussed in this channel..."
                  value={newRoomForm.description}
                  onChange={(e) => setNewRoomForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-lg glass-input focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Region / District</label>
                  <select
                    value={newRoomForm.district}
                    onChange={(e) => setNewRoomForm(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">All Regions</option>
                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Issue Category</label>
                  <select
                    value={newRoomForm.category}
                    onChange={(e) => setNewRoomForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
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

              <button
                type="submit"
                disabled={creatingRoom}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-gray-900 font-bold text-xs rounded-xl transition-all shadow-md"
              >
                {creatingRoom ? 'Creating Channel...' : 'Publish Channel'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
