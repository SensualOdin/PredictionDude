const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
console.log('API Key present:', !!apiKey);
console.log('API Key starts with:', apiKey?.substring(0, 10));

const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
  const models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'];

  for (const modelName of models) {
    try {
      console.log(`\nTesting ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "hello"');
      const response = result.response;
      console.log(`✅ ${modelName} works! Response:`, response.text().substring(0, 50));
    } catch (error) {
      console.log(`❌ ${modelName} failed:`, error.message);
    }
  }
}

testModels();
