/**
 * ============================================================
 *  services/socket.js — Real-time Chat & Strike Room Events
 *  Socket.io | Ephemeral Messages | Live Strike Counts | Feed Updates
 * ============================================================
 */

const { Message, ChatRoom } = require('../models/models');
const { generateChatAlias } = require('../middleware/middleware');
const { moderateContent, censorText, getProfanityStats, censorCustomWords } = require('./services');

const initSocket = (io) => {
  io.on('connection', (socket) => {
    const clerkId = socket.handshake.auth?.userId;
    if (!clerkId) { socket.disconnect(); return; }

    console.log(`🔌 Socket: ${socket.id} connected`);

    // ── JOIN ROOM ─────────────────────────────
    socket.on('room:join', async ({ roomId } = {}) => {
      if (!roomId) {
        return socket.emit('room:error', { message: 'Room id is required' });
      }

      const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
      if (!room) return socket.emit('room:error', { message: 'Room not found' });

      socket.join(roomId);
      const alias = generateChatAlias(clerkId, roomId);
      socket.data.rooms = {
        ...(socket.data.rooms || {}),
        [roomId]: { alias },
      };
      socket.data.roomId = roomId;
      socket.data.clerkId = clerkId;
      socket.data.alias = alias;

      let liveCount = room.memberCount;

      if (room.type === 'discussion') {
        const updated = await ChatRoom.findOneAndUpdate(
          { _id: roomId, type: 'discussion' },
          { $addToSet: { members: clerkId }, $inc: { memberCount: 1 } },
          { returnDocument: 'after' }
        );
        if (updated) liveCount = updated.memberCount;
      }

      const onlineCount = io.sockets.adapter.rooms.get(String(roomId))?.size || 0;

      io.to(roomId).emit('room:user_joined', { roomId, alias, memberCount: liveCount, onlineCount });
      socket.emit('room:joined', { roomId, alias, memberCount: liveCount, onlineCount });
    });

    // ── SEND MESSAGE ─────────────────────────
    socket.on('message:send', async ({ roomId, text } = {}, ack) => {
      const hasAck = typeof ack === 'function';
      const reply = (payload) => {
        if (hasAck) ack(payload);
        return payload;
      };

      const fail = (error, eventName = 'message:error', eventPayload = {}) => {
        if (!hasAck) {
          socket.emit(eventName, {
            message: error,
            ...eventPayload,
          });
        }
        return reply({ ok: false, error });
      };

      try {
        const cleanText = typeof text === 'string' ? text.trim() : '';
        if (!roomId) {
          return fail('Select a room before sending.');
        }
        if (!cleanText) {
          return fail('Message cannot be empty.');
        }
        if (cleanText.length > 1000) {
          return fail('Message is too long.');
        }

        const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
        if (!room) {
          return fail('Room not found or inactive.');
        }

        if (!socket.rooms.has(String(roomId))) {
          socket.join(roomId);
        }

        const alias = socket.data.rooms?.[roomId]?.alias || generateChatAlias(clerkId, roomId);
        socket.data.rooms = {
          ...(socket.data.rooms || {}),
          [roomId]: { alias },
        };

        // Censor improper words
        const textStats = getProfanityStats(cleanText);
        let censoredText = textStats.censoredText;

        const mod = await moderateContent(censoredText);
        if (!mod.safe) {
          const reason = mod.reason || 'Message failed moderation.';
          return fail(reason, 'message:rejected', { reason });
        }

        // Censor any additional bad words detected by Gemini
        if (mod.badWords && mod.badWords.length > 0) {
          censoredText = censorCustomWords(censoredText, mod.badWords);
        }

        const msg = await Message.create({
          roomId,
          senderAlias: alias,
          text: censoredText,
          type: 'text',
        });

        const payload = {
          _id: msg._id,
          roomId,
          senderAlias: msg.senderAlias,
          text: msg.text,
          createdAt: msg.createdAt,
        };

        io.to(roomId).emit('message:new', payload);
        return reply({ ok: true, message: payload });
      } catch (err) {
        console.error('Socket message send failed:', err);
        return fail('Message could not be sent.');
      }
    });

    // ── TYPING INDICATORS ────────────────────
    socket.on('message:typing', ({ roomId }) => {
      if (!roomId) return;
      const alias = socket.data.rooms?.[roomId]?.alias || socket.data.alias;
      socket.to(roomId).emit('message:typing', { roomId, alias });
    });

    socket.on('message:stop_typing', ({ roomId }) => {
      if (!roomId) return;
      const alias = socket.data.rooms?.[roomId]?.alias || socket.data.alias;
      socket.to(roomId).emit('message:stop_typing', { roomId, alias });
    });

    // ── LEAVE ROOM (ephemeral — delete messages) ──
    socket.on('room:leave', async ({ roomId }) => {
      if (!roomId) return;
      socket.leave(roomId);
      const alias = socket.data.rooms?.[roomId]?.alias || socket.data.alias;
      const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
      if (room?.type === 'strike') {
        await Message.deleteMany({ roomId, senderAlias: alias });
      }
      const onlineCount = io.sockets.adapter.rooms.get(String(roomId))?.size || 0;
      const discussionRoom = await ChatRoom.findOne({ _id: roomId, type: 'discussion', members: clerkId });
      if (discussionRoom) {
        const updated = await ChatRoom.findOneAndUpdate(
          { _id: roomId, type: 'discussion', members: clerkId },
          { $pull: { members: clerkId }, $inc: { memberCount: -1 } },
          { returnDocument: 'after' }
        );
        if (updated) {
          io.to(roomId).emit('room:user_left', { roomId, alias, memberCount: updated.memberCount, onlineCount });
        }
      } else {
        io.to(roomId).emit('room:user_left', { roomId, alias, onlineCount });
      }
    });

    // ── STRIKE ROOM — live member count ─────
    socket.on('strike:join', async ({ roomId }) => {
      const room = await ChatRoom.findOneAndUpdate(
        { _id: roomId, type: 'strike', members: { $ne: clerkId } },
        { $addToSet: { members: clerkId }, $inc: { memberCount: 1 } },
        { returnDocument: 'after' }
      );
      if (room) io.emit('strike:count_update', { roomId, memberCount: room.memberCount });
    });

    // ── SUBSCRIBE TO LIVE FEED ───────────────
    socket.on('feed:subscribe', () => socket.join('feed'));

    // ── SUBSCRIBE TO SPECIFIC POST UPDATES ────
    socket.on('post:subscribe', ({ postId }) => {
      if (postId) {
        socket.join(`post:${postId}`);
      }
    });

    socket.on('post:unsubscribe', ({ postId }) => {
      if (postId) {
        socket.leave(`post:${postId}`);
      }
    });

    // ── DISCONNECT (ephemeral cleanup) ───────
    socket.on('disconnect', async () => {
      const joinedRooms = socket.data?.rooms || {};
      for (const [roomId, roomData] of Object.entries(joinedRooms)) {
        const alias = roomData?.alias || generateChatAlias(clerkId, roomId);
        const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
        if (room?.type === 'strike') {
          await Message.deleteMany({ roomId, senderAlias: alias });
        }
        const onlineCount = io.sockets.adapter.rooms.get(String(roomId))?.size || 0;
        const discussionRoom = await ChatRoom.findOne({ _id: roomId, type: 'discussion', members: clerkId });
        if (discussionRoom) {
          const updated = await ChatRoom.findOneAndUpdate(
            { _id: roomId, type: 'discussion', members: clerkId },
            { $pull: { members: clerkId }, $inc: { memberCount: -1 } },
            { returnDocument: 'after' }
          );
          if (updated) {
            io.to(roomId).emit('room:user_left', { roomId, alias, memberCount: updated.memberCount, onlineCount });
          }
        } else {
          io.to(roomId).emit('room:user_left', { roomId, alias, onlineCount });
        }
      }
      console.log(`❌ Socket: ${socket.id} disconnected`);
    });
  });

  // Helpers used by controllers for live feed updates
  io.emitFeedUpdate   = (post)          => io.to('feed').emit('feed:post_updated', post);
  io.emitStrikeUpdate = (roomId, count) => io.emit('strike:count_update', { roomId, memberCount: count });

  return io;
};

module.exports = initSocket;
