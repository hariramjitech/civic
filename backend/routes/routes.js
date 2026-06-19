/**
 * ============================================================
 *  ALL ROUTES + CONTROLLERS — Civic Platform Backend
 *  Posts | Social | AI | Rooms | Contacts | Analytics | Auth Sync
 * ============================================================
 */

const express = require('express');
const router = express.Router();

const { User, Post, Comment, Poll, ChatRoom, Message, Contact, AuditLog } = require('../models/models');
const {
  requireAuth, attachUser, requireRole,
  upload, uploadToCloudinary,
  postLimiter, aiLimiter, asyncHandler,
  generateChatAlias,
} = require('../middleware/middleware');
const {
  classifyIssue, checkDuplicate, moderateContent,
  generateReport, predictRiskZones,
  reverseGeocode, fetchGovRoadData,
  updateIntensityScore, rewriteComplaint,
  getHaversineDistance,
} = require('../services/services');

// ═══════════════════════════════════════════
// AUTH / USER SYNC (Clerk webhook + profile)
// ═══════════════════════════════════════════

// Sync / get current user profile
router.get('/auth/me', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const user = req.user;
  res.json({
    id: user._id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
    district: user.district,
    // Personal accountability — own history (visible only to self)
    myStats: {
      postCount: user.postTokens?.length || 0,
      commentCount: user.commentTokens?.length || 0,
      likedCount: user.likedPosts?.length || 0,
    },
  });
}));

// Update user profile (district, displayName for private use)
router.patch('/auth/profile', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { district } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { district },
    { new: true }
  );
  res.json({ success: true, district: user.district });
}));

// Get user's own post history (private — shows their anonToken posts)
router.get('/auth/my-posts', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const anonToken = req.anonToken;
  const posts = await Post.find({ anonToken, isDeleted: false })
    .sort({ createdAt: -1 })
    .select('-anonToken')
    .lean();
  res.json({ posts });
}));

// Get user's own comment history
router.get('/auth/my-comments', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const anonToken = req.anonToken;
  const comments = await Comment.find({ anonToken, isDeleted: false })
    .sort({ createdAt: -1 })
    .select('-anonToken')
    .populate('postId', 'title')
    .lean();
  res.json({ comments });
}));

// Get user's liked posts
router.get('/auth/my-likes', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'likedPosts',
    match: { isDeleted: false },
    select: '-anonToken',
  });
  res.json({ posts: user.likedPosts });
}));

// Clerk webhook: user deleted → cleanup (optional)
router.post('/auth/webhook/clerk', asyncHandler(async (req, res) => {
  const { type, data } = req.body;
  if (type === 'user.deleted') {
    await User.deleteOne({ clerkId: data.id });
  }
  res.json({ received: true });
}));


// ═══════════════════════════════════════════
// POSTS — Anonymous Social Feed
// ═══════════════════════════════════════════

// GET /api/posts — paginated feed
router.get('/posts', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, district, category, severity, status,
    sort = 'latest', lat, lng, radius = 5000
  } = req.query;

  const query = { isDeleted: false, isDuplicate: false };
  if (district) query.district = district;
  if (category) query.category = category;
  if (severity) query.severity = severity;
  if (status) query.status = status;

  // Geo-filter: posts within radius (meters) of given coordinates
  if (lat && lng) {
    query.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(radius),
      }
    };
  }

  const sortMap = {
    latest: { createdAt: -1 },
    intensity: { intensityScore: -1 },
    severity: { severity: -1, createdAt: -1 },
  };

  const posts = await Post.find(query)
    .sort(sortMap[sort] || sortMap.latest)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl')
    .lean();

  const total = await Post.countDocuments(query);

  res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
}));

// GET /api/posts/:id — single post detail
router.get('/posts/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
    .select('-anonToken')
    .populate('attachedContacts')
    .lean();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Get linked polls & strike room
  const polls = await Poll.find({ postId: post._id, isActive: true }).lean();
  const strikeRoom = await ChatRoom.findOne({ postId: post._id, type: 'strike', isActive: true })
    .select('name memberCount escalationLevel').lean();

  res.json({ post, polls, strikeRoom });
}));

