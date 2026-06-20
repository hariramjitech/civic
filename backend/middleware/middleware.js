/**
 * ============================================================
 *  middleware/middleware.js — All Express Middleware
 *  Clerk Auth | Anonymizer | Cloudinary Upload | Rate Limiting | RBAC | Error Handler
 * ============================================================
 */

const crypto = require('crypto');
const { requireAuth, clerkClient, getAuth } = require('@clerk/express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { User } = require('../models/models');

// ─────────────────────────────────────────────
// CLOUDINARY
// ─────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─────────────────────────────────────────────
// MULTER (memory → stream to Cloudinary)
// ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPEG / PNG / WEBP images are allowed'));
  },
});

const uploadToCloudinary = (buffer, folder = 'civic/posts') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });

// ─────────────────────────────────────────────
// ANONYMIZER  (one-way HMAC — irreversible)
// ─────────────────────────────────────────────
const generateAnonToken = (userId) =>
  crypto.createHmac('sha256', process.env.ANON_HMAC_SECRET).update(userId).digest('hex');

// Stable per-user per-room alias, e.g. "Citizen #7F3A"
const generateChatAlias = (userId, roomId) => {
  const hash = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `Citizen #${hash}`;
};

// ─────────────────────────────────────────────
// CLERK AUTH MIDDLEWARE
// ─────────────────────────────────────────────

// Blocks requests without a valid Clerk session
const clerkRequireAuth = (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Syncs Clerk user → MongoDB and attaches req.user + req.anonToken
const attachUser = async (req, res, next) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return next();

    let user = await User.findOne({ clerkId });
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
      user = await User.create({
        clerkId,
        email,
        displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous Citizen',
        avatar: clerkUser.imageUrl,
      });
    }

    req.user = user;
    req.anonToken = generateAnonToken(clerkId);
    next();
  } catch (err) {
    next(err);
  }
};

// Role-based access control
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
  next();
};

// ─────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { error: 'Too many posts. Please wait before posting again.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: 'AI rate limit reached. Please slow down.' },
});

// ─────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation failed', details });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ error: `Duplicate value: ${field}` });
  }
  if (err.name === 'MulterError')
    return res.status(400).json({ error: err.message });

  if (err.status === 401 || err.message?.includes('Unauthenticated'))
    return res.status(401).json({ error: 'Authentication required. Please log in.' });

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Wraps async route handlers — no try/catch boilerplate needed
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  requireAuth: clerkRequireAuth,
  attachUser,
  requireRole,
  upload,
  uploadToCloudinary,
  generateAnonToken,
  generateChatAlias,
  generalLimiter,
  postLimiter,
  aiLimiter,
  errorHandler,
  asyncHandler,
};
