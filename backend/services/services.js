/**
 * ============================================================
 *  services/services.js — All Backend Services
 *  Gemini AI | Nominatim Geocoding | data.gov.in | Escalation Engine
 * ============================================================
 */

const axios  = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Post, ChatRoom } = require('../models/models');

// ─────────────────────────────────────────────
// GEMINI AI CLIENT
// ─────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper for sleeping
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to try generateContent with retry and timeout configuration
const generateWithRetry = async (modelName, contents, maxRetries = 2, initialDelay = 1000) => {
  let delay = initialDelay;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Set a timeout of 30s so we don't abort slow/multimodal requests prematurely
      const modelInstance = genAI.getGenerativeModel({ model: modelName }, { timeout: 30000 });
      const result = await modelInstance.generateContent(contents);
      if (result && result.response) {
        return result;
      }
    } catch (err) {
      const status = err.status || (err.message && err.message.match(/\[(\d+)\]/)?.[1]);
      const isNotFound = status === 404 || err.message?.includes('404') || err.message?.toLowerCase().includes('not found');
      const isQuotaExceeded = status === 429 || err.status === 429 || err.message?.includes('429') || err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('limit');
      
      // If the model does not exist/is not found, fail fast and do not retry
      if (isNotFound) {
        throw err;
      }

      // If quota is exceeded, fail fast immediately to fallback model without waiting/retrying
      if (isQuotaExceeded) {
        console.warn(`⚠️ [Gemini AI] Model ${modelName} quota exceeded. Failing fast...`);
        throw err;
      }
      
      // If we've reached the maximum retries, throw the error to try the next model
      if (attempt === maxRetries) {
        throw err;
      }
      
      console.warn(`⚠️ [Gemini AI] Model ${modelName} failed on attempt ${attempt + 1}/${maxRetries + 1} (Reason: ${err.message}). Retrying in ${delay}ms...`);
      await sleep(delay);
      delay *= 2; // exponential backoff
    }
  }
};

