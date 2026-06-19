require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const key = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(key);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateWithRetry = async (modelName, contents, maxRetries = 2, initialDelay = 1000) => {
  let delay = initialDelay;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const modelInstance = genAI.getGenerativeModel({ model: modelName }, { timeout: 30000 });
      const result = await modelInstance.generateContent(contents);
      if (result && result.response) {
        return result;
      }
    } catch (err) {
      const status = err.status || (err.message && err.message.match(/\[(\d+)\]/)?.[1]);
      const isNotFound = status === 404 || err.message?.includes('404') || err.message?.toLowerCase().includes('not found');
      
      if (isNotFound) {
        throw err;
      }
      
      if (attempt === maxRetries) {
        throw err;
      }
      
      console.warn(`⚠️ [Gemini AI] Model ${modelName} failed on attempt ${attempt + 1}/${maxRetries + 1} (Reason: ${err.message}). Retrying in ${delay}ms...`);
      await sleep(delay);
      delay *= 2;
    }
  }
};

const generateContentWithFallback = async (contents) => {
  const models = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.0-flash'
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

async function run() {
  try {
    console.log('Testing rewriteComplaint prompt formatting...');
    const description = `Report of hazardous road condition. The identified issue is a large and deep pothole. This hazard poses a significant risk to vehicular and pedestrian traffic. On October 26, 2023, at approximately 9:15 PM, an accident occurred at this exact location involving my two-wheeler due to the described road defect. The incident resulted in minor injuries and damage to my two-wheeler's front wheel. Immediate repair of this dangerous road section is imperative to ensure public safety and prevent further incidents.`;
    
    const prompt = `You are an expert writing assistant helping citizens in Tamil Nadu, India format and polish civic complaints for a social/civic platform post.
Polish the user's complaint to make it grammatically correct, highly professional, structured, and clear. 
Always output a bilingual post caption containing a polished English version first, followed by a high-quality Tamil (தமிழ்) translation.
Keep all specific details (landmarks, street names, times, dates, vehicles, severity) intact.
Structure the caption cleanly with clear spacing and sections (e.g. using bullet points for key details) to make it an excellent post caption for a civic platform.
Do not include any introductory remarks, salutations, meta-commentary, or conversational fillers. Just output the English and Tamil caption directly.

User complaint:
"${description}"`;

    const result = await generateContentWithFallback(prompt);
    console.log('\n--- 🎉 REWRITTEN CAPTION ---');
    console.log(result.response.text().trim());
    console.log('----------------------------\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to rewrite:', err.message || err);
    process.exit(1);
  }
}

run();
