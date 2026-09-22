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

// ─────────────────────────────────────────────
// ENCRYPTION & DECRYPTION (AES-256-CBC)
// ─────────────────────────────────────────────
const SECRET = process.env.ANON_HMAC_SECRET || 'civic_anon_secret_k3y_2026_do_not_change';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(SECRET).digest();

const encryptField = (text) => {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed:', err.message);
    return text;
  }
};

const decryptField = (ciphertext) => {
  if (!ciphertext) return '';
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 2) return ciphertext; // Return as-is if not in IV:encrypted format
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return ciphertext;
  }
};

const encryptTokenDeterministic = (token) => {
  if (!token) return '';
  try {
    // For tokens that need to be queried ($addToSet, $pull, includes), use a static IV (16 zero bytes).
    // This is secure because postAnonToken has very high entropy (32 random bytes).
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (err) {
    console.error('Deterministic token encryption failed:', err.message);
    return token;
  }
};

// AES-256-CBC with zero IV produces 64 hex chars per 32-byte input block.
// Any stored token shorter than 64 chars, or one that is not pure hex, was
// saved BEFORE encryption was introduced — return it as-is (plain text).
const VALID_AES_TOKEN_RE = /^[0-9a-f]{64,}$/i;

const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return '';

  // Graceful backwards-compat: skip decryption for non-encrypted (plain) tokens
  if (!VALID_AES_TOKEN_RE.test(encryptedToken)) {
    return encryptedToken; // already plain text — no decrypt needed
  }

  try {
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption still fails (e.g., key mismatch), return original silently.
    // No console.error here — avoids flooding logs with stale DB entries.
    return encryptedToken;
  }
};

// Stable per-user per-room alias, e.g. "Citizen #7F3A"
const generateChatAlias = (userId, roomId) => {
  if (!userId || !roomId) return 'Citizen #ANON';
  const hash = crypto
    .createHmac('sha256', 'civic-secret-key-for-alias')
    .update(`${userId}-${roomId}`)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase();
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

// ─────────────────────────────────────────────
// TOKEN CACHE (avoids re-decrypting on every request)
// ─────────────────────────────────────────────
const cache = require('../services/cache');
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Syncs Clerk user → MongoDB and attaches req.user + req.anonToken.
 * Decrypted token arrays are cached for TOKEN_CACHE_TTL_MS to avoid
 * running crypto on every single authenticated request.
 */
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
        email: encryptField(email),
        displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous Citizen',
        avatar: clerkUser.imageUrl,
      });
    }

    // ── Decrypt tokens with short-lived cache ──────────────────────
    // Keyed by clerkId; invalidated automatically after 5 min or on
    // new post/comment (routes must call cache.delete(`tokens:${clerkId}`))
    const tokenCacheKey = `tokens:${clerkId}`;
    let decryptedTokens = cache.get(tokenCacheKey);

    if (!decryptedTokens) {
      decryptedTokens = {
        postTokens:    (user.postTokens    || []).map(decryptToken),
        commentTokens: (user.commentTokens || []).map(decryptToken),
      };
      cache.set(tokenCacheKey, decryptedTokens, TOKEN_CACHE_TTL_MS);
    }

    // Attach decrypted tokens safely to req and via getters on user instance
    req.decryptedPostTokens = decryptedTokens.postTokens;
    req.decryptedCommentTokens = decryptedTokens.commentTokens;

    Object.defineProperty(user, 'postTokens', {
      get: () => decryptedTokens.postTokens,
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(user, 'commentTokens', {
      get: () => decryptedTokens.commentTokens,
      configurable: true,
      enumerable: true,
    });

    req.user      = user;
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

/**
 * Trusted IPs that bypass rate limiting entirely (comma-separated in env).
 * Example: TRUSTED_IPS=127.0.0.1,10.0.0.1
 */
const TRUSTED_IPS = new Set(
  (process.env.TRUSTED_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean)
);

/**
 * User-aware key generator:
 * — Authenticated requests are throttled per userId (not IP),
 *   so NAT/shared IPs don't unfairly penalise many users.
 * — Unauthenticated requests fall back to IP.
 */
const keyGenerator = (req) => {
  const { userId } = req.auth || {}; // Clerk attaches `auth` via clerkMiddleware
  // Note: ipKeyGenerator placeholder for express-rate-limit validation
  return userId || req.ip || '127.0.0.1';
};

/**
 * Skip trusted IPs for every limiter.
 */
const skipTrusted = (req) => TRUSTED_IPS.has(req.ip);

/**
 * generalLimiter — applied globally to all API routes.
 * 500 req / 15 min ≈ 33 req/min per IP/user.
 * Increase GENERAL_RATE_LIMIT and GENERAL_RATE_WINDOW_MS via env to tune.
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.GENERAL_RATE_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.GENERAL_RATE_LIMIT)     || 500,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator,
  skip: skipTrusted,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

/**
 * authLimiter — stricter limiter for auth/login routes to prevent brute-force.
 * 100 req / 15 min per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: skipTrusted,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many auth requests. Please wait before trying again.' },
});

/**
 * postLimiter — per authenticated user, prevents post spam.
 * 20 posts / hour (up from 10).
 */
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      parseInt(process.env.POST_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator,
  skip: skipTrusted,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many posts. Please wait before posting again.' },
});

/**
 * aiLimiter — guards expensive AI inference routes.
 * 30 req / min per user/IP.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      parseInt(process.env.AI_RATE_LIMIT) || 30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator,
  skip: skipTrusted,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'AI rate limit reached. Please slow down.' },
});

/**
 * uploadLimiter — limits file upload requests to prevent storage abuse.
 * 10 uploads / hour per user/IP.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      parseInt(process.env.UPLOAD_RATE_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator,
  skip: skipTrusted,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Upload limit reached. Maximum 10 uploads per hour.' },
});

/**
 * strictLimiter — for sensitive mutations (delete, admin actions, etc.).
 * 50 req / 15 min per user/IP.
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.STRICT_RATE_LIMIT) || 50,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator,
  skip: skipTrusted,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many sensitive requests. Please wait.' },
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

// Recursively sanitizes string inputs to prevent XSS / HTML injections
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>?/gm, '') // Remove all HTML tags
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove inline event handlers
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '[removed]'); // Remove javascript: protocol
};

const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

module.exports = {
  requireAuth: clerkRequireAuth,
  attachUser,
  requireRole,
  upload,
  uploadToCloudinary,
  generateAnonToken,
  generateChatAlias,
  generalLimiter,
  authLimiter,
  postLimiter,
  aiLimiter,
  uploadLimiter,
  strictLimiter,
  sanitizeInput,
  errorHandler,
  asyncHandler,
  encryptField,
  decryptField,
  encryptTokenDeterministic,
  decryptToken,
};