// POST /api/posts — create anonymous post
router.post('/posts',
  requireAuth,
  attachUser,
  postLimiter,
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    const { title, description, lat, lng, category: manualCategory } = req.body;

    if (!title || !description) return res.status(400).json({ error: 'Title and description required' });

    // Moderation check
    const modResult = await moderateContent(description);
    if (!modResult.safe) {
      return res.status(400).json({ error: `Content flagged: ${modResult.reason}` });
    }

    // Upload images to Cloudinary
    const imageUrls = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer, 'civic/posts');
        imageUrls.push(url);
      }
    }

    // Forensic metadata parsing & validation
    let imageMetadata = {
      camera: 'Unknown',
      dateTimeOriginal: null,
      software: 'Unknown',
      hasGPS: false,
      exifGPS: { lat: 0, lng: 0 },
      gpsMatchStatus: 'no_gps_data'
    };
    let metadataContext = '';

    if (req.files?.length) {
      try {
        const parser = require('exif-parser').create(req.files[0].buffer);
        const result = parser.parse();
        if (result && result.tags) {
          const tags = result.tags;
          const make = tags.Make || '';
          const model = tags.Model || '';
          imageMetadata.camera = `${make} ${model}`.trim() || 'Unknown';
          imageMetadata.software = tags.Software || 'None';

          if (tags.DateTimeOriginal) {
            imageMetadata.dateTimeOriginal = new Date(tags.DateTimeOriginal * 1000);
          } else if (tags.CreateDate) {
            imageMetadata.dateTimeOriginal = new Date(tags.CreateDate * 1000);
          }

          if (tags.GPSLatitude !== undefined && tags.GPSLongitude !== undefined) {
            imageMetadata.hasGPS = true;
            imageMetadata.exifGPS.lat = tags.GPSLatitude;
            imageMetadata.exifGPS.lng = tags.GPSLongitude;

            if (lat && lng) {
              const dist = getHaversineDistance(
                parseFloat(lat),
                parseFloat(lng),
                tags.GPSLatitude,
                tags.GPSLongitude
              );
              imageMetadata.gpsMatchStatus = dist <= 500 ? 'matched' : 'mismatch';
            }
          }
        }
      } catch (exifErr) {
        console.error('EXIF parsing failed:', exifErr.message);
      }

      metadataContext = `Camera: ${imageMetadata.camera}
Software/Editor: ${imageMetadata.software}
Date Captured: ${imageMetadata.dateTimeOriginal ? imageMetadata.dateTimeOriginal.toISOString() : 'Unknown'}
Photo GPS: ${imageMetadata.hasGPS ? `${imageMetadata.exifGPS.lat}, ${imageMetadata.exifGPS.lng}` : 'No GPS data'}
User Pinned GPS: ${lat && lng ? `${lat}, ${lng}` : 'Not provided'}
GPS Match Status: ${imageMetadata.gpsMatchStatus}`;
    }

    // AI classification from first image (or text only)
    let aiResult = { 
      category: manualCategory || 'other', 
      severity: 'medium', 
      tags: [], 
      confidence: 0, 
      summary: description,
      originalityStatus: 'unknown',
      originalityAnalysis: 'No image uploaded for forensics.'
    };
    if (req.files?.length) {
      const base64 = req.files[0].buffer.toString('base64');
      const mime = req.files[0].mimetype;
      aiResult = await classifyIssue(base64, mime, description, metadataContext);
    }

    // Reverse geocode location
    let locationData = { district: 'Unknown', address: '' };
    if (lat && lng) {
      locationData = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    }

    // Find auto-attach contacts for this district
    const contacts = await Contact.find({ district: locationData.district });
    const contactIds = contacts.map(c => c._id);

    // Duplicate detection (nearby posts within 200m, same category)
    let duplicateInfo = { isDuplicate: false };
    if (lat && lng) {
      const nearby = await Post.find({
        category: aiResult.category,
        isDeleted: false,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: 200,
          }
        }
      }).limit(5).lean();

      if (nearby.length) {
        duplicateInfo = await checkDuplicate({ category: aiResult.category, description }, nearby);
      }
    }

    // Create post
    const post = await Post.create({
      anonToken: req.anonToken,
      title,
      description,
      images: imageUrls,
      location: lat && lng ? {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
      } : undefined,
      district: locationData.district,
      address: locationData.address,
      category: aiResult.category,
      severity: aiResult.severity,
      aiTags: aiResult.tags,
      aiConfidence: aiResult.confidence,
      attachedContacts: contactIds,
      isDuplicate: duplicateInfo.isDuplicate,
      duplicateOf: duplicateInfo.duplicatePostId || undefined,
      statusHistory: [{ status: 'reported', note: 'Post created' }],
      imageMetadata,
      originalityStatus: aiResult.originalityStatus || 'unknown',
      originalityAnalysis: aiResult.originalityAnalysis || '',
    });

    // Track anon token on user (for ownership claim, visible only to them)
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { postTokens: req.anonToken }
    });

    const populated = await Post.findById(post._id)
      .select('-anonToken')
      .populate('attachedContacts', 'department officerName phone email portalUrl');

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.to('feed').emit('feed:post_created', populated);
    }

    res.status(201).json({ post: populated, aiResult });
  })
);

