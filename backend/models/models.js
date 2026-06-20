/**
 * ============================================================
 *  ALL MONGOOSE MODELS — Civic Platform
 * ============================================================
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
// USER (synced from Clerk, extended profile)
// ─────────────────────────────────────────────
const userSchema = new Schema({
  clerkId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  displayName: { type: String, default: 'Anonymous Citizen' },
  avatar: { type: String },
  role: { type: String, enum: ['citizen', 'officer', 'department', 'admin'], default: 'citizen' },
  district: { type: String },           // home district (optional, set by user)
  // Personal accountability (visible only to self)
  postTokens: [{ type: String }],         // HMAC tokens of own posts (to claim ownership)
  commentTokens: [{ type: String }],         // HMAC tokens of own comments
  likedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  supportedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  votedPolls: [{ type: Map, of: String }],// pollId → optionIndex
  joinedRooms: [{ type: Schema.Types.ObjectId, ref: 'ChatRoom' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ─────────────────────────────────────────────
// POST (anonymous civic issue — social feed)
// ─────────────────────────────────────────────
const postSchema = new Schema({
  // Anonymous identity — one-way HMAC hash, never the real userId
  anonToken: { type: String, required: true, index: true },

  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, maxlength: 2000 },
  images: [{ type: String }],        // Cloudinary URLs

  // Location
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number],                  // [lng, lat]
  },
  district: { type: String, index: true },
  address: { type: String },          // human-readable from Nominatim

  // AI classification (auto-filled by Gemini)
  category: {
    type: String,
    enum: ['roads', 'sanitation', 'water', 'electricity', 'municipal', 'other'],
    default: 'other'
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  aiTags: [{ type: String }],
  aiConfidence: { type: Number, min: 0, max: 1 },

  // Status (creator can update via anonToken)
  status: {
    type: String,
    enum: ['reported', 'in_progress', 'resolved', 'closed', 'duplicate'],
    default: 'reported'
  },
  statusHistory: [{
    status: String,
    note: String,
    updatedAt: { type: Date, default: Date.now },
  }],

  // Social metrics
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  supportCount: { type: Number, default: 0 },  // cross-city reports
  localSupportCount: { type: Number, default: 0 }, // verified local reports (within 500m)
  intensityScore: { type: Number, default: 0 },   // computed score

  // Auto-attached official contacts (populated from Contact collection)
  attachedContacts: [{ type: Schema.Types.ObjectId, ref: 'Contact' }],

  // Duplicate detection
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: Schema.Types.ObjectId, ref: 'Post' },

  // Forensics & Digital Footprints
  imageMetadata: {
    camera: { type: String },
    dateTimeOriginal: { type: Date },
    software: { type: String },
    hasGPS: { type: Boolean, default: false },
    exifGPS: {
      lat: { type: Number },
      lng: { type: Number }
    },
    gpsMatchStatus: {
      type: String,
      enum: ['matched', 'mismatch', 'no_gps_data'],
      default: 'no_gps_data'
    }
  },
  originalityStatus: {
    type: String,
    enum: ['authentic', 'suspicious_screenshot', 'stock_photo_detected', 'manipulated', 'unknown'],
    default: 'unknown'
  },
  originalityAnalysis: { type: String },
  
  // Verification & Relevance metadata
  creatorRole: { type: String, enum: ['citizen', 'officer', 'department', 'admin'], default: 'citizen' },
  isVerified: { type: Boolean, default: false },
  allImagesRelevant: { type: Boolean, default: true },
  relevanceExplanation: { type: String },

  legitimacyScore: { type: Number, default: 70 },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

postSchema.index({ location: '2dsphere' });
postSchema.index({ district: 1, status: 1 });
postSchema.index({ intensityScore: -1 });
postSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────
// COMMENT (anonymous, on a post)
// ─────────────────────────────────────────────
const commentSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  anonToken: { type: String, required: true },   // one-way hash
  text: { type: String, required: true, maxlength: 1000 },
  likeCount: { type: Number, default: 0 },
  parentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null }, // threading
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// ─────────────────────────────────────────────
// POLL (attached to a post)
// ─────────────────────────────────────────────
const pollSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  question: { type: String, required: true, maxlength: 300 },
  options: [{
    text: String,
    voteCount: { type: Number, default: 0 },
  }],
  totalVotes: { type: Number, default: 0 },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ─────────────────────────────────────────────
// CHAT ROOM (public discussion + strike rooms)
// ─────────────────────────────────────────────
const chatRoomSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 500 },
  type: { type: String, enum: ['discussion', 'strike'], default: 'discussion' },
  district: { type: String },
  category: { type: String },             // linked civic category
  postId: { type: Schema.Types.ObjectId, ref: 'Post' }, // if tied to a post
  memberCount: { type: Number, default: 0 },
  members: [{ type: String }],           // clerkIds of current members
  intensityScore: { type: Number, default: 0 },
  escalationLevel: { type: Number, default: 0 }, // 0=none, 1=asst eng, 2=exec eng, 3=commissioner
  isActive: { type: Boolean, default: true },
  createdBy: { type: String },             // clerkId
}, { timestamps: true });

// ─────────────────────────────────────────────
// MESSAGE (ephemeral chat — deleted with room or on leave)
// ─────────────────────────────────────────────
const messageSchema = new Schema({
  roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
  // NOT storing userId — stored as anonymous display name generated per-session
  senderAlias: { type: String, default: 'Anonymous' }, // e.g. "Citizen #7F3A"
  text: { type: String, required: true, maxlength: 1000 },
  type: { type: String, enum: ['text', 'image', 'system'], default: 'text' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// ─────────────────────────────────────────────
// OFFICIAL CONTACT (Tamil Nadu district contacts)
// ─────────────────────────────────────────────
const contactSchema = new Schema({
  district: { type: String, required: true, index: true },
  department: {
    type: String,
    enum: ['electricity', 'water', 'roads', 'sanitation', 'municipal', 'police', 'revenue'],
    required: true
  },
  officerName: { type: String },
  designation: { type: String },
  phone: [{ type: String }],
  email: { type: String },
  address: { type: String },
  portalUrl: { type: String },
  complaintUrl: { type: String },
  whatsappNumber: { type: String },
  workingHours: { type: String, default: '9:00 AM – 5:30 PM (Mon–Sat)' },
}, { timestamps: true });

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────
const auditLogSchema = new Schema({
  action: { type: String, required: true },
  targetType: { type: String },           // 'post', 'room', 'user', etc.
  targetId: { type: Schema.Types.ObjectId },
  performedBy: { type: String },           // clerkId (admin only)
  details: { type: Schema.Types.Mixed },
  ip: { type: String },
}, { timestamps: true });

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Poll = mongoose.model('Poll', pollSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const Message = mongoose.model('Message', messageSchema);
const Contact = mongoose.model('Contact', contactSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { User, Post, Comment, Poll, ChatRoom, Message, Contact, AuditLog };