// High IQ Fallback Handler to try multiple models sequentially when free-tier/temporary service spikes occur
const generateContentWithFallback = async (contents) => {
  // Ordered by stability and availability in 2026
  const models = [
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash'
  ];
  let lastError = null;
  for (const modelName of models) {
    try {
      console.log(`🤖 [Gemini AI] Trying model: ${modelName}`);
      const result = await generateWithRetry(modelName, contents);
      if (result && result.response) {
        console.log(`✅ [Gemini AI] Model ${modelName} succeeded!`);
        return result;
      }
    } catch (err) {
      console.warn(`⚠️ [Gemini AI] Model ${modelName} failed. Reason: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error('All models failed to respond');
};

// AI: Classify civic issue from image + description
const classifyIssue = async (images, description = '', metadataContext = '') => {
  try {
    let imagesArray = [];
    if (Array.isArray(images)) {
      imagesArray = images;
    } else if (images && typeof images === 'object' && images.base64) {
      imagesArray = [images];
    } else if (typeof images === 'string') {
      imagesArray = [{ base64: images, mimeType: 'image/jpeg' }];
    }

    const prompt = `You are a civic issue classifier, forensic image validator, and municipal assistant for Tamil Nadu, India.
Analyze the uploaded infrastructure/civic problem image(s). The images must show the actual civic issue or direct evidence of it; do not treat unrelated people, offices, selfies, group photos, ceremonies, landscapes, or generic street scenes as relevant just because they were taken nearby.

1. Classify into ONE category:
roads | sanitation | water | electricity | municipal | other

2. Determine severity: low | medium | high | critical

3. Perform image forensics and check originality:
Analyze if the images are genuine, original photos taken in-situ (authentic), or if any of them is a screenshot of another photo, a downloaded stock photo from the web, a modified/manipulated photo, or unknown.
Provide:
- originalityStatus: "authentic" | "suspicious_screenshot" | "stock_photo_detected" | "manipulated" | "unknown"
- originalityAnalysis: A short, 1-2 sentence explanation of your assessment.

4. Verify relevance:
Ensure that ALL uploaded images are relevant to the infrastructure/civic problem described in the user description. If any image is irrelevant, completely unrelated, or inappropriate (e.g. random pet photo, meme, text document, food picture, office group photo, ceremony photo, or generic portrait that does not show the civic issue), set "allImagesRelevant" to false and provide a clear explanation in "relevanceExplanation". Otherwise, set "allImagesRelevant" to true and leave "relevanceExplanation" empty.

Respond ONLY with valid JSON (no markdown, no code blocks, no backticks):
{
  "category": "...",
  "severity": "...",
  "tags": ["tag1","tag2"],
  "confidence": 0.0-1.0,
  "summary": "one sentence description",
  "originalityStatus": "authentic|suspicious_screenshot|stock_photo_detected|manipulated|unknown",
  "originalityAnalysis": "...",
  "allImagesRelevant": true|false,
  "relevanceExplanation": "..."
}
${description ? `\nUser description: ${description}` : ''}
${metadataContext ? `\nExtracted Image Digital Footprint (EXIF) Context:\n${metadataContext}` : ''}`;

    const parts = [prompt];
    for (const img of imagesArray) {
      if (img.base64) {
        parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } });
      }
    }

    const result = await generateContentWithFallback(parts);
    const json = result.response.text().replace(/```json?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(json);
  } catch (err) {
    console.error('Error in classifyIssue:', err);
    return { 
      category: 'other', 
      severity: 'medium', 
      tags: [], 
      confidence: 0, 
      summary: description || 'Civic issue',
      originalityStatus: 'unknown',
      originalityAnalysis: 'AI image forensics failed to execute.',
      allImagesRelevant: true,
      relevanceExplanation: ''
    };
  }
};

// ─────────────────────────────────────────────
// AI: Duplicate complaint detection
// ─────────────────────────────────────────────
const checkDuplicate = async (newPost, nearbyPosts) => {
  if (!nearbyPosts.length) return { isDuplicate: false };
  try {
    const summaries = nearbyPosts.map((p, i) =>
      `[${i}] ${p.category} | ${p.description?.substring(0, 100)}`
    ).join('\n');

    const result = await generateContentWithFallback(
      `Duplicate complaint detector. New: ${newPost.category} — ${newPost.description}
Nearby (within 200m):\n${summaries}
Respond ONLY with JSON: {"isDuplicate":bool,"duplicateIndex":null|number,"similarity":0.0-1.0}`
    );
    const parsed = JSON.parse(result.response.text().replace(/```json?/gi,'').replace(/```/g,'').trim());
    return {
      isDuplicate:     parsed.isDuplicate,
      duplicatePostId: parsed.isDuplicate ? nearbyPosts[parsed.duplicateIndex]?._id : null,
      similarity:      parsed.similarity,
    };
  } catch {
    return { isDuplicate: false };
  }
};

// ─────────────────────────────────────────────
// AI: Content moderation
// ─────────────────────────────────────────────
const moderateContent = async (text) => {
  try {
    const result = await generateContentWithFallback(
      `Is this safe for a civic platform? Check hate speech, violence, spam.
Text: "${text}"
JSON only: {"safe":bool,"reason":"..."}`
    );
    return JSON.parse(result.response.text().replace(/```json?/gi,'').replace(/```/g,'').trim());
  } catch {
    return { safe: true, reason: 'moderation skipped' };
  }
};

// ─────────────────────────────────────────────
// AI: Analytics report generator
// ─────────────────────────────────────────────
const generateReport = async (analyticsData) => {
  try {
    const result = await generateContentWithFallback(
      `Generate a professional civic infrastructure report for Tamil Nadu local government.
Data: ${JSON.stringify(analyticsData, null, 2)}
Write a concise markdown report: Executive Summary, Top Issues, Critical Areas, Resolution Rate, Recommendations.
Under 500 words.`
    );
    return result.response.text();
  } catch {
    return '# Report generation failed. Please try again.';
  }
};

// ─────────────────────────────────────────────
// AI: Risk zone prediction
// ─────────────────────────────────────────────
const predictRiskZones = async (historicalData) => {
  try {
    const result = await generateContentWithFallback(
      `Predict high-risk infrastructure zones in Tamil Nadu from this data: ${JSON.stringify(historicalData)}
JSON array only: [{"district":"...","riskLevel":"high|medium|low","primaryIssue":"...","prediction":"..."}]`
    );
    return JSON.parse(result.response.text().replace(/```json?/gi,'').replace(/```/g,'').trim());
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────
// GEOCODING — Nominatim / OpenStreetMap (FREE, no API key)
// ─────────────────────────────────────────────
const DISTRICT_MAP = {
  'Chennai':          'Chennai',  'Greater Chennai': 'Chennai',
  'Coimbatore':       'Coimbatore',
  'Madurai':          'Madurai',
  'Tiruchirappalli':  'Tiruchirappalli', 'Trichy': 'Tiruchirappalli',
  'Salem':            'Salem',
  'Tirunelveli':      'Tirunelveli',
  'Vellore':          'Vellore',
  'Erode':            'Erode',
  'Thoothukudi':      'Thoothukudi',
  'Kancheepuram':     'Kancheepuram',
  'Thanjavur':        'Thanjavur',
  'Tiruppur':         'Tiruppur',
  'Dindigul':         'Dindigul',
  'Namakkal':         'Namakkal',
  'Krishnagiri':      'Krishnagiri',
  'Dharmapuri':       'Dharmapuri',
  'Villupuram':       'Villupuram',
  'Cuddalore':        'Cuddalore',
};

const normalizeDistrict = (raw = '') => {
  for (const [key, val] of Object.entries(DISTRICT_MAP)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return raw;
};

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await axios.get(`${process.env.NOMINATIM_BASE_URL}/reverse`, {
      params:  { lat, lon: lng, format: 'json', 'accept-language': 'en' },
      headers: { 'User-Agent': 'CivicTN/1.0 (contact@civictn.in)' },
      timeout: 5000,
    });
    const addr     = res.data.address || {};
    const rawDist  = addr.county || addr.city_district || addr.state_district || addr.city || addr.town || 'Unknown';
    return {
      district: normalizeDistrict(rawDist),
      city:     addr.city || addr.town || addr.village || rawDist,
      state:    addr.state || 'Tamil Nadu',
      address:  res.data.display_name || '',
    };
  } catch {
    return { district: 'Unknown', city: 'Unknown', state: 'Tamil Nadu', address: '' };
  }
};

// ─────────────────────────────────────────────
// OPEN GOV DATA — data.gov.in (Tamil Nadu road data)
// ─────────────────────────────────────────────
const fetchGovRoadData = async (district) => {
  try {
    const res = await axios.get('https://api.data.gov.in/resource/92a5ddc2-e93d-4d27-8fb5-1b7e8b67b413', {
      params:  { 'api-key': process.env.DATA_GOV_IN_API_KEY, format: 'json', limit: 10, filters: `District:${district}` },
      timeout: 8000,
    });
    return res.data?.records || [];
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────
// ESCALATION ENGINE — auto-notify officials
// ─────────────────────────────────────────────
const updateIntensityScore = async (postId) => {
  const post = await Post.findById(postId).lean();
  if (!post) return 0;

  // Instagram-like ranking: base score + engagement weights + local support boost
  let baseScore = 20;
  let score = Math.round(
    (post.likeCount || 0) + 
    ((post.commentCount || 0) * 1.5) + 
    ((post.supportCount || 0) * 3) + 
    ((post.localSupportCount || 0) * 15) +
    ((post.localWitnessCount || 0) * 12)
  ) + baseScore;
  
  // Boosts
  if (post.isVerified || ['officer', 'department', 'admin'].includes(post.creatorRole)) {
    score += 150;
  }
  if (post.originalityStatus === 'authentic') {
    score += 100;
  }
  if (post.imageMetadata?.gpsMatchStatus === 'matched') {
    score += 50;
  }

  // Penalties
  if (post.originalityStatus === 'stock_photo_detected') {
    score = Math.round(score * 0.1); // 90% reduction
  } else if (post.originalityStatus === 'suspicious_screenshot') {
    score = Math.round(score * 0.5); // 50% reduction
  } else if (post.originalityStatus === 'manipulated') {
    score = Math.round(score * 0.2); // 80% reduction
  }

  if (post.imageMetadata?.gpsMatchStatus === 'mismatch') {
    score = Math.round(score * 0.6); // 40% reduction
  } else if (post.imageMetadata?.gpsMatchStatus === 'no_gps_data' && !post.isVerified) {
    score = Math.round(score * 0.8); // 20% reduction if unverified
  }

  if (post.allImagesRelevant === false) {
    score = Math.round(score * 0.1); // 90% reduction
  }

  // Ensure score is not negative
  score = Math.max(0, score);

  await Post.findByIdAndUpdate(postId, { intensityScore: score });

  // Strike room escalation check
  const strikeRoom = await ChatRoom.findOne({ postId, type: 'strike', isActive: true });
  if (strikeRoom) {
    const members = strikeRoom.memberCount;
    const level   = members >= 500 ? 3 : members >= 100 ? 2 : members >= 50 ? 1 : 0;
    if (level > strikeRoom.escalationLevel) {
      await ChatRoom.findByIdAndUpdate(strikeRoom._id, { escalationLevel: level });
      const labels = ['', 'Assistant Engineer', 'Executive Engineer', 'Municipal Commissioner'];
      console.log(`🚨 ESCALATION: ${postId} → ${labels[level]} (${members} members)`);
    }
  }
  return score;
};

// ─────────────────────────────────────────────
// AI: Text Rewriter
// ─────────────────────────────────────────────
const rewriteComplaint = async (description = '') => {
  try {
    const prompt = `You are an expert writing assistant helping citizens in Tamil Nadu, India format and polish civic complaints for a social/civic platform post.
Polish the user's complaint to make it grammatically correct, highly professional, structured, and clear. 
Always output a bilingual post caption containing a polished English version first, followed by a high-quality Tamil (தமிழ்) translation.
Keep all specific details (landmarks, street names, times, dates, vehicles, severity) intact.
Structure the caption cleanly with clear spacing and sections (e.g. using bullet points for key details) to make it an excellent post caption for a civic platform.
Do not include any introductory remarks, salutations, meta-commentary, or conversational fillers. Just output the English and Tamil caption directly.

User complaint:
"${description}"`;

    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Error in rewriteComplaint:', err);
    // Return the original description as a fallback instead of crashing
    return description;
  }
};

// ─────────────────────────────────────────────
// Forensics: Haversine distance calculator
// ─────────────────────────────────────────────
const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

const badWords = [
  // English
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'wank', 'crap', 'dumbass', 'idiot',
  // Tamil Transliterated (Tanglish)
  'oolu', 'sunni', 'poolu', 'bunda', 'thevidiya', 'koothi', 'soothu', 'ommala', 'omala', 'podangotha', 'oththa', 'poramboke',
  // Tamil Native
  'தேவிடியா', 'கூதி', 'சூத்து', 'பூலு', 'சுன்னி', 'போடா', 'போடி'
];

const censorText = (text) => {
  if (!text || typeof text !== 'string') return text;
  let censored = text;
  for (const word of badWords) {
    const isTamilScript = /[\u0B80-\u0BFF]/.test(word);
    const regex = isTamilScript 
      ? new RegExp(word, 'gi')
      : new RegExp(`\\b${word}\\b`, 'gi');
      
    censored = censored.replace(regex, (match) => {
      if (match.length <= 1) return '*';
      return match[0] + '*'.repeat(match.length - 1);
    });
  }
  return censored;
};

module.exports = {
  classifyIssue,
  checkDuplicate,
  moderateContent,
  generateReport,
  predictRiskZones,
  reverseGeocode,
  fetchGovRoadData,
  updateIntensityScore,
  rewriteComplaint,
  getHaversineDistance,
  censorText,
};