// PATCH /api/posts/:id/status — update status (only own posts via anonToken)
router.patch('/posts/:id/status', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['reported', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.anonToken !== req.anonToken && req.user.role === 'citizen') {
    return res.status(403).json({ error: 'You can only update your own posts' });
  }

  post.status = status;
  post.statusHistory.push({ status, note: note || '', updatedAt: new Date() });
  await post.save();

  const populated = await Post.findById(post._id)
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl')
    .lean();

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_updated', populated);
    io.to(`post:${populated._id}`).emit('post:updated', populated);
  }

  res.json({ success: true, status: post.status, history: post.statusHistory, post: populated });
}));

// DELETE /api/posts/:id — soft delete (own post only)
router.delete('/posts/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.anonToken !== req.anonToken && !['admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  await Post.findByIdAndUpdate(req.params.id, { isDeleted: true });

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_deleted', { postId: req.params.id });
  }

  res.json({ success: true });
}));


// ═══════════════════════════════════════════
// SOCIAL — Likes, Comments, Polls, Support
// ═══════════════════════════════════════════

// POST /api/posts/:id/like — toggle like
router.post('/posts/:id/like', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.isDeleted) return res.status(404).json({ error: 'Post not found' });

  const user = await User.findById(req.user._id);
  const alreadyLiked = user.likedPosts.includes(post._id);

  if (alreadyLiked) {
    await User.findByIdAndUpdate(req.user._id, { $pull: { likedPosts: post._id } });
    await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: -1 } });
  } else {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { likedPosts: post._id } });
    await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: 1 } });
  }

  const updated = await Post.findById(post._id).select('likeCount intensityScore');
  await updateIntensityScore(post._id);

  const populated = await Post.findById(post._id)
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl')
    .lean();

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_updated', populated);
    io.to(`post:${populated._id}`).emit('post:updated', populated);
  }

  res.json({ liked: !alreadyLiked, likeCount: populated.likeCount });
}));

// POST /api/posts/:id/support — cross-city support report (bumps intensity)
router.post('/posts/:id/support', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $inc: { supportCount: 1 } },
    { new: true }
  );
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const newScore = await updateIntensityScore(post._id);

  const populated = await Post.findById(post._id)
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl')
    .lean();

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_updated', populated);
    io.to(`post:${populated._id}`).emit('post:updated', populated);
  }

  res.json({ success: true, supportCount: populated.supportCount, intensityScore: newScore });
}));

