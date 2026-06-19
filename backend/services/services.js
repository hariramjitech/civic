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

// High IQ Fallback Handler to try multiple models sequentially when free-tier/temporary service spikes occur
const generateContentWithFallback = async (contents) => {
  const models = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest' // fallback alias
  ];
  let lastError = null;
  for (const modelName of models) {
    try {
      console.log(`🤖 [Gemini AI] Trying model: ${modelName}`);
      const modelInstance = genAI.getGenerativeModel({ model: modelName });
      const result = await modelInstance.generateContent(contents);
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

// ─────────────────────────────────────────────
// AI: Classify civic issue from image + description
// ─────────────────────────────────────────────
const classifyIssue = async (imageBase64, mimeType = 'image/jpeg', description = '', metadataContext = '') => {
  try {
    const prompt = `You are a civic issue classifier, forensic image validator, and municipal assistant for Tamil Nadu, India.
Analyze this infrastructure/civic problem image.

1. Classify into ONE category:
pothole | road_damage | garbage | water_leakage | drainage | streetlight | public_property | electricity | other

2. Determine severity: low | medium | high | critical

3. Perform image forensics and check originality:
Analyze if this is a genuine, original photo taken in-situ (authentic), or if it is a screenshot of another photo, a downloaded stock photo from the web, a modified/manipulated photo, or unknown.
Provide:
- originalityStatus: "authentic" | "suspicious_screenshot" | "stock_photo_detected" | "manipulated" | "unknown"
- originalityAnalysis: A short, 1-2 sentence explanation of your assessment (e.g. "Image has no signs of modifications and depicts local environment consistent with Tamil Nadu" or "Image appears to be a screenshot of a news article or map").

Respond ONLY with valid JSON (no markdown, no code blocks, no backticks):
{
  "category": "...",
  "severity": "...",
  "tags": ["tag1","tag2"],
  "confidence": 0.0-1.0,
  "summary": "one sentence description",
  "originalityStatus": "authentic|suspicious_screenshot|stock_photo_detected|manipulated|unknown",
  "originalityAnalysis": "..."
}
${description ? `\nUser description: ${description}` : ''}
${metadataContext ? `\nExtracted Image Digital Footprint (EXIF) Context:\n${metadataContext}` : ''}`;

    const result = await generateContentWithFallback([
      prompt,
      { inlineData: { data: imageBase64, mimeType } },
    ]);
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
      originalityAnalysis: 'AI image forensics failed to execute.'
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

  const score = Math.round(post.likeCount + (post.commentCount * 1.5) + (post.supportCount * 3));
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
    const prompt = `You are a professional writing assistant helping citizens in Tamil Nadu, India report civic issues.
Rewrite the following user complaint to make it highly professional, clear, objective, and easy for municipal corporation or local government authorities to read and act upon.
Keep all specific details like landmarks, street names, times, dates, and severity intact.
If the input contains Tamil text, rewrite it in a clear, polite, and professional bilingual format (Tamil and English) or highly polished Tamil, whichever is most appropriate for a formal report.
Do not add any introductory text, salutations, or concluding remarks. Just respond with the rewritten complaint text.

User complaint:
"${description}"`;

    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Error in rewriteComplaint:', err);
    throw new Error('Failed to rewrite complaint.');
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
};
