#!/usr/bin/env node
/**
 * Script to test what version is actually deployed on Render
 * Usage: node test-deployed-version.js https://blindtest-backend-cfbp.onrender.com
 */

const https = require('https');
const http = require('http');

const RENDER_URL = process.argv[2] || 'https://blindtest-backend-cfbp.onrender.com';

console.log('🔍 Testing deployed backend version...\n');
console.log(`URL: ${RENDER_URL}\n`);

// Test 1: Root endpoint
function testRoot() {
  return new Promise((resolve) => {
    const url = new URL(RENDER_URL);
    const client = url.protocol === 'https:' ? https : http;

    console.log('1️⃣ Testing / (root)...');

    const req = client.get(RENDER_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅ Root endpoint responded');
          console.log(`   Version: ${json.version || 'N/A'}`);
          console.log(`   Name: ${json.name || 'N/A'}`);
          console.log(`   Has v2.0 routes: ${json.endpoints ? 'YES' : 'NO'}`);
          if (json.endpoints) {
            console.log(`   Endpoints: ${Object.keys(json.endpoints).length} routes`);
          }
          resolve(true);
        } catch (e) {
          console.log('⚠️  Root endpoint returned non-JSON (might be old version)');
          console.log(`   Response: ${data.substring(0, 100)}...`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Root endpoint error: ${err.message}`);
      resolve(false);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log('❌ Root endpoint timeout');
      resolve(false);
    });
  });
}

// Test 2: Health endpoint
function testHealth() {
  return new Promise((resolve) => {
    const url = new URL(RENDER_URL + '/api/health');
    const client = url.protocol === 'https:' ? https : http;

    console.log('\n2️⃣ Testing /api/health...');

    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 503) {
          try {
            const json = JSON.parse(data);
            console.log('✅ Health endpoint exists (v2.0 confirmed!)');
            console.log(`   Status: ${json.status}`);
            console.log(`   Spotify: ${json.spotify}`);
            console.log(`   Uptime: ${json.uptime}s`);
            console.log(`   Active games: ${json.games?.active || 0}`);
            resolve(true);
          } catch (e) {
            console.log('⚠️  Health endpoint returned non-JSON');
            resolve(false);
          }
        } else if (res.statusCode === 404) {
          console.log('❌ Health endpoint NOT FOUND (404)');
          console.log('   → This means OLD VERSION is deployed!');
          console.log('   → v2.0 has this route, v1.0 does not');
          resolve(false);
        } else {
          console.log(`❌ Health endpoint error: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Health endpoint error: ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        console.log('   → Backend is not running at all');
      }
      resolve(false);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log('❌ Health endpoint timeout (backend might be in cold start)');
      console.log('   → Wait 30-60 seconds and try again');
      resolve(false);
    });
  });
}

// Test 3: Check if old server.js endpoints exist
function testOldVersion() {
  return new Promise((resolve) => {
    console.log('\n3️⃣ Testing for old v1.0 indicators...');

    // In v1.0, /health didn't exist, but / returned different format
    // We already tested this above
    console.log('   (Checking root response format...)');
    resolve();
  });
}

// Main execution
(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const hasRoot = await testRoot();
  const hasHealth = await testHealth();
  await testOldVersion();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 DIAGNOSTIC RESULT:\n');

  if (hasHealth) {
    console.log('✅ v2.0 IS DEPLOYED CORRECTLY!');
    console.log('   → /api/health works');
    console.log('   → Backend should be functional');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify Vercel env: NEXT_PUBLIC_SOCKET_URL=' + RENDER_URL);
    console.log('   2. Verify Render env: CLIENT_URL=<your-vercel-url>');
    console.log('   3. Check browser console for connection errors');
  } else if (hasRoot && !hasHealth) {
    console.log('❌ WRONG VERSION DEPLOYED (likely v1.0)');
    console.log('   → Root endpoint works but /api/health does NOT exist');
    console.log('\n💡 FIX REQUIRED:');
    console.log('   1. Go to Render Dashboard');
    console.log('   2. Settings → Branch: should be "main"');
    console.log('   3. Settings → Start Command: should be "npm start"');
    console.log('   4. Manual Deploy → "Clear build cache & deploy"');
    console.log('   5. Watch logs for: "✅ Spotify authenticated"');
    console.log('   6. Re-run this script after deploy completes');
  } else {
    console.log('❌ BACKEND NOT ACCESSIBLE');
    console.log('   → Cannot reach the backend at all');
    console.log('\n💡 TROUBLESHOOTING:');
    console.log('   1. Check if backend URL is correct');
    console.log('   2. Check Render dashboard - is service running?');
    console.log('   3. If free tier: might be in cold start (wait 60s)');
    console.log('   4. Check Render logs for errors');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