// GET /api/posts/:id/comments — paginated comments
router.get('/posts/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const comments = await Comment.find({ postId: req.params.id, isDeleted: false, parentId: null })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-anonToken')
    .lean();

  // Attach replies
  for (const c of comments) {
    c.replies = await Comment.find({ parentId: c._id, isDeleted: false })
      .select('-anonToken').sort({ createdAt: 1 }).lean();
  }

  res.json({ comments });
}));

// POST /api/posts/:id/comments — add anonymous comment
router.post('/posts/:id/comments', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { text, parentId } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });

  const mod = await moderateContent(text);
  if (!mod.safe) return res.status(400).json({ error: `Comment flagged: ${mod.reason}` });

  const comment = await Comment.create({
    postId: req.params.id,
    anonToken: req.anonToken,
    text: text.trim(),
    parentId: parentId || null,
  });

  await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } });
  await updateIntensityScore(req.params.id);

  // Track comment token for user's own history
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { commentTokens: req.anonToken }
  });

  res.status(201).json({ comment: { ...comment.toObject(), anonToken: undefined } });
}));

// POST /api/posts/:id/polls — create a poll
router.post('/posts/:id/polls', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { question, options, expiresInHours = 48 } = req.body;
  if (!question || !options?.length || options.length < 2) {
    return res.status(400).json({ error: 'Question and at least 2 options required' });
  }

  const poll = await Poll.create({
    postId: req.params.id,
    question,
    options: options.map(text => ({ text, voteCount: 0 })),
    expiresAt: new Date(Date.now() + expiresInHours * 3600 * 1000),
  });

  res.status(201).json({ poll });
}));

// POST /api/polls/:pollId/vote — vote in a poll
router.post('/polls/:pollId/vote', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { optionIndex } = req.body;
  const poll = await Poll.findById(req.params.pollId);
  if (!poll || !poll.isActive) return res.status(404).json({ error: 'Poll not found or expired' });
  if (optionIndex === undefined || optionIndex >= poll.options.length) {
    return res.status(400).json({ error: 'Invalid option' });
  }

  // Check if already voted (via user's votedPolls map)
  const user = await User.findById(req.user._id);
  const alreadyVoted = user.votedPolls.some(m => m.has(poll._id.toString()));
  if (alreadyVoted) return res.status(409).json({ error: 'Already voted in this poll' });

  poll.options[optionIndex].voteCount += 1;
  poll.totalVotes += 1;
  await poll.save();

  const voteMap = new Map([[poll._id.toString(), String(optionIndex)]]);
  await User.findByIdAndUpdate(req.user._id, { $push: { votedPolls: voteMap } });
  await updateIntensityScore(poll.postId);

  res.json({ poll });
}));


// ═══════════════════════════════════════════
// CHAT & STRIKE ROOMS
// ═══════════════════════════════════════════

// GET /api/rooms — list rooms
router.get('/rooms', requireAuth, asyncHandler(async (req, res) => {
  const { type, district } = req.query;
  const query = { isActive: true };
  if (type) query.type = type;
  if (district) query.district = district;

  const rooms = await ChatRoom.find(query)
    .sort({ memberCount: -1, createdAt: -1 })
    .lean();
  res.json({ rooms });
}));

// POST /api/rooms — create a room
router.post('/rooms', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { name, description, type = 'discussion', postId, district, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name required' });

  // Only one strike room per post
  if (type === 'strike' && postId) {
    const exists = await ChatRoom.findOne({ postId, type: 'strike', isActive: true });
    if (exists) return res.json({ room: exists, alreadyExists: true });
  }

  const room = await ChatRoom.create({
    name, description, type, postId, district, category,
    createdBy: req.auth.userId,
  });
  res.status(201).json({ room });
}));

// GET /api/rooms/:id — room + recent messages
router.get('/rooms/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const room = await ChatRoom.findOne({ _id: req.params.id, isActive: true });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const messages = await Message.find({ roomId: room._id, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ room, messages: messages.reverse() });
}));

