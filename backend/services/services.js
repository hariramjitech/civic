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
const genAI       = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel   = () => genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const visionModel = () => genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ─────────────────────────────────────────────
// AI: Classify civic issue from image + description
// ─────────────────────────────────────────────
const classifyIssue = async (imageBase64, mimeType = 'image/jpeg', description = '') => {
  try {
    const prompt = `You are a civic issue classifier for Tamil Nadu, India.
Analyze this infrastructure problem image.

Classify into ONE category:
pothole | road_damage | garbage | water_leakage | drainage | streetlight | public_property | electricity | other

Severity: low | medium | high | critical

Respond ONLY with valid JSON (no markdown):
{
  "category": "...",
  "severity": "...",
  "tags": ["tag1","tag2"],
  "confidence": 0.0-1.0,
  "summary": "one sentence description"
}
${description ? `\nUser description: ${description}` : ''}`;

    const result = await visionModel().generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType } },
    ]);
    const json = result.response.text().replace(/```json?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(json);
  } catch {
    return { category: 'other', severity: 'medium', tags: [], confidence: 0, summary: description || 'Civic issue' };
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

    const result = await textModel().generateContent(
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
    const result = await textModel().generateContent(
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
    const result = await textModel().generateContent(
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
    const result = await textModel().generateContent(
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

module.exports = {
  classifyIssue,
  checkDuplicate,
  moderateContent,
  generateReport,
  predictRiskZones,
  reverseGeocode,
  fetchGovRoadData,
  updateIntensityScore,
};
