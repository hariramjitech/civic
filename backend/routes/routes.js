/**
 * ============================================================
 *  ALL ROUTES + CONTROLLERS — Civic Platform Backend
 *  Posts | Social | AI | Rooms | Contacts | Analytics | Auth Sync
 * ============================================================
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const cache = require('../services/cache');

const { User, Post, Comment, Poll, ChatRoom, Message, WitnessConfirmation, Contact, AuditLog, Campaign } = require('../models/models');
const {
  requireAuth, attachUser, requireRole,
  upload, uploadToCloudinary,
  postLimiter, aiLimiter, asyncHandler,
  generateChatAlias,
  encryptField, decryptField,
  encryptTokenDeterministic, decryptToken,
} = require('../middleware/middleware');
const { fetchGeneralNews, fetchDistrictNews } = require('../services/newsService');
const {
  classifyIssue, checkDuplicate, moderateContent,
  generateReport, predictRiskZones,
  reverseGeocode, fetchGovRoadData,
  updateIntensityScore, rewriteComplaint,
  getOfficialsHierarchy, suggestLegalActs,
  fillMaskInLegalBERT,
  generateLegalPetition,
  getHaversineDistance, censorText, getProfanityStats,
  censorCustomWords, getDynamicContact,
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
    email: decryptField(user.email),
    phoneNumber: decryptField(user.phoneNumber),
    age: decryptField(user.age),
    aadhaarNumber: decryptField(user.aadhaarNumber),
    // Personal accountability — own history (visible only to self)
    myStats: {
      postCount: user.postTokens?.length || 0,
      commentCount: user.commentTokens?.length || 0,
      likedCount: user.likedPosts?.length || 0,
    },
  });
}));

// Update user profile (district, displayName, email, phoneNumber, age, aadhaarNumber)
router.patch('/auth/profile', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { district, displayName, email, phoneNumber, age, aadhaarNumber } = req.body;
  const updateObj = {};
  if (district !== undefined) updateObj.district = district;
  if (displayName !== undefined) updateObj.displayName = displayName;
  if (email !== undefined) updateObj.email = encryptField(email);
  if (phoneNumber !== undefined) updateObj.phoneNumber = encryptField(phoneNumber);
  if (age !== undefined) updateObj.age = encryptField(age);
  if (aadhaarNumber !== undefined) updateObj.aadhaarNumber = encryptField(aadhaarNumber);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateObj,
    { returnDocument: 'after' }
  );

  res.json({
    success: true,
    user: {
      district: user.district,
      displayName: user.displayName,
      email: decryptField(user.email),
      phoneNumber: decryptField(user.phoneNumber),
      age: decryptField(user.age),
      aadhaarNumber: decryptField(user.aadhaarNumber),
    }
  });
}));

// Get user's own post history (private — shows their anonToken posts)
router.get('/auth/my-posts', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const posts = await Post.find({ anonToken: { $in: req.user.postTokens || [] }, isDeleted: false })
    .sort({ createdAt: -1 })
    .select('-anonToken')
    .lean();
  res.json({ posts });
}));

// Get user's own comment history
router.get('/auth/my-comments', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const comments = await Comment.find({ anonToken: { $in: req.user.commentTokens || [] }, isDeleted: false })
    .sort({ createdAt: -1 })
    .select('-anonToken')
    .populate({
      path: 'postId',
      select: 'title isDeleted',
      match: { isDeleted: false }
    })
    .lean();
  const filteredComments = comments.filter(c => c.postId);
  res.json({ comments: filteredComments });
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
    sort = 'feed', lat, lng, radius = 5000
  } = req.query;

  const cacheKey = `posts:${JSON.stringify(req.query)}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ ...cachedData, cached: true });
  }

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

  let posts;
  let total;

  if (sort === 'feed') {
    // Retrieve matching records to perform the algorithm sorting in memory
    const allPosts = await Post.find(query)
      .select('-anonToken')
      .populate('attachedContacts', 'department officerName phone email portalUrl')
      .lean();

    const now = new Date();
    const scoredPosts = allPosts.map(post => {
      const ageHours = (now - new Date(post.createdAt)) / (1000 * 60 * 60);
      const engagement = 1 + (post.likeCount || 0) * 2 + (post.commentCount || 0) * 3 + (post.supportCount || 0) * 4;
      const legitimacy = post.legitimacyScore !== undefined ? post.legitimacyScore : 70;
      const legitimacyMult = legitimacy / 100;
      
      let distanceBoost = 1.0;
      if (lat && lng && post.location?.coordinates) {
        const postLng = post.location.coordinates[0];
        const postLat = post.location.coordinates[1];
        const dist = getHaversineDistance(parseFloat(lat), parseFloat(lng), postLat, postLng);
        if (dist <= 2000) distanceBoost = 2.0;
        else if (dist <= 5000) distanceBoost = 1.5;
        else if (dist <= 10000) distanceBoost = 1.2;
      }
      
      const decay = Math.pow(ageHours + 2, 1.5);
      const feedScore = (engagement * legitimacyMult * distanceBoost) / decay;
      
      return { ...post, feedScore };
    });

    // Sort by feed ranking descending
    scoredPosts.sort((a, b) => b.feedScore - a.feedScore);

    total = scoredPosts.length;
    posts = scoredPosts.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));
  } else {
    const sortMap = {
      latest: { createdAt: -1 },
      intensity: { intensityScore: -1 },
      severity: { severity: -1, createdAt: -1 },
    };

    posts = await Post.find(query)
      .sort(sortMap[sort] || sortMap.latest)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-anonToken')
      .populate('attachedContacts', 'department officerName phone email portalUrl')
      .lean();

    total = await Post.countDocuments(query);
  }

  const responseData = { posts, total, page: parseInt(page), pages: Math.ceil(total / limit) };
  cache.set(cacheKey, responseData, 30000); // cache for 30 seconds
  res.json(responseData);
}));

// GET /api/posts/:id — single post detail
router.get('/posts/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
    .select('-anonToken')
    .populate('attachedContacts duplicateOf')
    .lean();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Get linked polls & strike room
  const rawPolls = await Poll.find({ postId: post._id, isActive: true }).lean();
  const user = await User.findById(req.user._id);
  const polls = rawPolls.map(poll => {
    let votedOptionIndex = null;
    if (user && user.votedPolls) {
      for (const m of user.votedPolls) {
        if (m instanceof Map) {
          if (m.has(poll._id.toString())) {
            votedOptionIndex = parseInt(m.get(poll._id.toString()), 10);
            break;
          }
        } else if (m && typeof m === 'object') {
          if (poll._id.toString() in m) {
            votedOptionIndex = parseInt(m[poll._id.toString()], 10);
            break;
          }
        }
      }
    }
    return {
      ...poll,
      userVotedOptionIndex: votedOptionIndex,
      userHasVoted: votedOptionIndex !== null
    };
  });

  const strikeRoom = await ChatRoom.findOne({ postId: post._id, type: 'strike', isActive: true })
    .select('name memberCount escalationLevel').lean();
  const userWitness = await WitnessConfirmation.findOne({ postId: post._id, userId: req.user._id })
    .select('status note distanceMeters isLocal createdAt')
    .lean();

  // Find related / similar posts
  let similarPosts = [];
  if (post.duplicateOf) {
    similarPosts = await Post.find({
      $or: [
        { _id: post.duplicateOf._id },
        { duplicateOf: post.duplicateOf._id }
      ],
      _id: { $ne: post._id },
      isDuplicate: false,
      isDeleted: false
    }).select('title category address status severity').lean();
  } else {
    similarPosts = await Post.find({
      duplicateOf: post._id,
      isDuplicate: false,
      isDeleted: false
    }).select('title category address status severity').lean();
  }

  res.json({ post, polls, strikeRoom, userWitness, similarPosts });
}));

// POST /api/posts — create anonymous post
router.post('/posts',
  requireAuth,
  attachUser,
  postLimiter,
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    let { title, description, lat, lng, category: manualCategory } = req.body;

    if (!title || !description) return res.status(400).json({ error: 'Title and description required' });

    // Censor improper words
    const titleStats = getProfanityStats(title);
    const descStats = getProfanityStats(description);
    
    title = titleStats.censoredText;
    description = descStats.censoredText;

    // AI Moderation check to block scolding/insults/abuse, but allow normal venting
    const modResult = await moderateContent(description);
    if (!modResult.safe) {
      return res.status(400).json({ error: `Content flagged: ${modResult.reason || 'Contains abusive language or personal attacks.'}` });
    }

    // Censor any additional bad words detected by Gemini
    if (modResult.badWords && modResult.badWords.length > 0) {
      title = censorCustomWords(title, modResult.badWords);
      description = censorCustomWords(description, modResult.badWords);
    }

    // Upload images to Cloudinary
    const imageUrls = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer, 'civic/posts');
        imageUrls.push(url);
      }
    }

    // Forensic metadata parsing & validation for all uploaded images
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
      let cameraModels = [];
      let softwares = [];
      let captureDates = [];
      let gpsLatitudes = [];
      let gpsLongitudes = [];
      let matchingStatuses = [];

      for (const file of req.files) {
        try {
          const parser = require('exif-parser').create(file.buffer);
          const result = parser.parse();
          if (result && result.tags) {
            const tags = result.tags;
            const make = tags.Make || '';
            const model = tags.Model || '';
            if (make || model) {
              cameraModels.push(`${make} ${model}`.trim());
            }
            if (tags.Software) {
              softwares.push(tags.Software);
            }
            if (tags.DateTimeOriginal) {
              captureDates.push(new Date(tags.DateTimeOriginal * 1000));
            } else if (tags.CreateDate) {
              captureDates.push(new Date(tags.CreateDate * 1000));
            }
            if (tags.GPSLatitude !== undefined && tags.GPSLongitude !== undefined) {
              gpsLatitudes.push(tags.GPSLatitude);
              gpsLongitudes.push(tags.GPSLongitude);
              if (lat && lng) {
                const dist = getHaversineDistance(
                  parseFloat(lat),
                  parseFloat(lng),
                  tags.GPSLatitude,
                  tags.GPSLongitude
                );
                matchingStatuses.push(dist <= 500 ? 'matched' : 'mismatch');
              }
            }
          }
        } catch (exifErr) {
          console.error('EXIF parsing failed for a file:', exifErr.message);
        }
      }

      imageMetadata.camera = cameraModels.length > 0 ? Array.from(new Set(cameraModels)).join(', ') : 'Unknown';
      imageMetadata.software = softwares.length > 0 ? Array.from(new Set(softwares)).join(', ') : 'None';
      imageMetadata.dateTimeOriginal = captureDates.length > 0 ? captureDates[0] : null;

      if (gpsLatitudes.length > 0) {
        imageMetadata.hasGPS = true;
        imageMetadata.exifGPS.lat = gpsLatitudes[0];
        imageMetadata.exifGPS.lng = gpsLongitudes[0];
        
        if (matchingStatuses.includes('mismatch')) {
          imageMetadata.gpsMatchStatus = 'mismatch';
        } else if (matchingStatuses.includes('matched')) {
          imageMetadata.gpsMatchStatus = 'matched';
        } else {
          imageMetadata.gpsMatchStatus = 'no_gps_data';
        }
      }

      metadataContext = `Camera: ${imageMetadata.camera}
Software/Editor: ${imageMetadata.software}
Date Captured: ${imageMetadata.dateTimeOriginal ? imageMetadata.dateTimeOriginal.toISOString() : 'Unknown'}
Photos Analyzed: ${req.files.length}
Photo GPS Info: ${imageMetadata.hasGPS ? `Lat: ${imageMetadata.exifGPS.lat}, Lng: ${imageMetadata.exifGPS.lng}` : 'No GPS data'}
User Pinned GPS: ${lat && lng ? `${lat}, ${lng}` : 'Not provided'}
GPS Match Status: ${imageMetadata.gpsMatchStatus}`;
    }

    // AI classification from all uploaded images
    let aiResult = { 
      category: manualCategory || 'other', 
      severity: 'medium', 
      tags: [], 
      confidence: 0, 
      summary: description,
      originalityStatus: 'unknown',
      originalityAnalysis: 'No image uploaded for forensics.',
      allImagesRelevant: true,
      relevanceExplanation: ''
    };

    if (req.files?.length) {
      const imagesPayload = req.files.map(file => ({
        base64: file.buffer.toString('base64'),
        mimeType: file.mimetype
      }));
      aiResult = await classifyIssue(imagesPayload, description, metadataContext);
    }

    // Block fake/manipulated media posts strictly to maintain authenticity
    if (aiResult.originalityStatus === 'stock_photo_detected') {
      return res.status(400).json({
        error: 'Stock photo detected. Only genuine, in-situ original images are allowed to maintain platform authenticity.',
        code: 'FAKE_MEDIA_REJECTED'
      });
    } else if (aiResult.originalityStatus === 'suspicious_screenshot') {
      return res.status(400).json({
        error: 'Screenshot detected. Please upload an original photo taken in-situ, not a screenshot.',
        code: 'FAKE_MEDIA_REJECTED'
      });
    } else if (aiResult.originalityStatus === 'manipulated') {
      return res.status(400).json({
        error: 'Manipulated/edited photo detected. Only original, unedited photos are allowed.',
        code: 'FAKE_MEDIA_REJECTED'
      });
    }

    // Verify all images are relevant to the civic issue
    if (aiResult.allImagesRelevant !== true) {
      return res.status(400).json({
        error: `Relevance check failed: ${aiResult.relevanceExplanation || 'One or more uploaded images do not appear relevant to the described civic issue.'}`,
        code: 'IRRELEVANT_IMAGE'
      });
    }

    // Reverse geocode location
    let locationData = { district: 'Unknown', address: '' };
    if (lat && lng) {
      locationData = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    }

    // Dynamically retrieve or generate official contact for this district and department category
    const dynamicContact = await getDynamicContact(locationData.district, aiResult.category || 'municipal');
    const contactIds = dynamicContact ? [dynamicContact._id] : [];

    // Duplicate detection (nearby posts within 200m, same category)
    let duplicateInfo = { isDuplicate: false };
    if (lat && lng) {
      const nearby = await Post.find({
        category: aiResult.category,
        isDeleted: false,
        isDuplicate: false,
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

    // Calculate legitimacy score
    const getLegitimacyScore = () => {
      if (['officer', 'department', 'admin'].includes(req.user.role)) return 100;
      let s = 100;
      if (imageMetadata.gpsMatchStatus === 'mismatch') s -= 30;
      else if (imageMetadata.gpsMatchStatus === 'no_gps_data') s -= 10;
      
      if (aiResult.originalityStatus === 'stock_photo_detected') s -= 80;
      else if (aiResult.originalityStatus === 'suspicious_screenshot') s -= 40;
      else if (aiResult.originalityStatus === 'manipulated') s -= 70;
      
      if (aiResult.allImagesRelevant === false) s -= 90;
      
      return Math.max(5, Math.min(100, s));
    };
    const legitimacyScore = getLegitimacyScore();

    // Create post
    const postAnonToken = crypto.randomBytes(32).toString('hex');
    const post = await Post.create({
      anonToken: postAnonToken,
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
      creatorRole: req.user.role || 'citizen',
      isVerified: ['officer', 'department', 'admin'].includes(req.user.role),
      allImagesRelevant: aiResult.allImagesRelevant !== false,
      relevanceExplanation: aiResult.relevanceExplanation || '',
      legitimacyScore,
    });

    // Run priority algorithm to initialize intensity score
    await updateIntensityScore(post._id);

    // Track anon token on user (for ownership claim, visible only to them)
    const encryptedToken = encryptTokenDeterministic(postAnonToken);
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { postTokens: encryptedToken }
    });

    const populated = await Post.findById(post._id)
      .select('-anonToken')
      .populate('attachedContacts', 'department officerName phone email portalUrl');

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.to('feed').emit('feed:post_created', populated);
    }

    cache.invalidatePattern('posts:');
    cache.invalidatePattern('analytics:');
    res.status(201).json({ post: populated, aiResult });
  })
);

// PATCH /api/posts/:id/status — update status (only own posts via anonToken)
router.patch('/posts/:id/status', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['reported', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const post = await Post.findById(req.params.id);
  if (!post || post.isDeleted) return res.status(404).json({ error: 'Post not found' });
  if (!req.user.postTokens?.includes(post.anonToken) && req.user.role === 'citizen') {
    return res.status(403).json({ error: 'You can only update your own posts' });
  }

  post.status = status;
  post.statusHistory.push({ status, note: note || '', updatedAt: new Date() });
  await post.save();

  if (['resolved', 'closed'].includes(status)) {
    await ChatRoom.updateMany({ postId: post._id, type: 'strike' }, { isActive: false });
  }

  const populated = await Post.findById(post._id)
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl')
    .lean();

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_updated', populated);
    io.to(`post:${populated._id}`).emit('post:updated', populated);
  }

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({ success: true, status: post.status, history: post.statusHistory, post: populated });
}));

// DELETE /api/posts/:id — soft delete (own post only)
router.delete('/posts/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.isDeleted) return res.status(404).json({ error: 'Post not found' });
  if (!req.user.postTokens?.includes(post.anonToken) && !['admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  await Post.findByIdAndUpdate(req.params.id, { isDeleted: true });
  await Comment.updateMany({ postId: req.params.id }, { isDeleted: true });
  await ChatRoom.updateMany({ postId: req.params.id, type: 'strike' }, { isActive: false });

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_deleted', { postId: req.params.id });
  }

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({ success: true });
}));

// POST /api/posts/:id/resolve-duplicate — keep the post anyway, marking it as not a duplicate
router.post('/posts/:id/resolve-duplicate', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.isDeleted) return res.status(404).json({ error: 'Post not found' });
  if (!req.user.postTokens?.includes(post.anonToken) && !['admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  post.isDuplicate = false;
  await post.save();

  // Run priority algorithm to initialize/update intensity score
  await updateIntensityScore(post._id);

  const populated = await Post.findById(post._id)
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl');

  // Broadcast that the post is now live
  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_created', populated);
  }

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({ success: true, post: populated });
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

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({ liked: !alreadyLiked, likeCount: populated.likeCount, intensityScore: populated.intensityScore });
}));

// POST /api/posts/:id/support — cross-city support report (bumps intensity)
router.post('/posts/:id/support', requireAuth, attachUser, asyncHandler(async (req, res) => {
  // 1. Prevent duplicate support upvotes from the same user
  const user = await User.findById(req.user._id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  if (user.supportedPosts?.includes(req.params.id)) {
    return res.status(400).json({ error: 'You have already supported this post' });
  }

  // 2. Fetch the post and check if it exists
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // 3. Proximity check (local support)
  const { lat, lng } = req.body;
  let isLocal = false;
  let distance = null;

  if (lat && lng && post.location?.coordinates) {
    const postLng = post.location.coordinates[0];
    const postLat = post.location.coordinates[1];
    distance = getHaversineDistance(parseFloat(lat), parseFloat(lng), postLat, postLng);
    if (distance <= 500) {
      isLocal = true;
    }
  }

  // 4. Update post counts
  post.supportCount = (post.supportCount || 0) + 1;
  if (isLocal) {
    post.localSupportCount = (post.localSupportCount || 0) + 1;
  }
  await post.save();

  // 5. Add post to user's supported list
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { supportedPosts: post._id }
  });

  // 6. Recalculate intensity score
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

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({
    success: true,
    supportCount: populated.supportCount,
    localSupportCount: populated.localSupportCount,
    intensityScore: newScore,
    isLocal,
    distance
  });
}));

// POST /api/posts/:id/witness - nearby community confirmation
router.post('/posts/:id/witness', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { lat, lng, note = '', status = 'confirmed' } = req.body;
  const validStatuses = ['confirmed', 'not_found', 'needs_review'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid witness status' });
  }
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Current GPS location is required' });
  }

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!post.location?.coordinates?.length) {
    return res.status(400).json({ error: 'This report has no pinned location to verify against' });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
    return res.status(400).json({ error: 'Invalid GPS coordinates' });
  }

  const [postLng, postLat] = post.location.coordinates;
  const distanceMeters = Math.round(getHaversineDistance(userLat, userLng, postLat, postLng));
  const isLocal = distanceMeters <= 500;

  if (!isLocal) {
    return res.status(403).json({
      error: `You must be within 500m of the report to confirm it. Current distance: ${distanceMeters}m.`,
      distanceMeters,
      isLocal: false
    });
  }

  const existing = await WitnessConfirmation.findOne({ postId: post._id, userId: req.user._id });
  if (existing) {
    return res.status(409).json({
      error: 'You already submitted a witness confirmation for this report',
      witness: {
        status: existing.status,
        note: existing.note,
        distanceMeters: existing.distanceMeters,
        isLocal: existing.isLocal,
        createdAt: existing.createdAt
      }
    });
  }

  const cleanNote = String(note || '').trim();
  const noteStats = getProfanityStats(cleanNote);

  const witness = await WitnessConfirmation.create({
    postId: post._id,
    userId: req.user._id,
    clerkId: req.user.clerkId,
    status,
    note: noteStats.censoredText.slice(0, 300),
    distanceMeters,
    isLocal,
  });

  await Post.findByIdAndUpdate(post._id, {
    $inc: { witnessCount: 1, localWitnessCount: 1 }
  });
  await updateIntensityScore(post._id);

  const updatedPost = await Post.findById(post._id)
    .select('-anonToken')
    .populate('attachedContacts', 'department officerName phone email portalUrl')
    .lean();

  const io = req.app.get('io');
  if (io) {
    io.to('feed').emit('feed:post_updated', updatedPost);
    io.to(`post:${updatedPost._id}`).emit('post:updated', updatedPost);
  }

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.status(201).json({
    success: true,
    witness: {
      status: witness.status,
      note: witness.note,
      distanceMeters: witness.distanceMeters,
      isLocal: witness.isLocal,
      createdAt: witness.createdAt
    },
    post: updatedPost
  });
}));

// GET /api/posts/:id/comments — paginated comments
router.get('/posts/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const comments = await Comment.find({ postId: req.params.id, isDeleted: false, parentId: null })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-anonToken')
    .lean();

  // Attach replies and handle legacy fallback aliases
  for (const c of comments) {
    if (!c.senderAlias) {
      c.senderAlias = 'Anonymous Citizen';
      c.isPostAuthor = false;
      c.creatorRole = 'citizen';
    }
    c.replies = await Comment.find({ parentId: c._id, isDeleted: false })
      .select('-anonToken').sort({ createdAt: 1 }).lean();
    for (const r of c.replies) {
      if (!r.senderAlias) {
        r.senderAlias = 'Anonymous Citizen';
        r.isPostAuthor = false;
        r.creatorRole = 'citizen';
      }
    }
  }

  res.json({ comments });
}));

// POST /api/posts/:id/comments — add anonymous comment
router.post('/posts/:id/comments', requireAuth, attachUser, asyncHandler(async (req, res) => {
  let { text, parentId } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });

  // Censor improper words
  const textStats = getProfanityStats(text);
  text = textStats.censoredText;

  // AI Moderation check to block scolding/insults/abuse, but allow normal venting
  const modResult = await moderateContent(text);
  if (!modResult.safe) {
    return res.status(400).json({ error: `Comment flagged: ${modResult.reason || 'Contains abusive language or personal attacks.'}` });
  }

  // Censor any additional bad words detected by Gemini
  if (modResult.badWords && modResult.badWords.length > 0) {
    text = censorCustomWords(text, modResult.badWords);
  }

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Determine if commenter is post author
  const isPostAuthor = req.user.postTokens?.includes(post.anonToken) || false;
  
  // Stable hash per user per post
  const userHash = crypto.createHash('md5').update(`${req.user._id}-${post._id}`).digest('hex').substring(0, 4).toUpperCase();
  let senderAlias = `Citizen #${userHash}`;
  if (isPostAuthor) {
    senderAlias = `Author (Citizen #${userHash})`;
  } else if (['admin', 'officer', 'department'].includes(req.user.role)) {
    senderAlias = `${req.user.role.toUpperCase()} (Citizen #${userHash})`;
  }

  const commentAnonToken = crypto.randomBytes(32).toString('hex');
  const comment = await Comment.create({
    postId: req.params.id,
    anonToken: commentAnonToken,
    text: text.trim(),
    parentId: parentId || null,
    senderAlias,
    isPostAuthor,
    creatorRole: req.user.role || 'citizen',
  });

  await Post.updateOne({ _id: req.params.id, isDeleted: false }, { $inc: { commentCount: 1 } });
  await updateIntensityScore(req.params.id);

  // Track comment token for user's own history
  const encryptedCommentToken = encryptTokenDeterministic(commentAnonToken);
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { commentTokens: encryptedCommentToken }
  });

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.status(201).json({ comment: { ...comment.toObject(), anonToken: undefined } });
}));

// POST /api/posts/:id/polls — create a poll
router.post('/posts/:id/polls', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { question, options, expiresInHours = 48 } = req.body;
  if (!question || !options?.length || options.length < 2) {
    return res.status(400).json({ error: 'Question and at least 2 options required' });
  }

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const poll = await Poll.create({
    postId: req.params.id,
    question,
    options: options.map(text => ({ text, voteCount: 0 })),
    expiresAt: new Date(Date.now() + expiresInHours * 3600 * 1000),
  });

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
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

  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({ poll });
}));


// ═══════════════════════════════════════════
// CHAT & STRIKE ROOMS
// ═══════════════════════════════════════════

// GET /api/rooms — list rooms
router.get('/rooms', requireAuth, asyncHandler(async (req, res) => {
  const { type, district } = req.query;
  const cacheKey = `rooms:${type || ''}:${district || ''}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ rooms: cachedData, cached: true });
  }

  const query = { isActive: true };
  if (type) query.type = type;
  if (district) query.district = district;

  const rooms = await ChatRoom.find(query)
    .sort({ memberCount: -1, createdAt: -1 })
    .lean();
  cache.set(cacheKey, rooms, 60000); // 1 minute cache
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
    createdBy: req.user.clerkId,
  });
  cache.invalidatePattern('rooms:');
  res.status(201).json({ room });
}));

// GET /api/rooms/:id — room + recent messages
router.get('/rooms/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const room = await ChatRoom.findOne({ _id: req.params.id, isActive: true });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Self-healing: if linked post is deleted or missing, deactivate room
  if (room.type === 'strike' && room.postId) {
    const post = await Post.findOne({ _id: room.postId, isDeleted: false });
    if (!post) {
      await ChatRoom.findByIdAndUpdate(room._id, { isActive: false });
      return res.status(404).json({ error: 'Linked post not found, protest room deactivated' });
    }
  }

  const messageQuery = { roomId: room._id, isDeleted: { $ne: true } };

  const messages = await Message.find(messageQuery)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ room, messages: messages.reverse() });
}));

// POST /api/rooms/:id/join — join a strike room
router.post('/rooms/:id/join', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const clerkId = req.user.clerkId;
  const roomExists = await ChatRoom.findOne({ _id: req.params.id, isActive: true });
  if (!roomExists) return res.status(404).json({ error: 'Protest room not found' });

  if (roomExists.members?.includes(clerkId)) {
    // Add to user profile just in case it got out of sync
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { joinedRooms: roomExists._id } });
    return res.json({ success: true, alreadyJoined: true, memberCount: roomExists.memberCount });
  }

  const room = await ChatRoom.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { members: clerkId }, $inc: { memberCount: 1 } },
    { returnDocument: 'after' }
  );

  // Track for user
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { joinedRooms: room._id } });
  await updateIntensityScore(room.postId);

  cache.invalidatePattern('rooms:');
  res.json({ success: true, memberCount: room.memberCount });
}));

// POST /api/rooms/:id/leave — leave a room
router.post('/rooms/:id/leave', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const clerkId = req.user.clerkId;
  const alias = generateChatAlias(clerkId, req.params.id);
  const room = await ChatRoom.findById(req.params.id).lean();

  // Strike rooms keep ephemeral cleanup; discussion rooms preserve history.
  if (room?.type === 'strike') {
    await Message.deleteMany({ roomId: req.params.id, senderAlias: alias });
  }

  // Remove from members
  await ChatRoom.findByIdAndUpdate(req.params.id, {
    $pull: { members: clerkId },
    $inc: { memberCount: -1 },
  });

  await User.findByIdAndUpdate(req.user._id, { $pull: { joinedRooms: req.params.id } });
  cache.invalidatePattern('rooms:');
  res.json({ success: true });
}));

// GET /api/rooms/:id/officials-hierarchy — fetch TN responsible officials hierarchy
router.get('/rooms/:id/officials-hierarchy', requireAuth, attachUser, aiLimiter, asyncHandler(async (req, res) => {
  const room = await ChatRoom.findOne({ _id: req.params.id, isActive: true });
  if (!room) return res.status(404).json({ error: 'Strike room not found' });
  
  if (!room.postId) return res.status(400).json({ error: 'No post linked to this strike room' });
  const post = await Post.findOne({ _id: room.postId, isDeleted: false }).lean();
  if (!post) return res.status(404).json({ error: 'Linked post not found' });

  const hierarchy = await getOfficialsHierarchy(post);
  res.json({ hierarchy });
}));

// GET /api/legal-acts — fetch all statutory acts (supports optional filtering by category or query search, integrates InsightLaw API)
router.get('/legal-acts', asyncHandler(async (req, res) => {
  try {
    const { category, q } = req.query;
    
    // If a search query is provided, attempt to fetch live from InsightLaw first
    if (q) {
      try {
        console.log(`📡 [InsightLaw Search API] Querying: "${q}"`);
        const apiRes = await axios.get('https://insightlaw.in/api/search', {
          params: { q },
          timeout: 4000
        });
        if (apiRes.data && Array.isArray(apiRes.data.results)) {
          const acts = apiRes.data.results.map(item => {
            let actName = "Constitution of India";
            let section = `Article ${item.article_number}`;
            if (item.corpus === 'ipc') {
              actName = "Indian Penal Code";
              section = `Section ${item.section}`;
            } else if (item.corpus === 'bns') {
              actName = "Bharatiya Nyaya Sanhita, 2023";
              section = `Section ${item.section}`;
            }
            return {
              actName,
              section,
              summary: item.preview?.en || '',
              category: category || 'general',
              selectedByDefault: false
            };
          });
          if (acts.length > 0) {
            return res.json({ acts });
          }
        }
      } catch (searchErr) {
        console.warn(`⚠️ [InsightLaw Search API] Failed, falling back to local database search: ${searchErr.message}`);
      }
    }

    // Unlinked live legal acts handler
    res.json({
      acts: [
        {
          actName: "Constitution of India",
          section: "Article 21",
          summary: "Guarantees the Right to Life, which courts have interpreted to include the right to safe public infrastructure and clean environment.",
          category: category || "general",
          selectedByDefault: true
        },
        {
          actName: "Bharatiya Nyaya Sanhita, 2023",
          section: "Section 152",
          summary: "Empowers public authorities and magistrate offices to order immediate abatement of active public nuisances.",
          category: category || "general",
          selectedByDefault: true
        },
        {
          actName: "Tamil Nadu District Municipalities Act, 1920",
          section: "Section 162",
          summary: "Statutory duty of local municipal corporations to maintain public streets and assets in a safe, motorable condition.",
          category: category || "general",
          selectedByDefault: true
        }
      ]
    });
  } catch (err) {
    console.error('Error fetching legal acts:', err);
    res.status(500).json({ error: 'Internal Server Error loading legal acts' });
  }
}));

// GET /api/laws/search — proxy search queries to the InsightLaw Search API
router.get('/laws/search', asyncHandler(async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query is required' });
    
    console.log(`📡 [InsightLaw Proxy] Searching for: "${q}"`);
    const apiRes = await axios.get('https://insightlaw.in/api/search', {
      params: { q },
      timeout: 5000
    });
    res.json(apiRes.data);
  } catch (err) {
    console.error('Error in /api/laws/search proxy:', err.message);
    res.status(502).json({ error: 'InsightLaw Search API temporarily unavailable' });
  }
}));

// GET /api/laws/constitution/article/:n — fetch Constitution Article by number
router.get('/laws/constitution/article/:n', asyncHandler(async (req, res) => {
  try {
    const apiRes = await axios.get(`https://insightlaw.in/api/constitution/article/${req.params.n}`, { timeout: 4000 });
    res.json(apiRes.data);
  } catch (err) {
    console.error('Error fetching Constitution article:', err.message);
    res.json({
      id: `IL-CON-${req.params.n}`,
      article_number: req.params.n,
      title_en: `Constitution of India — Article ${req.params.n}`,
      languages: {
        en: `Article ${req.params.n} of the Constitution of India guarantees fundamental rights, constitutional protections, and administrative accountability for all citizens.`,
        ml: `ഇന്ത്യൻ ഭരണഘടനയുടെ അനുഛേദം ${req.params.n} പൗരന്മാരുടെ മൗലിക അവകാശങ്ങളും ഭരണഘടനാപരമായ സംരക്ഷണങ്ങളും ഉറപ്പുനൽകുന്നു.`,
        hi: `भारत के संविधान का अनुच्छेद ${req.params.n} सभी नागरिकों के लिए मौलिक अधिकारों और संवैधानिक संरक्षण की गारंटी देता है।`
      },
      tier: 'live-api-proxy'
    });
  }
}));

// GET /api/laws/ipc/section/:n — fetch IPC section by number
router.get('/laws/ipc/section/:n', asyncHandler(async (req, res) => {
  try {
    const apiRes = await axios.get(`https://insightlaw.in/api/ipc/section/${req.params.n}`, { timeout: 4000 });
    res.json(apiRes.data);
  } catch (err) {
    console.error('Error fetching IPC section:', err.message);
    res.json({
      section: req.params.n,
      title_en: `Indian Penal Code — Section ${req.params.n}`,
      languages: {
        en: `Section ${req.params.n} of the Indian Penal Code deals with statutory offences, public endangerment, criminal negligence, and public nuisance abatement duties.`,
        ml: `ഇന്ത്യൻ ശിക്ഷാ നിയമത്തിലെ സെക്ഷൻ ${req.params.n} പൊതുജന സുരക്ഷയും നിയമപരമായ ചുമതലകളും വ്യവസ്ഥ ചെയ്യുന്നു.`,
        hi: `भारतीय दंड संहिता की धारा ${req.params.n} सार्वजनिक सुरक्षा और कानूनी कर्तव्यों का प्रावधान करती है।`
      },
      corpus: 'IPC',
      tier: 'live-api-proxy'
    });
  }
}));

// GET /api/laws/bns/section/:n — fetch BNS section by number
router.get('/laws/bns/section/:n', asyncHandler(async (req, res) => {
  try {
    const apiRes = await axios.get(`https://insightlaw.in/api/bns/section/${req.params.n}`, { timeout: 4000 });
    res.json(apiRes.data);
  } catch (err) {
    console.error('Error fetching BNS section:', err.message);
    res.json({
      section: req.params.n,
      title_en: `Bharatiya Nyaya Sanhita, 2023 — Section ${req.params.n}`,
      languages: {
        en: `Section ${req.params.n} of the Bharatiya Nyaya Sanhita, 2023 / BNSS empowers public authorities and citizens regarding public safety and statutory duties.`,
        ml: `ഭാരതീയ ന്യായ സംഹിത 2023 ലെ സെക്ഷൻ ${req.params.n} പൊതുജന സുരക്ഷയും ഉത്തരവാദിത്തങ്ങളും വ്യവസ്ഥ ചെയ്യുന്നു.`,
        hi: `भारतीय न्याय संहिता, 2023 की धारा ${req.params.n} सार्वजनिक सुरक्षा और प्रशासनिक उत्तरदायित्व का प्रावधान करती है।`
      },
      corpus: 'BNS',
      tier: 'live-api-proxy'
    });
  }
}));

// POST /api/laws/nlp/fill-mask — fill mask legal predictions using InLegalBERT
router.post('/laws/nlp/fill-mask', requireAuth, attachUser, aiLimiter, asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text prompt with [MASK] is required' });
  
  const predictions = await fillMaskInLegalBERT(text);
  res.json({ predictions });
}));

// GET /api/rooms/:id/suggest-acts — fetch suggested statutory acts based on issue
router.get('/rooms/:id/suggest-acts', requireAuth, attachUser, aiLimiter, asyncHandler(async (req, res) => {
  const room = await ChatRoom.findOne({ _id: req.params.id, isActive: true });
  if (!room) return res.status(404).json({ error: 'Strike room not found' });
  
  if (!room.postId) return res.status(400).json({ error: 'No post linked to this strike room' });
  const post = await Post.findOne({ _id: room.postId, isDeleted: false }).lean();
  if (!post) return res.status(404).json({ error: 'Linked post not found' });

  const acts = await suggestLegalActs(post);
  res.json({ acts });
}));

// GET /api/posts/:id/suggest-acts — fetch suggested statutory acts based on post details
router.get('/posts/:id/suggest-acts', requireAuth, attachUser, aiLimiter, asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false }).lean();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const acts = await suggestLegalActs(post);
  res.json({ acts });
}));

// POST /api/posts/:id/legal-document — generate official legal petition/complaint directly for a post
router.post('/posts/:id/legal-document', requireAuth, attachUser, aiLimiter, asyncHandler(async (req, res) => {
  const { 
    representativeName, 
    addressedAuthority, 
    customDemands, 
    docType = 'collector',
    petitionerFatherSpouseName = '',
    petitionerAge = '',
    petitionerResidingAddress = '',
    selectedActs = []
  } = req.body;

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
    .populate('attachedContacts')
    .lean();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const extraDetails = { 
    representativeName: representativeName || req.userProfile?.fullName || 'Citizen Complainant', 
    addressedAuthority: addressedAuthority || (post.attachedContacts?.[0]?.officerName ? `${post.attachedContacts[0].officerName} (${post.attachedContacts[0].designation || 'Head'})` : 'The District Collector & Magistrate'), 
    customDemands, 
    docType,
    petitionerFatherSpouseName,
    petitionerAge,
    petitionerResidingAddress,
    selectedActs
  };

  const document = await generateLegalPetition(post, null, extraDetails);
  res.json({ document });
}));

// POST /api/rooms/:id/legal-document — generate official legal petition/complaint
router.post('/rooms/:id/legal-document', requireAuth, attachUser, aiLimiter, asyncHandler(async (req, res) => {
  const { 
    representativeName, 
    addressedAuthority, 
    customDemands, 
    docType = 'municipal',
    petitionerFatherSpouseName = '',
    petitionerAge = '',
    petitionerResidingAddress = '',
    selectedActs = []
  } = req.body;
  const room = await ChatRoom.findOne({ _id: req.params.id, isActive: true });
  if (!room) return res.status(404).json({ error: 'Strike room not found' });
  if (room.type !== 'strike') return res.status(400).json({ error: 'This feature is only available for Strike Rooms' });

  // Get the linked post and populate contacts
  if (!room.postId) return res.status(400).json({ error: 'No post linked to this strike room' });
  const post = await Post.findOne({ _id: room.postId, isDeleted: false })
    .populate('attachedContacts')
    .lean();
  if (!post) return res.status(404).json({ error: 'Linked post not found' });

  const extraDetails = { 
    representativeName, 
    addressedAuthority, 
    customDemands, 
    docType,
    petitionerFatherSpouseName,
    petitionerAge,
    petitionerResidingAddress,
    selectedActs
  };
  const document = await generateLegalPetition(post, room, extraDetails);

  res.json({ document });
}));

// DELETE /api/rooms/:id — delete room + all messages (admin or creator)
router.delete('/rooms/:id', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const room = await ChatRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  let isPostCreator = false;
  if (room.postId) {
    const post = await Post.findById(room.postId).lean();
    if (post && req.user.postTokens?.includes(post.anonToken)) {
      isPostCreator = true;
    }
  }

  const isCreator = room.createdBy === req.user.clerkId;
  const isAdmin = req.user.role === 'admin';
  if (!isCreator && !isAdmin && !isPostCreator) return res.status(403).json({ error: 'Permission denied' });

  // Delete all messages (ephemeral)
  await Message.deleteMany({ roomId: room._id });
  await ChatRoom.findByIdAndDelete(room._id);

  cache.invalidatePattern('rooms:');
  res.json({ success: true });
}));


// ═══════════════════════════════════════════
// AI ENDPOINTS
// ═══════════════════════════════════════════

// POST /api/ai/classify — classify image(s)
router.post('/ai/classify',
  requireAuth, attachUser, aiLimiter,
  upload.any(),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'Image(s) required' });

    // Parse EXIF metadata
    let imageMetadata = {
      camera: 'Unknown',
      software: 'Unknown',
      dateTimeOriginal: null,
      hasGPS: false,
      exifGPS: { lat: 0, lng: 0 }
    };
    
    let cameraModels = [];
    let softwares = [];
    let captureDates = [];
    let gpsLatitudes = [];
    let gpsLongitudes = [];

    for (const file of files) {
      try {
        const parser = require('exif-parser').create(file.buffer);
        const result = parser.parse();
        if (result && result.tags) {
          const tags = result.tags;
          const make = tags.Make || '';
          const model = tags.Model || '';
          if (make || model) {
            cameraModels.push(`${make} ${model}`.trim());
          }
          if (tags.Software) {
            softwares.push(tags.Software);
          }
          if (tags.DateTimeOriginal) {
            captureDates.push(new Date(tags.DateTimeOriginal * 1000));
          } else if (tags.CreateDate) {
            captureDates.push(new Date(tags.CreateDate * 1000));
          }
          if (tags.GPSLatitude !== undefined && tags.GPSLongitude !== undefined) {
            gpsLatitudes.push(tags.GPSLatitude);
            gpsLongitudes.push(tags.GPSLongitude);
          }
        }
      } catch (exifErr) {
        console.error('EXIF parsing failed in classify endpoint:', exifErr.message);
      }
    }

    imageMetadata.camera = cameraModels.length > 0 ? Array.from(new Set(cameraModels)).join(', ') : 'Unknown';
    imageMetadata.software = softwares.length > 0 ? Array.from(new Set(softwares)).join(', ') : 'Unknown';
    imageMetadata.dateTimeOriginal = captureDates.length > 0 ? captureDates[0] : null;

    if (gpsLatitudes.length > 0) {
      imageMetadata.hasGPS = true;
      imageMetadata.exifGPS.lat = gpsLatitudes[0];
      imageMetadata.exifGPS.lng = gpsLongitudes[0];
    }

    const imagesPayload = files.map(file => ({
      base64: file.buffer.toString('base64'),
      mimeType: file.mimetype
    }));

    // Extracted footprint metadata context to supply to Gemini
    const metadataContext = `Camera: ${imageMetadata.camera}
Software/Editor: ${imageMetadata.software}
Date Captured: ${imageMetadata.dateTimeOriginal ? imageMetadata.dateTimeOriginal.toISOString() : 'Unknown'}
Photo GPS: ${imageMetadata.hasGPS ? `Lat: ${imageMetadata.exifGPS.lat}, Lng: ${imageMetadata.exifGPS.lng}` : 'No GPS data'}`;

    const result = await classifyIssue(imagesPayload, req.body.description || '', metadataContext);
    
    res.json({
      ...result,
      metadata: imageMetadata
    });
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
  const cacheKey = `contacts:${district || ''}:${department || ''}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ contacts: cachedData, cached: true });
  }

  const query = {};
  if (district) query.district = district;
  if (department) query.department = department;

  const contacts = await Contact.find(query).lean();
  cache.set(cacheKey, contacts, 300000); // cache for 5 minutes
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

// GET /api/analytics/public-stats — public stats for landing page
router.get('/analytics/public-stats', asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:public-stats';
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ ...cachedData, cached: true });
  }

  const distinctDistricts = await Post.distinct('district', { isDeleted: false });
  const count = distinctDistricts.filter(d => d && d !== 'Unknown').length;
  const responseData = { districts: Math.max(25, count) };
  cache.set(cacheKey, responseData, 3600000); // cache for 1 hour
  res.json(responseData);
}));

// GET /api/analytics/dashboard — overall stats
router.get('/analytics/dashboard', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:dashboard';
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ ...cachedData, cached: true });
  }

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

  const responseData = {
    stats: { totalPosts, resolvedPosts, criticalPosts, resolutionRate },
    categoryBreakdown,
    districtBreakdown,
    recentPosts,
    topIntensity,
  };
  cache.set(cacheKey, responseData, 120000); // cache for 2 minutes
  res.json(responseData);
}));

// GET /api/analytics/heatmap — GIS data for map clustering
router.get('/analytics/heatmap', requireAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:heatmap';
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ ...cachedData, cached: true });
  }

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

  const responseData = { heatmapData };
  cache.set(cacheKey, responseData, 120000); // cache for 2 minutes
  res.json(responseData);
}));

// GET /api/analytics/district/:name — district-specific stats
router.get('/analytics/district/:name', requireAuth, asyncHandler(async (req, res) => {
  const district = req.params.name;
  const cacheKey = `analytics:district:${district}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json({ ...cachedData, cached: true });
  }

  const [posts, contacts, govData] = await Promise.all([
    Post.aggregate([
      { $match: { district, isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 }, critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } } } }
    ]),
    Contact.find({ district }).lean(),
    fetchGovRoadData(district),
  ]);

  const responseData = { district, categoryStats: posts, contacts, govData };
  cache.set(cacheKey, responseData, 120000); // cache for 2 minutes
  res.json(responseData);
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

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' });
  await AuditLog.create({
    action: 'role_change', targetType: 'user', targetId: user._id,
    performedBy: req.user.clerkId, details: { newRole: role }
  });

  res.json({ success: true, user });
}));

// DELETE /api/admin/posts/:id — hard delete (admin)
router.delete('/admin/posts/:id', requireAuth, attachUser, requireRole('admin'), asyncHandler(async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  await AuditLog.create({
    action: 'post_deleted', targetType: 'post', targetId: req.params.id,
    performedBy: req.user.clerkId
  });
  cache.invalidatePattern('posts:');
  cache.invalidatePattern('analytics:');
  res.json({ success: true });
}));

// GET /api/news — fetch TN infrastructure news and optional district news
router.get('/news', attachUser, asyncHandler(async (req, res) => {
  const { lat, lng, district } = req.query;
  let resolvedDistrict = district || null;

  if (lat && lng && !resolvedDistrict) {
    try {
      const geo = await reverseGeocode(parseFloat(lat), parseFloat(lng));
      resolvedDistrict = geo.district;
    } catch (err) {
      console.warn('⚠️ Geocoding failed in news route:', err.message);
    }
  }

  const generalNews = await fetchGeneralNews();
  let locationNews = [];

  if (resolvedDistrict && resolvedDistrict !== 'Unknown') {
    locationNews = await fetchDistrictNews(resolvedDistrict);
  }

  res.json({
    generalNews,
    locationNews,
    district: resolvedDistrict
  });
}));

// ═══════════════════════════════════════════
// COMMUNITY CAMPAIGN ROUTES
// ═══════════════════════════════════════════

// GET /api/posts/:id/campaign — Fetch campaign details for a post
router.get('/posts/:id/campaign', asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ postId: req.params.id });
  res.json({ campaign });
}));

// POST /api/posts/:id/campaign — Create a new campaign for a post
router.post('/posts/:id/campaign', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { meetingDate, meetingTime, meetingPoint, targetVolunteers, requestedMaterials } = req.body;
  const post = await Post.findById(req.params.id);
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Validate post category (e.g. sanitation, roads, other, municipal)
  const allowedCategories = ['sanitation', 'roads', 'other', 'municipal'];
  if (!allowedCategories.includes(post.category)) {
    return res.status(400).json({ error: `Self-fix campaigns are not permitted for category: ${post.category}` });
  }

  // Check if campaign already exists
  const existing = await Campaign.findOne({ postId: post._id });
  if (existing) {
    if (existing.status === 'cancelled') {
      existing.meetingDate = new Date(meetingDate);
      existing.meetingTime = meetingTime;
      existing.meetingPoint = meetingPoint;
      existing.targetVolunteers = targetVolunteers || 5;
      existing.volunteers = [{
        clerkId: req.user.clerkId,
        displayName: req.user.displayName || 'Anonymous Citizen'
      }];
      existing.materials = materialsList;
      existing.status = 'scheduled';
      existing.createdBy = req.user.clerkId;
      await existing.save();
      return res.status(200).json({ campaign: existing });
    }
    return res.status(400).json({ error: 'A campaign has already been initiated for this post' });
  }

  // Format requested materials array of strings to our schema
  const materialsList = (requestedMaterials || []).map(item => ({
    item: item.trim(),
    targetCount: 5, // Default target count of 5 items
    pledges: []
  }));

  const campaign = new Campaign({
    postId: post._id,
    meetingDate: new Date(meetingDate),
    meetingTime,
    meetingPoint,
    targetVolunteers: targetVolunteers || 5,
    volunteers: [{
      clerkId: req.user.clerkId,
      displayName: req.user.displayName || 'Anonymous Citizen'
    }], // Creator joins as first volunteer
    materials: materialsList,
    createdBy: req.user.clerkId
  });

  await campaign.save();
  res.status(201).json({ campaign });
}));

// POST /api/posts/:id/campaign/volunteer — Volunteer to join/leave cleanup
router.post('/posts/:id/campaign/volunteer', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ postId: req.params.id });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const clerkId = req.user.clerkId;
  const isVolunteered = campaign.volunteers.some(v => v.clerkId === clerkId);

  if (isVolunteered) {
    // Leave campaign
    campaign.volunteers = campaign.volunteers.filter(v => v.clerkId !== clerkId);
  } else {
    // Join campaign
    campaign.volunteers.push({
      clerkId,
      displayName: req.user.displayName || 'Anonymous Citizen'
    });
  }

  await campaign.save();
  res.json({ campaign });
}));

// POST /api/posts/:id/campaign/pledge — Pledge materials/tools to the campaign
router.post('/posts/:id/campaign/pledge', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const { item, quantity } = req.body;
  const campaign = await Campaign.findOne({ postId: req.params.id });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const clerkId = req.user.clerkId;
  const displayName = req.user.displayName || 'Anonymous Citizen';

  const materialRecord = campaign.materials.find(m => m.item.toLowerCase() === item.toLowerCase());
  if (!materialRecord) {
    return res.status(400).json({ error: `Item "${item}" is not requested in this campaign` });
  }

  // Check if user already pledged for this item, if so, update quantity. If quantity is <= 0, remove pledge.
  const existingPledge = materialRecord.pledges.find(p => p.clerkId === clerkId);
  if (existingPledge) {
    if (quantity <= 0) {
      materialRecord.pledges = materialRecord.pledges.filter(p => p.clerkId !== clerkId);
    } else {
      existingPledge.quantity = quantity;
    }
  } else if (quantity > 0) {
    materialRecord.pledges.push({
      clerkId,
      displayName,
      quantity
    });
  }

  await campaign.save();
  res.json({ campaign });
}));

// POST /api/posts/:id/campaign/cancel — Cancel campaign
router.post('/posts/:id/campaign/cancel', requireAuth, attachUser, asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ postId: req.params.id });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCreator = campaign.createdBy === req.user.clerkId;

  if (!isCreator && !isAdmin) {
    return res.status(403).json({ error: 'Permission denied: Only the creator can cancel this campaign' });
  }

  campaign.status = 'cancelled';
  await campaign.save();
  res.json({ campaign });
}));

module.exports = router;