// POST /api/rooms/:id/join — join a strike room
router.post('/rooms/:id/join', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const clerkId = req.auth.userId;
  const room = await ChatRoom.findOneAndUpdate(
    { _id: req.params.id, isActive: true, members: { $ne: clerkId } },
    { $addToSet: { members: clerkId }, $inc: { memberCount: 1 } },
    { new: true }
  );
  if (!room) return res.status(404).json({ error: 'Room not found or already joined' });

  // Track for user
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { joinedRooms: room._id } });
  await updateIntensityScore(room.postId);

  res.json({ success: true, memberCount: room.memberCount });
}));

// POST /api/rooms/:id/leave — leave a room (ephemeral: delete user's messages)
router.post('/rooms/:id/leave', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const clerkId = req.auth.userId;
  const alias = generateChatAlias(clerkId, req.params.id);

  // Delete user's messages from this room (ephemeral policy)
  await Message.updateMany(
    { roomId: req.params.id, senderAlias: alias },
    { isDeleted: true }
  );

  // Remove from members
  await ChatRoom.findByIdAndUpdate(req.params.id, {
    $pull: { members: clerkId },
    $inc: { memberCount: -1 },
  });

  await User.findByIdAndUpdate(req.user._id, { $pull: { joinedRooms: req.params.id } });
  res.json({ success: true });
}));

// DELETE /api/rooms/:id — delete room + all messages (admin or creator)
router.delete('/rooms/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const room = await ChatRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const isCreator = room.createdBy === req.auth.userId;
  const isAdmin = req.user.role === 'admin';
  if (!isCreator && !isAdmin) return res.status(403).json({ error: 'Permission denied' });

  // Delete all messages (ephemeral)
  await Message.deleteMany({ roomId: room._id });
  await ChatRoom.findByIdAndDelete(room._id);

  res.json({ success: true });
}));


// ═══════════════════════════════════════════
// AI ENDPOINTS
// ═══════════════════════════════════════════

// POST /api/ai/classify — classify image
router.post('/ai/classify',
  requireAuth, attachUser, aiLimiter,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Image required' });
    const base64 = req.file.buffer.toString('base64');
    const result = await classifyIssue(base64, req.file.mimetype, req.body.description || '');
    res.json(result);
  })
);

// POST /api/ai/rewrite — rewrite complaint description for clarity and professionalism
router.post('/ai/rewrite',
  requireAuth, attachUser, aiLimiter,
  asyncHandler(async (req, res) => {
    const { description } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const result = await rewriteComplaint(description);
    res.json({ rewrittenText: result });
  })
);

// POST /api/ai/generate-report — generate analytics report
router.post('/ai/generate-report', requireAuth, attachUser, requireRole('admin', 'department'), aiLimiter,
  asyncHandler(async (req, res) => {
    const { analyticsData } = req.body;
    const report = await generateReport(analyticsData);
    res.json({ report });
  })
);

// POST /api/ai/predict-risk — predict infrastructure risk zones
router.post('/ai/predict-risk', requireAuth, attachUser, requireRole('admin', 'department'), aiLimiter,
  asyncHandler(async (req, res) => {
    const historicalData = await Post.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: { district: '$district', category: '$category' }, count: { $sum: 1 }, avgSeverity: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ['$severity', 'critical'] }, then: 4 },
                  { case: { $eq: ['$severity', 'high'] }, then: 3 },
                  { case: { $eq: ['$severity', 'medium'] }, then: 2 },
                  { case: { $eq: ['$severity', 'low'] }, then: 1 },
                ], default: 1
              }
            }
          }
        }
      }
    ]);
    const predictions = await predictRiskZones(historicalData);
    res.json({ predictions });
  })
);

// GET /api/ai/gov-data/:district — open government infrastructure data
router.get('/ai/gov-data/:district', requireAuth, asyncHandler(async (req, res) => {
  const data = await fetchGovRoadData(req.params.district);
  res.json({ data, source: 'data.gov.in' });
}));


// ═══════════════════════════════════════════
// OFFICIAL CONTACTS
// ═══════════════════════════════════════════

