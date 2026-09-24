require('dotenv').config();
const fetch = require('node-fetch');

async function testMetaConfig() {
  console.log("=== META DIAGNOSTICS ===");
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  console.log("APP_ID:", appId ? appId.substring(0, 5) + '...' : 'MISSING');
  console.log("APP_SECRET:", appSecret ? appSecret.substring(0, 5) + '...' : 'MISSING');

  // Test App Access Token to verify App ID & Secret validity against Meta
  const url = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("App Token Response:", data);
  } catch (e) {
    console.error("App Token Error:", e);
  }
}

testMetaConfig();
