/**
 * ============================================================
 *  services/services.js — All Backend Services
 *  Gemini AI | Nominatim Geocoding | data.gov.in | Escalation Engine
 * ============================================================
 */

const axios  = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Post, ChatRoom, Contact } = require('../models/models');
const filter = require('leo-profanity');
const unhomoglyph = require('unhomoglyph');
const removeAccents = require('remove-accents');
const BadWordsNext = require('bad-words-next');
const badwordsEn = require('bad-words-next/lib/en');

// Load default english dictionary and add fallback moderation terms
filter.loadDictionary('en');
const customBadWords = [
  'gay', 'nega', 'nigga', 'nigger',
  'punda', 'sunni', 'poolu', 'bunda', 'koothi', 'soothu'
];
filter.add(customBadWords);

// Initialize BadWordsNext
const badwordsNextInstance = new BadWordsNext({ data: badwordsEn });

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
Analyze if the images are genuine, original photos taken in-situ (authentic). If an image is a screenshot, a downloaded stock photo from the web, a modified/manipulated photo, or a photograph showing a digital screen, monitor, laptop, mobile device screen, TV, or a physical printout of an image, classify its status accordingly.
Provide:
- originalityStatus: "authentic" | "suspicious_screenshot" | "stock_photo_detected" | "manipulated" | "screen_spoof_detected" | "unknown"
- originalityAnalysis: A short, 1-2 sentence explanation of your assessment. If you detect a photograph of a screen/display/print, clearly state that in the explanation.

4. Verify relevance:
Ensure that ALL uploaded images are relevant to the infrastructure/civic problem described in the user description. If any image is irrelevant, completely unrelated, or inappropriate (e.g. random pet photo, meme, text document, food picture, office group photo, ceremony photo, or generic portrait that does not show the civic issue), set "allImagesRelevant" to false and provide a clear explanation in "relevanceExplanation". Otherwise, set "allImagesRelevant" to true and leave "relevanceExplanation" empty.