// GET /api/contacts — all or by district
router.get('/contacts', requireAuth, asyncHandler(async (req, res) => {
  const { district, department } = req.query;
  const query = {};
  if (district) query.district = district;
  if (department) query.department = department;

  const contacts = await Contact.find(query).lean();
  res.json({ contacts });
}));

// GET /api/contacts/by-location?lat=&lng= — auto-detect district from GPS
router.get('/contacts/by-location', requireAuth, asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const geo = await reverseGeocode(parseFloat(lat), parseFloat(lng));
  const contacts = await Contact.find({ district: geo.district }).lean();

  res.json({ district: geo.district, address: geo.address, contacts });
}));


// ═══════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════

// GET /api/analytics/dashboard — overall stats
router.get('/analytics/dashboard', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const [
    totalPosts, resolvedPosts, criticalPosts,
    categoryBreakdown, districtBreakdown, recentPosts, topIntensity,
  ] = await Promise.all([
    Post.countDocuments({ isDeleted: false }),
    Post.countDocuments({ status: 'resolved', isDeleted: false }),
    Post.countDocuments({ severity: 'critical', isDeleted: false }),
    Post.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Post.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$district', count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    Post.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5).select('-anonToken').lean(),
    Post.find({ isDeleted: false }).sort({ intensityScore: -1 }).limit(5).select('-anonToken').lean(),
  ]);

  const resolutionRate = totalPosts ? Math.round((resolvedPosts / totalPosts) * 100) : 0;

  res.json({
    stats: { totalPosts, resolvedPosts, criticalPosts, resolutionRate },
    categoryBreakdown,
    districtBreakdown,
    recentPosts,
    topIntensity,
  });
}));

// GET /api/analytics/heatmap — GIS data for map clustering
router.get('/analytics/heatmap', requireAuth, asyncHandler(async (req, res) => {
  const points = await Post.find(
    { isDeleted: false, 'location.coordinates': { $exists: true } },
    { 'location.coordinates': 1, severity: 1, category: 1, status: 1 }
  ).lean();

  const heatmapData = points.map(p => ({
    lat: p.location.coordinates[1],
    lng: p.location.coordinates[0],
    severity: p.severity,
    category: p.category,
    status: p.status,
  }));

  res.json({ heatmapData });
}));

// GET /api/analytics/district/:name — district-specific stats
router.get('/analytics/district/:name', requireAuth, asyncHandler(async (req, res) => {
  const district = req.params.name;
  const [posts, contacts, govData] = await Promise.all([
    Post.aggregate([
      { $match: { district, isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 }, critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } } } }
    ]),
    Contact.find({ district }).lean(),
    fetchGovRoadData(district),
  ]);

  res.json({ district, categoryStats: posts, contacts, govData });
}));


// ═══════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════

// GET /api/admin/users — list users (admin only)
router.get('/admin/users', requireAuth, attachUser, requireRole('admin'), asyncHandler(async (req, res) => {
  const users = await User.find().select('-postTokens -commentTokens -likedPosts -votedPolls').lean();
  res.json({ users });
}));

// PATCH /api/admin/users/:id/role — change user role (admin only)
router.patch('/admin/users/:id/role', requireAuth, attachUser, requireRole('admin'), asyncHandler(async (req, res) => {
  const { role } = req.body;
  const validRoles = ['citizen', 'officer', 'department', 'admin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  await AuditLog.create({
    action: 'role_change', targetType: 'user', targetId: user._id,
    performedBy: req.auth.userId, details: { newRole: role }
  });

  res.json({ success: true, user });
}));

// DELETE /api/admin/posts/:id — hard delete (admin)
router.delete('/admin/posts/:id', requireAuth, attachUser, requireRole('admin'), asyncHandler(async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  await AuditLog.create({
    action: 'post_deleted', targetType: 'post', targetId: req.params.id,
    performedBy: req.auth.userId
  });
  res.json({ success: true });
}));

module.exports = router;
