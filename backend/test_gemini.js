require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('Testing Gemini API with gemini-3.5-flash...');
const key = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(key);
const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

async function run() {
  try {
    const result = await model.generateContent('Say: "Gemini 3.5 Flash Connection Successful!"');
    console.log('🤖 Response:', result.response.text().trim());
    console.log('✅ Gemini API (gemini-3.5-flash) is fully operational!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gemini API call failed:');
    console.error(err.message || err);
    process.exit(1);
  }
}

run();
