/**
 * ============================================================
 *  services/socket.js — Real-time Chat & Strike Room Events
 *  Socket.io | Ephemeral Messages | Live Strike Counts | Feed Updates
 * ============================================================
 */

const { Message, ChatRoom } = require('../models/models');
const { generateChatAlias } = require('../middleware/middleware');
const { moderateContent }   = require('./services');

const initSocket = (io) => {
  io.on('connection', (socket) => {
    const clerkId = socket.handshake.auth?.userId;
    if (!clerkId) { socket.disconnect(); return; }

    console.log(`🔌 Socket: ${socket.id} connected`);

    // ── JOIN ROOM ─────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
      const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
      if (!room) return socket.emit('error', { message: 'Room not found' });

      socket.join(roomId);
      socket.data = { roomId, clerkId, alias: generateChatAlias(clerkId, roomId) };

      io.to(roomId).emit('room:user_joined', { alias: socket.data.alias, memberCount: room.memberCount });
      socket.emit('room:joined', { roomId, alias: socket.data.alias });
    });

    // ── SEND MESSAGE ─────────────────────────
    socket.on('message:send', async ({ roomId, text }) => {
      if (!text?.trim() || text.length > 1000) return;

      const mod = await moderateContent(text);
      if (!mod.safe) return socket.emit('message:rejected', { reason: mod.reason });

      const msg = await Message.create({
        roomId,
        senderAlias: socket.data.alias || generateChatAlias(clerkId, roomId),
        text: text.trim(),
        type: 'text',
      });

      io.to(roomId).emit('message:new', {
        _id:         msg._id,
        senderAlias: msg.senderAlias,
        text:        msg.text,
        createdAt:   msg.createdAt,
      });
    });

    // ── TYPING INDICATORS ────────────────────
    socket.on('message:typing',      ({ roomId }) => socket.to(roomId).emit('message:typing',      { alias: socket.data.alias }));
    socket.on('message:stop_typing', ({ roomId }) => socket.to(roomId).emit('message:stop_typing', { alias: socket.data.alias }));

    // ── LEAVE ROOM (ephemeral — delete messages) ──
    socket.on('room:leave', async ({ roomId }) => {
      socket.leave(roomId);
      await Message.updateMany({ roomId, senderAlias: socket.data.alias }, { isDeleted: true });
      io.to(roomId).emit('room:user_left', { alias: socket.data.alias });
    });

    // ── STRIKE ROOM — live member count ─────
    socket.on('strike:join', async ({ roomId }) => {
      const room = await ChatRoom.findOneAndUpdate(
        { _id: roomId, type: 'strike', members: { $ne: clerkId } },
        { $addToSet: { members: clerkId }, $inc: { memberCount: 1 } },
        { new: true }
      );
      if (room) io.emit('strike:count_update', { roomId, memberCount: room.memberCount });
    });

    // ── SUBSCRIBE TO LIVE FEED ───────────────
    socket.on('feed:subscribe', () => socket.join('feed'));

    // ── DISCONNECT (ephemeral cleanup) ───────
    socket.on('disconnect', async () => {
      const { roomId, alias } = socket.data || {};
      if (roomId && alias) {
        await Message.updateMany({ roomId, senderAlias: alias }, { isDeleted: true });
        io.to(roomId).emit('room:user_left', { alias });
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
