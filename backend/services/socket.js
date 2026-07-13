/**
 * ============================================================
 *  services/socket.js — Real-time Chat & Strike Room Events
 *  Socket.io | Ephemeral Messages | Live Strike Counts | Feed Updates
 * ============================================================
 */

const { Message, ChatRoom } = require('../models/models');
const { generateChatAlias } = require('../middleware/middleware');
const { moderateContent, censorText }   = require('./services');

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

      let liveCount = room.memberCount;

      if (room.type === 'discussion') {
        const updated = await ChatRoom.findOneAndUpdate(
          { _id: roomId, type: 'discussion' },
          { $addToSet: { members: clerkId }, $inc: { memberCount: 1 } },
          { new: true }
        );
        if (updated) liveCount = updated.memberCount;
      }

      io.to(roomId).emit('room:user_joined', { alias: socket.data.alias, memberCount: liveCount });
      socket.emit('room:joined', { roomId, alias: socket.data.alias, memberCount: liveCount });
    });

    // ── SEND MESSAGE ─────────────────────────
    socket.on('message:send', async ({ roomId, text }) => {
      if (!text?.trim() || text.length > 1000) return;

      // Censor improper words
      const censoredText = censorText(text.trim());

      const mod = await moderateContent(censoredText);
      if (!mod.safe) return socket.emit('message:rejected', { reason: mod.reason });

      const msg = await Message.create({
        roomId,
        senderAlias: socket.data.alias || generateChatAlias(clerkId, roomId),
        text: censoredText,
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
      const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
      if (room?.type === 'strike') {
        await Message.updateMany({ roomId, senderAlias: socket.data.alias }, { isDeleted: true });
      }
      const discussionRoom = await ChatRoom.findOne({ _id: roomId, type: 'discussion', members: clerkId });
      if (discussionRoom) {
        const updated = await ChatRoom.findOneAndUpdate(
          { _id: roomId, type: 'discussion', members: clerkId },
          { $pull: { members: clerkId }, $inc: { memberCount: -1 } },
          { new: true }
        );
        if (updated) {
          io.to(roomId).emit('room:user_left', { alias: socket.data.alias, memberCount: updated.memberCount });
        }
      } else {
        io.to(roomId).emit('room:user_left', { alias: socket.data.alias });
      }
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
      const { roomId, alias } = socket.data || {};
      if (roomId && alias) {
        const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
        if (room?.type === 'strike') {
          await Message.updateMany({ roomId, senderAlias: alias }, { isDeleted: true });
        }
        const discussionRoom = await ChatRoom.findOne({ _id: roomId, type: 'discussion', members: clerkId });
        if (discussionRoom) {
          const updated = await ChatRoom.findOneAndUpdate(
            { _id: roomId, type: 'discussion', members: clerkId },
            { $pull: { members: clerkId }, $inc: { memberCount: -1 } },
            { new: true }
          );
          if (updated) {
            io.to(roomId).emit('room:user_left', { alias, memberCount: updated.memberCount });
          }
        } else {
          io.to(roomId).emit('room:user_left', { alias });
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