Respond ONLY with valid JSON (no markdown, no code blocks, no backticks):
{
  "category": "...",
  "severity": "...",
  "tags": ["tag1","tag2"],
  "confidence": 0.0-1.0,
  "summary": "one sentence description",
  "originalityStatus": "authentic|suspicious_screenshot|stock_photo_detected|manipulated|screen_spoof_detected|unknown",
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
const censorCustomWords = (text, customWords) => {
  if (!text || !customWords || !customWords.length) return text;
  let censored = text;
  for (const word of customWords) {
    if (!word || word.trim().length === 0) continue;
    const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    censored = censored.replace(regex, (match) => {
      if (match.length <= 1) return '*';
      return match[0] + '*'.repeat(match.length - 1);
    });
  }
  return censored;
};

const moderateContent = async (text) => {
  try {
    const prompt = `You are an AI content moderator for a civic engagement app in Tamil Nadu, India.
Analyze the following user text.

We have a two-category moderation system:

1. ALLOWED POSTS/MESSAGES (safe: true):
   - Frustrated venting about civic infrastructure or safety (e.g., "this fucking road is broken", "garbage smells like shit"). We ALLOW these, but we will censor the bad words.
   - Complaints about civic issues, system failures, or administrative neglect (e.g., "corruption in road laying", "bribes are being taken", "negligent officials", "incompetent corporation"). These are fully allowed and must NEVER be blocked.
   - Physical description terms or animals (e.g., "drain is full of rats", "stray dog menace", "pigs in trash", "roads are dirty like a pigsty"). These are fully allowed and must NEVER be blocked.
   - Standard identity words (e.g., "gay", "transgender", "religion") used normally and not as a slur or insult.

2. BLOCKED POSTS/MESSAGES (safe: false):
   - Direct personal attacks, name-calling, abuse, insults, or threats directed at individuals, politicians, or officials (e.g., "you idiot officer", "kill the mayor", "Thiru Kumar is a bastard", "delinquent fool engineer").
   - Hate speech, derogatory slurs, or harassment targeting groups or personal characteristics (e.g., using identity terms like "gay", caste, or religious terms as slurs, insults, or abuse, such as "gay punda" or "gay bastard").
   - Vulgar/highly offensive sexual or abusive terms in English, Tamil, Tanglish, or Hindi used as direct insults.

INSTRUCTIONS FOR OUTPUT:
- Decide if the text is safe (true) or should be blocked (false).
- Under "badWords", identify any profanities, vulgar slang, or swear words in English, Tamil (native or Tanglish), or Hindi present in the text so they can be censored (e.g., "fucking", "shit", "punda", "sunni"). Do not include words like "corruption", "rat", "dog", "gay" (unless "gay" is used directly as a derogatory slur).

Text to analyze: "${text}"

Respond ONLY with a JSON object (no markdown, no backticks, no code blocks):
{
  "safe": true|false,
  "reason": "...", // short explanation if safe is false
  "badWords": ["word1", "word2"] // list of vulgar words/profanities found to be censored
}`;
    const result = await generateContentWithFallback(prompt);
    const json = result.response.text().replace(/```json?/gi,'').replace(/```/g,'').trim();
    return JSON.parse(json);
  } catch (err) {
    console.error('Error in moderateContent:', err);
    return { safe: true, reason: 'moderation skipped', badWords: [] };
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

const getDynamicContact = async (district, department) => {
  try {
    if (!district || district === 'Unknown') {
      district = 'Chennai'; // Safe fallback district
    }
    const cleanDept = (department || 'municipal').toLowerCase();

    // Check if contact already exists in database
    let contact = await Contact.findOne({ district: new RegExp(`^${district}$`, 'i'), department: cleanDept });
    if (contact) return contact;

    console.log(`🤖 [Gemini API] Dynamically generating contact info for ${district} (${cleanDept})...`);

    // If not, fetch/generate using Gemini API
    const prompt = `You are an administrative director in Tamil Nadu, India.
Generate the official contact details for the department/authority responsible for the civic category "${cleanDept}" in the district of "${district}", Tamil Nadu.
Find/infer the realistic officer name (e.g. "Thiru A. Selvamani" or "Smt. K. Vimala"), designation, phone numbers, official email, postal address, website portal URL, and online complaint URL.

CRITICAL INSTRUCTIONS:
1. Do NOT include any placeholder text, square brackets, or template brackets like "[Insert Name]", "[Ward Number]", "[Insert Phone]", or "___". Every single value must be fully resolved with a highly specific, realistic name, number, and location.
2. The phone numbers, emails, addresses, and portals must be realistic and specific for Tamil Nadu state departments (e.g. for TANGEDCO: ce.chennaicity@tangedco.gov.in, 1912; for Police: sp.district@tn.gov.in, 100; for Municipalities/Corporations: commissioner.city@tn.gov.in).
3. The official URLs must be actual, working government links (e.g., https://grievance.tn.gov.in, https://www.coimbatorecorporation.gov.in, https://www.tangedco.gov.in, https://www.tnpolice.gov.in).

Format the response ONLY as a single valid JSON object (no markdown, no code blocks, no backticks):
{
  "district": "${district}",
  "department": "${cleanDept}",
  "officerName": "...",
  "designation": "...",
  "phone": ["..."],
  "email": "...",
  "address": "...",
  "portalUrl": "...",
  "complaintUrl": "...",
  "whatsappNumber": "..." or null,
  "workingHours": "..."
}`;

    const result = await generateContentWithFallback(prompt);
    const text = result.response.text().replace(/```json?/gi, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);
    
    // Ensure correct fields
    data.district = district;
    data.department = cleanDept;

    // Create the contact in DB (Cache)
    contact = await Contact.create(data);
    return contact;
  } catch (err) {
    console.error('Failed to get dynamic contact:', err);
    // Return a basic fallback so it doesn't fail the post creation
    try {
      // Load templates from contactTemplates.json
      let templates = {};
      try {
        templates = require('../data/contactTemplates.json');
      } catch (e) {
        console.error('Failed to load contactTemplates.json:', e);
      }

      const deptTemplate = templates[department] || templates['municipal'] || {
        phone: ['1913'],
        email: 'support@tn.gov.in',
        designation: `Officer, ${district}`,
        officerName: `Officer, ${district}`,
        address: `Municipal Office, ${district}, Tamil Nadu`,
        portal: 'https://www.tn.gov.in'
      };

      const districtLowerClean = district.toLowerCase().replace(/\s+/g, '');
      const replacePlaceholders = (str) => {
        if (!str) return str;
        return str
          .replace(/\{\{district\}\}/g, district)
          .replace(/\{\{districtLowerClean\}\}/g, districtLowerClean);
      };

      const phone = deptTemplate.phone;
      const email = replacePlaceholders(deptTemplate.email);
      const designation = replacePlaceholders(deptTemplate.designation);
      const officerName = replacePlaceholders(deptTemplate.officerName);
      const address = replacePlaceholders(deptTemplate.address);
      const portal = replacePlaceholders(deptTemplate.portal);

      const fallbackContact = await Contact.create({
        district,
        department,
        officerName,
        designation,
        phone,
        email,
        address,
        portalUrl: portal,
        complaintUrl: portal,
        whatsappNumber: null,
        workingHours: '9:00 AM - 5:30 PM (Mon-Sat)'
      });
      return fallbackContact;
    } catch (dbErr) {
      console.error('Failed to create fallback contact in DB:', dbErr);
      return null;
    }
  }
};

const getOfficialsHierarchy = async (postData) => {
  try {
    const { category, district, address } = postData;

    const prompt = `You are an expert on municipal governance and administrative hierarchies in Tamil Nadu, India.
Analyze the following civic issue context:
- Category: ${category}
- District: ${district}
- Address: ${address || 'N/A'}

Based on this, outline the 5-level hierarchy of government officials responsible for addressing this issue.
Level 1: Ward / Field Level (L1) - Direct inspector / field officer
Level 2: Sub-divisional / Zone Level (L2) - Ward zone supervisor / assistant engineer
Level 3: Divisional / Regional Level (L3) - Executive engineer / regional officer
Level 4: District / Municipal Corporation Level (L4) - Municipal commissioner / superintending engineer / district collector
Level 5: State / Apex Board Level (L5) - Secretary to Government / Managing Director of the state board / Chief Engineer

For each level, provide:
- level: "L1", "L2", "L3", "L4", or "L5"
- levelName: Name of the level (e.g., "Ward / Field Level")
- designation: Official title in Tamil Nadu (e.g. Assistant Engineer, Sanitary Inspector, Executive Engineer, etc.)
- department: Responsible department name (e.g. Greater Chennai Corporation, TANGEDCO, CMWSSB, TWAD Board, Highways Department)
- role: Brief summary of their action authority for this issue (1 sentence)
- timeframe: Standard resolution timeframe before escalation (e.g., 7 Days, 15 Days)
- contact: A realistic, specific contact info object for this official in Tamil Nadu:
  - officerName: Specific realistic name of the officer in office (e.g. "Thiru P. Ramanathan" or "Smt. S. Anitha"). Do NOT leave empty or generic.
  - designation: Official designation, resolving any specific ward/zone details based on the post address.
  - phone: Array of strings representing phone numbers or emergency helpline (e.g. ["0422-2339100", "1912"])
  - email: Official email address (e.g. "commr.coimbatore@tn.gov.in" or "ee.highways@tn.gov.in")
  - address: Official office address (e.g. "Coimbatore Municipal Corporation HQ, Town Hall, Coimbatore - 641001")
  - portalUrl: Official website URL (e.g. "https://www.coimbatorecorporation.gov.in")
  - complaintUrl: Official online complaint portal URL (e.g. "https://grievance.tn.gov.in")
  - whatsappNumber: Official WhatsApp helpline if available (else null)
  - workingHours: Working hours string (e.g., "9:00 AM - 5:30 PM (Mon-Sat)")

CRITICAL REQUIREMENTS:
1. ZERO PLACEHOLDERS: Do NOT output any placeholder text, square brackets, or template variables like "[Ward Number]", "[Zone Number]", "[Insert Name]", or "___". Every single value must be fully resolved with a highly specific, realistic name, number, and location.
2. LOCALIZED SPECIFICITY: If the address mentions specific areas (e.g., 'Sundakkamuthur', 'Kalampalayam', 'Perur'), you must infer the realistic municipal ward number (e.g., 'Ward 88') and zone name (e.g., 'West Zone') corresponding to those locations in Coimbatore/the specified district, and output that exact specific ward/zone in the designation/role.
3. REALISTIC WEBSITES: The contact portalUrl and complaintUrl must point to actual official websites of the Tamil Nadu government, the district, or the municipal corporation (e.g. https://grievance.tn.gov.in, https://www.coimbatorecorporation.gov.in, https://www.tangedco.gov.in, https://www.tnpolice.gov.in).

Format the response ONLY as a valid JSON array of objects (no markdown, no code blocks, no backticks):
[
  {
    "level": "L1",
    "levelName": "Ward / Field Level",
    "designation": "...",
    "department": "...",
    "role": "...",
    "timeframe": "...",
    "contact": {
      "officerName": "...",
      "designation": "...",
      "phone": ["..."],
      "email": "...",
      "address": "...",
      "portalUrl": "...",
      "complaintUrl": "...",
      "whatsappNumber": null,
      "workingHours": "..."
    }
  },
  ...
]`;

    const result = await generateContentWithFallback(prompt);
    const text = result.response.text().replace(/```json?/gi, '').replace(/```/g, '').trim();
    const hierarchy = JSON.parse(text);
    return hierarchy;
  } catch (err) {
    console.error('Error in getOfficialsHierarchy:', err);
    return [
      {
        level: "L1",
        levelName: "Ward / Field Level",
        designation: "Assistant Engineer (AE) / Sanitary Inspector",
        department: "Municipal Corporation / Local Body",
        role: "Field inspection, immediate repair scheduling.",
        timeframe: "7 Days",
        contact: null
      },
      {
        level: "L2",
        levelName: "Sub-divisional / Zone Level",
        designation: "Assistant Executive Engineer (AEE)",
        department: "Municipal Corporation / Divisional Board",
        role: "Supervision and approval of small works.",
        timeframe: "14 Days",
        contact: null
      },
      {
        level: "L3",
        levelName: "Divisional / Regional Level",
        designation: "Executive Engineer (EE)",
        department: "Municipal Corporation / State Board Division",
        role: "Financial sanction and operational management.",
        timeframe: "30 Days",
        contact: null
      },
      {
        level: "L4",
        levelName: "District / Corporation Level",
        designation: "Commissioner / District Collector",
        department: "District Administration / Corporation HQ",
        role: "Overall administration, enforcement, and public grievance head.",
        timeframe: "45 Days",
        contact: null
      },
      {
        level: "L5",
        levelName: "State / Apex Board Level",
        designation: "Managing Director / Secretary",
        department: "Municipal Administration and Water Supply / State Board",
        role: "Policy formulation, large budget approvals, and supreme escalation authority.",
        timeframe: "90 Days",
        contact: null
      }
    ];
  }
};

const suggestLegalActs = async (postData) => {
  try {
    const { category, title, description } = postData;

    // 1. Live query to InsightLaw API
    let dynamicCandidates = [];
    try {
      const queryTerm = `${category || ''} ${title || ''}`.trim() || 'public hazard';
      console.log(`📡 [InsightLaw API] Querying live legal search for: "${queryTerm}"`);
      const searchRes = await axios.get('https://insightlaw.in/api/search', {
        params: { q: queryTerm },
        timeout: 5000
      });

      if (searchRes.data && Array.isArray(searchRes.data.results) && searchRes.data.results.length > 0) {
        console.log(`✅ [InsightLaw API] Found ${searchRes.data.results.length} search results`);
        dynamicCandidates = searchRes.data.results.map(item => {
          let actName = "Constitution of India";
          let section = `Article ${item.article_number || '21'}`;
          if (item.corpus === 'ipc') {
            actName = "Indian Penal Code";
            section = `Section ${item.section || '268'}`;
          } else if (item.corpus === 'bns') {
            actName = "Bharatiya Nyaya Sanhita, 2023";
            section = `Section ${item.section || '152'}`;
          }
          return {
            actName,
            section,
            summary: item.preview?.en || item.title_en || '',
            category: category || 'general',
            selectedByDefault: true
          };
        });
      }
    } catch (apiErr) {
      console.warn(`⚠️ [InsightLaw API] Primary search query failed (${apiErr.message}). Using AI legal draftsman...`);
    }

    // 2. Query AI to format and customize the statutory grounds
    const prompt = `You are an expert legal counsel in India, specializing in municipal laws, civic grievances, public nuisance, and constitutional rights.
Analyze the following civic complaint in Tamil Nadu:
- Category: ${category || 'civic'}
- Title: ${title || 'Civic Issue'}
- Description: ${description || 'Public hazard requiring municipal intervention.'}

${dynamicCandidates.length > 0 ? `Candidates from live InsightLaw API search:
${JSON.stringify(dynamicCandidates, null, 2)}` : ''}

Formulate 3-4 precise, citable statutory provisions (Articles of Constitution of India, Sections of Bharatiya Nyaya Sanhita 2023 / IPC, or Municipal Acts) applicable to this specific problem.
For each selected provision, provide:
- actName: Full official name of the Act (e.g., "Constitution of India", "Bharatiya Nyaya Sanhita, 2023", "Tamil Nadu District Municipalities Act, 1920")
- section: Specific Section or Article (e.g., "Article 21", "Section 152", "Section 162")
- summary: A clear 1-sentence legal summary explaining how this specific provision obligates the local authority or protects the resident for this exact complaint.
- selectedByDefault: true for the top 2-3 grounds, false for others.

Format the response ONLY as a valid JSON array of objects (no markdown, no code blocks, no backticks):
[
  {
    "actName": "...",
    "section": "...",
    "summary": "...",
    "selectedByDefault": true
  }
]`;

    const result = await generateContentWithFallback(prompt);
    const text = result.response.text().replace(/```json?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Error in suggestLegalActs:', err);
    
    // Unlinked Fallback: Dynamic legal response without relying on legalActs.json
    return [
      {
        actName: "Constitution of India",
        section: "Article 21",
        summary: "Guarantees the Right to Life, which courts have interpreted to include the right to safe public infrastructure, hazard-free roads, and clean environment.",
        selectedByDefault: true
      },
      {
        actName: "Bharatiya Nyaya Sanhita, 2023",
        section: "Section 152",
        summary: "Empowers public authorities and magistrate offices to order immediate abatement of active public nuisances and hazards endangering safety.",
        selectedByDefault: true
      },
      {
        actName: "Tamil Nadu District Municipalities Act, 1920",
        section: "Section 162",
        summary: "Statutory duty of local municipal corporations and district administration to maintain public streets and assets in a safe, motorable condition.",
        selectedByDefault: true
      }
    ];
  }
};

const fillMaskInLegalBERT = async (text) => {
  const token = process.env.HF_API_TOKEN;
  console.log(`🤖 [HuggingFace Inference] Mask fill query: "${text}"`);
  
  // Try calling Hugging Face Inference API
  try {
    let response;
    try {
      response = await axios.post(
        'https://router.huggingface.co/hf-inference/models/law-ai/InLegalBERT',
        { inputs: text },
        {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 7000
        }
      );
    } catch (routeErr) {
      console.warn(`⚠️ [HF Inference] router.huggingface.co failed, trying api-inference...: ${routeErr.message}`);
      response = await axios.post(
        'https://api-inference.huggingface.co/models/law-ai/InLegalBERT',
        { inputs: text },
        {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 7000
        }
      );
    }
    
    if (response && response.data && Array.isArray(response.data)) {
      console.log('✅ [HF Inference] Successfully fetched predictions from Hugging Face');
      return response.data;
    }
  } catch (err) {
    console.warn(`⚠️ [HF Inference] Hugging Face Inference API failed (Reason: ${err.message || err.response?.data?.error}). Falling back to Gemini AI simulation...`);
  }

  // Gemini AI Fallback: Simulate the fill-mask behavior of law-ai/InLegalBERT
  try {
    console.log('🤖 [Gemini AI] Simulating InLegalBERT fill-mask prediction...');
    const prompt = `You are simulating the Hugging Face BERT mask filling model "law-ai/InLegalBERT" specialized in Indian legal corpus (Constitution, IPC, BNS).
Analyze this legal text containing a [MASK] token:
"${text}"

Predict the 5 most likely words to fill the [MASK] token. Focus on accurate legal terms or articles/sections applicable in this context.
For each prediction, provide:
- score: confidence score (a float between 0.0 and 1.0, descending, summing up to approx 1.0)
- token_str: the predicted word or token (e.g., "liberty", "property", "injury", "public")
- sequence: the full sentence with the [MASK] replaced by the predicted token_str.

Format the response ONLY as a valid JSON array of objects (no markdown, no code blocks, no backticks):
[
  { "score": 0.85, "token_str": "...", "sequence": "..." },
  ...
]`;

    const result = await generateContentWithFallback(prompt);
    const resultText = result.response.text().replace(/```json?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(resultText);
  } catch (geminiErr) {
    console.error('❌ [Gemini AI] Fallback mask filling failed:', geminiErr);
    // Ultimate fallback if both fail
    return [
      {
        score: 0.5,
        token_str: "liberty",
        sequence: text.replace('[MASK]', 'liberty')
      }
    ];
  }
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

const generateLegalPetition = async (postData, roomData, extraDetails) => {
  try {
    const contactsText = postData.attachedContacts && postData.attachedContacts.length > 0
      ? postData.attachedContacts.map(c => `  - Officer: ${c.officerName || 'N/A'} (${c.designation || 'N/A'}), Dept: ${c.department}, Phone: ${c.phone?.join(', ') || 'N/A'}, Email: ${c.email || 'N/A'}, Address: ${c.address || 'N/A'}`).join('\n')
      : '  - No official contact mapped yet. (Placeholder: Municipal Commissioner / District Collector)';

    const coordinatesText = postData.location?.coordinates
      ? `Latitude: ${postData.location.coordinates[1]}, Longitude: ${postData.location.coordinates[0]}`
      : 'N/A';

    const postDateText = postData.createdAt 
      ? new Date(postData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';

    const currentDateText = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const docType = extraDetails.docType || 'municipal';
    
    // Compile statutory grounds selected by the user
    let statutoryGroundsText = '';
    if (extraDetails.selectedActs && extraDetails.selectedActs.length > 0) {
      statutoryGroundsText = extraDetails.selectedActs.map((act, i) => 
        `${i + 1}. **${act.actName} (Section/Article: ${act.section})**: ${act.summary}`
      ).join('\n');
    } else {
      // Fallback if no acts were selected
      statutoryGroundsText = `1. **Article 21 of the Constitution of India**: Right to Life and personal liberty, which encompasses the right to safe public infrastructure and hazard-free municipal roads/spaces.\n2. **Tamil Nadu District Municipalities Act, 1920 (Section 162)**: Binding obligations of the municipal corporation and district administration to maintain public streets and public spaces in a safe, motorable, and hazard-free state.`;
    }

    const prompt = `You are a Senior Advocate and expert legal draftsman in Tamil Nadu, India, specializing in Administrative Law, Constitutional Writs, the Right to Information Act, and Public Interest Litigation.
Draft a highly precise, formal, and legally binding document of type "${docType.toUpperCase()}" in clean Markdown.

### CASE FACTS & CONTEXT
1. **Petitioner/Complainant**:
   - Name: ${extraDetails.representativeName}
   - Father's/Spouse's Name: ${extraDetails.petitionerFatherSpouseName}
   - Age: ${extraDetails.petitionerAge} years
   - Residential Address: ${extraDetails.petitionerResidingAddress}
2. **Opposing / Addressed Authority (Respondent)**:
   - Name: ${extraDetails.addressedAuthority || 'N/A'}
   - Department Contacts & Address:
${contactsText}
3. **Core Grievance**:
   - Issue Title: ${postData.title}
   - Description: ${postData.description}
   - Category of Grievance: ${postData.category}
   - Danger Severity: ${postData.severity}
   - Place of Occurrence: ${postData.address || 'N/A'}
   - Geo-coordinates: ${coordinatesText}
   - Originally Reported On: ${postDateText}
   - Current Date of Draft: ${currentDateText}
4. **Legal / Statutory Grounding**:
${statutoryGroundsText}
5. **Specific Demands / Relief (Prayers)**:
${extraDetails.customDemands || 'N/A'}

---

### DRAFTING SPECIFICATIONS BY DOCUMENT TYPE

Based on the Document Type "${docType.toUpperCase()}", apply the following strict structural guidelines:

#### 1. "COLLECTOR" - District Collectorate Public Grievance Representation
- **Layout**: Official Mass Grievance Representation submitted to the District Collector & District Magistrate for Weekly Grievance Day / Administrative Directives.
- **Preamble**:
  - Addressed: "To: The District Collector & District Magistrate, Collectorate Office, ${postData.district || 'District'} District, Tamil Nadu."
  - Subject Line: "SUBJECT: Urgent Public Grievance Representation under Revenue Administration & BNSS Section 152 regarding ${postData.title} at ${postData.address || 'N/A'} - Immediate Field Directives & Inspection Demanded."
  - Reference Line: "REF: Public Complaint Log ID #${postData._id || 'N/A'}."
- **Salutation**: "Respected Collector Sir / Madam,"
- **Body Sections**:
  - **I. Standing of Complainant**: Introduce lead petitioner (${extraDetails.representativeName}, Age ${extraDetails.petitionerAge}, Residing at ${extraDetails.petitionerResidingAddress}) and resident co-signatories.
  - **II. Factual Matrix of Hazard**: Detailed chronological narration of the civic hazard, location (${postData.address || 'N/A'}, Geo-coordinates: ${coordinatesText}), severity (${postData.severity}), and failure of local municipal heads.
  - **III. Statutory Violations & Citable Provisions**: Cite the statutory grounds (${statutoryGroundsText}) and clarify how the ongoing neglect constitutes an active breach of public trust and legal duties.
  - **IV. District Magistrate Directives Demanded**: Demand District Magistrate invoke administrative and magistrate powers to issue immediate field repair orders to delinquent officials, set a 48-hour completion deadline, and order a physical inspection.
- **Closure**: "Yours faithfully," followed by Lead Petitioner Signature Block and space for resident co-signatories.

#### 2. "MUNICIPAL" - Formal Administrative Representation
- **Layout**: Follow standard official memorandum/representation style in India.
- **Preamble**:
  - Addressed "To: [Name & Address of the Addressed Authority]"
  - Subject Line: "SUBJECT: Urgent Representation under Section 162 of the Tamil Nadu District Municipalities Act, 1920 (or relevant municipal act) regarding ${postData.title} at ${postData.address || 'N/A'} - Immediate Redressal Demanded."
  - Reference Line: "REF: Civic Grievance Log ID #${postData._id || 'N/A'} and local community resolutions."
- **Salutation**: "Respected Sir/Madam,"
- **Body Sections**:
  - **I. Introduction of the Petitioner**: Define the representative and local resident community stakes.
  - **II. Factual Matrix**: Detailed chronological narration of the hazard, explaining the specific location, geographic coordinates, severity, and the systemic failure to maintain the civic asset.
  - **III. Statutory Violations & Public Nuisance**: Cite the statutory grounds (${statutoryGroundsText}) and clarify how the ongoing neglect constitutes an active breach of public trust and legal duties.
  - **IV. Interim Remedies & Final Demands**: Explicitly list the demands/prayers.
- **Closure**: "Yours faithfully," followed by the Lead Petitioner's Signature Block and space for co-signatories of the Strike Room.

#### 2. "COURT" - Writ Petition / PIL under Art. 226 of the Constitution of India
- **Layout**: Official Madras High Court (Special Original Jurisdiction) format.
- **Header**:
  \`\`\`markdown
  IN THE HIGH COURT OF JUDICATURE AT MADRAS
  (SPECIAL ORIGINAL JURISDICTION)

  W.P. No. ________ of 2026

  IN THE MATTER OF:
  A Petition under Article 226 of the Constitution of India for the issuance of a Writ of Mandamus, or any other appropriate Writ, Order, or Direction.

  BETWEEN:
  ${extraDetails.representativeName},
  S/o (or D/o or W/o) ${extraDetails.petitionerFatherSpouseName},
  Aged about ${extraDetails.petitionerAge} years,
  Residing at ${extraDetails.petitionerResidingAddress}.
  ... PETITIONER

  AND

  1. ${extraDetails.addressedAuthority || 'The Commissioner / Collector'},
     [Department details & address from: ${contactsText}]
  2. The State of Tamil Nadu,
     Represented by its Secretary, Municipal Administration and Water Supply Department,
     Fort St. George, Chennai - 600009.
  ... RESPONDENTS
  \`\`\`
- **Affidavit Preamble**: "AFFIDAVIT OF THE PETITIONER: I, [Petitioner Name], S/o [Father Name], aged [Age] years, residing at [Address], do hereby solemnly affirm and sincerely state as follows:"
- **Affidavit Paragraphs**:
  - Numbered paragraphs (1, 2, 3...) written in formal first-person legal language (e.g., "1. I am the petitioner herein and as such, I am well acquainted with the facts of the case...", "2. It is submitted that...").
  - Clear narration of facts of the civic hazard, the lack of administrative action, and public danger.
  - Detailed Legal Grounds (Article 21 - Right to Life, and specific sections from statutory grounds: ${statutoryGroundsText}).
  - Statement on lack of alternative, or efficacious remedy.
- **Prayer**: "It is therefore prayed that this Hon'ble Court may be pleased to issue a Writ of Mandamus, or any other appropriate writ, order, or direction in the nature of a writ, directing the Respondents to [specific relief requested], and pass such other or further orders as this Hon'ble Court may deem fit and proper in the circumstances of the case and thus render justice."
- **Verification Clause**: "VERIFICATION: Solemnly affirmed at Chennai on this [Date] and contents verified to be true and correct."

#### 3. "RTI" - Right to Information Act, 2005 Application
- **Layout**: Standard application under Section 6(1) of the RTI Act, 2005.
- **Header**: "APPLICATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005"
- **To**: "To: The Public Information Officer (PIO), [Department Name & Address from: ${contactsText}]"
- **Numbered Fields**:
  - 1. Full Name of the Applicant: ${extraDetails.representativeName}
  - 2. Complete Address for Correspondence: ${extraDetails.petitionerResidingAddress}
  - 3. Particulars of Information Required:
    - Context: Regarding the public hazard of "${postData.title}" located at ${postData.address || 'N/A'} (Coordinates: ${coordinatesText}).
    - Information Queries (Formulate 4-5 precise, sharp questions):
      - Query A: "Provide certified copies of the sanctioned budget, work order, and execution contracts for repair/laying/maintenance of the road/infrastructure at the said location for the fiscal years 2024-25 and 2025-26."
      - Query B: "Provide the name, designation, and contact details of the Junior Engineer (JE) and Assistant Executive Engineer (AEE) responsible for supervising the maintenance of this sector."
      - Query C: "Provide copies of the periodic maintenance logs, inspection reports, and safety audits filed by municipal officers regarding this location in the last 180 days."
      - Query D: "Provide details of all complaints received by the department regarding this specific hazard, along with file notations showing action taken, daily progress sheets, and final status reports."
      - Query E: "State the standard operating procedure (SOP) and timeline mandated by the department for rectifying such hazardous civic conditions."
  - 4. Citizen Declaration: "I hereby declare that I am a citizen of India and am entitled to seek information under the RTI Act, 2005."
  - 5. Application Fee Details: "Enclosed is the application fee of Rs. 10/- by way of Court Fee Stamp / Postal Order No. ________."
  - 6. Medium of Information: "Kindly send the certified documents/information via Registered Post with Acknowledgment Due to the correspondence address mentioned above."
- **Signature Block**: Applicant Signature & Date.

#### 4. "POLICE" - Criminal Complaint / Representation
- **Layout**: Formal police representation under Section 173 of the Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 (formerly Section 154 CrPC) / Sections 290 and 336 of the IPC (or Sections 270 and 125 of BNS, 2023).
- **Address**: "To: The Inspector of Police, [Local Police Station Jurisdiction for ${postData.address || 'N/A'}]"
- **Subject**: "SUBJECT: Criminal Complaint and Representation regarding Public Endangerment, Criminal Negligence, and Maintenance of a Public Nuisance under BNS / IPC and BNSS, 2023."
- **Salutation**: "Respected Sir,"
- **Structure**:
  - **1. Details of Complainant**: ${extraDetails.representativeName}, residing at ${extraDetails.petitionerResidingAddress}.
  - **2. Accused Parties**: The responsible municipal engineering officials, contractors, and public works representatives in charge of Zone/Sector for ${postData.address || 'N/A'}.
  - **3. Statement of Offence**: Detail the hazardous conditions (e.g. open manholes, dangling live cables, deep trenches without signboards/barricades). Highlight that this constitutes a direct, negligent threat to human life and safety, causing an active public nuisance.
  - **4. Relevant Legal Provisions**: Citing Section 152 of the BNSS, 2023 (magistrate's/police power to remove public nuisances/hazards) and substantive provisions on negligent endangerment of personal safety.
  - **5. Action Requested**: Request immediate registration of an FIR/Grievance entry, physical inspection of the site, and issuing of immediate directives to the accused to secure the hazard to prevent loss of human life.
- **Signature Block**: Complainant Signature, Date, and Contact Info.

#### 5. "CONSUMER" - Consumer Forum Notice for Deficiency of Service
- **Layout**: Formal legal notice under Section 2(11) of the Consumer Protection Act, 2019.
- **To**: "To: The Executive Engineer / Zonal Officer, [Department Name & Address from: ${contactsText}]"
- **Subject**: "SUBJECT: Legal Notice for Deficiency of Service under the Consumer Protection Act, 2019, and Compensation Claim for Negligence and Civic Malfeasance."
- **Salutation**: "Sir,"
- **Structure**:
  - **1. Consumer Status**: State that the complainant (${extraDetails.representativeName}) and residents are taxpayers paying municipal taxes/electricity tariffs/water taxes, qualifying them as consumers under the Consumer Protection Act.
  - **2. Deficiency of Service**: Describe the extreme negligence in failing to maintain the civic assets (e.g. broken road, unlit streets, toxic water supply, open drains), which constitutes an active "deficiency in service" as defined under Section 2(11) of the Act.
  - **3. Material Harm & Endangerment**: Describe the risk, mental agony, physical injuries, or damages incurred (pointing to the details in the complaint: "${postData.description}").
  - **4. Legal Notice & Remedy**: Demand that the deficiency be cured and the hazard be rectified within 7 days from the receipt of this notice, failing which a formal complaint will be instituted before the District Consumer Disputes Redressal Commission claiming damages/compensation of Rs. 1,00,000/- for deficiency of service, mental harassment, and endangerment of life.
- **Signature Block**: Consumer's signature.

---

### GENERAL DRAFTING RULES
1. **No Placeholders or Comments**: Use the provided variables directly. Do NOT insert comment tags like "[Insert name here]" if the variable is already provided.
2. **Professional Legal Terminology**: Use authentic Indian legal terms (e.g., "solemnly affirm", "delinquent officials", "deficiency of service", "public nuisance", "statutory duty", "Writ of Mandamus").
3. **No Conversational Filler**: Output ONLY the generated legal document. Do not include any conversational greeting or instruction in your final output.
4. **Format**: Format the output in pristine Markdown with clear headers, indentations, and bullet points where applicable.
`;

    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Error generating legal petition:', err);
    return '## Legal Document Generation Failed\n\nUnable to generate the legal petition draft at this time. Please try again.';
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

// ─────────────────────────────────────────────
// Profanity & Bypass Filtering combo
// ─────────────────────────────────────────────

const getProfanityStats = (text) => {
  if (!text || typeof text !== 'string') return { censoredText: text, count: 0 };
  
  // 1. Normalize the text (homoglyph conversion + accent removal + lowercasing)
  let normalized = text.normalize('NFKC');
  normalized = unhomoglyph(normalized);
  normalized = removeAccents(normalized);
  
  // Map common bypass characters to their alphabetical counterparts
  const bypassMap = {
    '@': 'a',
    '$': 's',
    '!': 'i',
    '1': 'i',
    '0': 'o',
    '3': 'e',
    '4': 'a',
    '5': 's',
  };
  
  let checkText = normalized.split('').map(char => bypassMap[char] || char).join('');

  // 2. Scan with bad-words-next and leo-profanity
  let count = 0;
  const matchedIndices = new Uint8Array(text.length);
  let censoredChars = text.split('');

  const allBadWords = Array.from(new Set([
    ...filter.list()
  ]));

  allBadWords.sort((a, b) => b.length - a.length);

  for (const word of allBadWords) {
    const isTamilScript = /[\u0B80-\u0BFF]/.test(word);
    
    let regexes = [];
    if (isTamilScript) {
      regexes.push(new RegExp(word, 'gi'));
    } else {
      const chars = word.split('');
      const pattern = chars.map((c, idx) => {
        const escaped = c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const repeatable = /[a-zA-Z0-9]/.test(c) ? `${escaped}+` : escaped;
        if (idx === chars.length - 1) return repeatable;
        return repeatable + '[^a-zA-Z0-9]?';
      }).join('');
      
      regexes.push(new RegExp(`\\b${pattern}\\b`, 'gi'));
      regexes.push(new RegExp(pattern, 'gi'));
    }

    for (const regex of regexes) {
      let match;
      const localRegex = new RegExp(regex.source, 'gi');
      while ((match = localRegex.exec(checkText)) !== null) {
        const index = match.index;
        const length = match[0].length;
        
        let alreadyMatched = true;
        for (let i = 0; i < length; i++) {
          if (!matchedIndices[index + i]) {
            alreadyMatched = false;
            matchedIndices[index + i] = true;
          }
        }
        
        if (!alreadyMatched) {
          count++;
          for (let i = 1; i < length; i++) {
            censoredChars[index + i] = '*';
          }
          if (length === 1) {
            censoredChars[index] = '*';
          }
        }
      }
    }
  }

  // Also check and censor using bad-words-next instance
  badwordsNextInstance.filter(checkText, (badword) => {
    const escaped = badword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const localRegex = new RegExp(escaped, 'gi');
    let match;
    while ((match = localRegex.exec(checkText)) !== null) {
      const index = match.index;
      const length = match[0].length;
      let alreadyMatched = true;
      for (let i = 0; i < length; i++) {
        if (!matchedIndices[index + i]) {
          alreadyMatched = false;
          matchedIndices[index + i] = true;
        }
      }
      if (!alreadyMatched) {
        count++;
        for (let i = 1; i < length; i++) {
          censoredChars[index + i] = '*';
        }
        if (length === 1) {
          censoredChars[index] = '*';
        }
      }
    }
  });

  return { censoredText: censoredChars.join(''), count };
};

const censorText = (text) => {
  return getProfanityStats(text).censoredText;
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
  getOfficialsHierarchy,
  suggestLegalActs,
  fillMaskInLegalBERT,
  generateLegalPetition,
  getHaversineDistance,
  censorText,
  getProfanityStats,
  censorCustomWords,
  getDynamicContact,
};
