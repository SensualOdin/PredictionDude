const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const data = JSON.stringify({
  contents: [{
    parts: [{
      text: "Say hello"
    }]
  }]
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Making direct API request...');

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse:');
    if (res.statusCode === 200) {
      console.log('✅ Success!');
      console.log(JSON.stringify(JSON.parse(responseData), null, 2));
    } else {
      console.log('❌ Error response:');
      console.log(responseData.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();
