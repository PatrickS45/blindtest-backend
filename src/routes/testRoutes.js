// src/routes/testRoutes.js
// Routes de test pour diagnostiquer les problèmes Spotify

const express = require('express');
const router = express.Router();
const { getActiveToken, hasValidUserToken } = require('../config/spotify');
const axios = require('axios');

/**
 * GET /test/playlists
 * Teste l'accès aux playlists avec différentes approches
 */
router.get('/playlists', async (req, res) => {
  try {
    const token = getActiveToken();
    const isUserToken = hasValidUserToken();

    console.log('\n🧪 TESTING PLAYLIST ACCESS...');
    console.log('Using user token:', isUserToken);
    console.log('Token (first 30 chars):', token.substring(0, 30) + '...');

    const results = {
      tokenType: isUserToken ? 'user' : 'app',
      tests: []
    };

    // Test 1: Get user's playlists (requires user token)
    try {
      console.log('\nTest 1: Fetching user playlists...');
      const userPlaylists = await axios.get('https://api.spotify.com/v1/me/playlists', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { limit: 5 }
      });
      console.log('✅ User playlists OK:', userPlaylists.data.items.map(p => p.name));
      results.tests.push({
        name: 'User playlists',
        success: true,
        count: userPlaylists.data.items.length,
        playlists: userPlaylists.data.items.map(p => ({ id: p.id, name: p.name }))
      });
    } catch (err) {
      console.log('❌ User playlists failed:', err.response?.status, err.response?.data);
      results.tests.push({
        name: 'User playlists',
        success: false,
        error: err.response?.data || err.message
      });
    }

    // Test 2: Get specific Spotify editorial playlist (Today's Top Hits)
    try {
      console.log('\nTest 2: Fetching Today\'s Top Hits (37i9dQZF1DXcBWIGoYBM5M)...');
      const topHits = await axios.get('https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Today\'s Top Hits OK:', topHits.data.name);
      results.tests.push({
        name: 'Today\'s Top Hits',
        success: true,
        playlist: { id: topHits.data.id, name: topHits.data.name, tracks: topHits.data.tracks.total }
      });
    } catch (err) {
      console.log('❌ Today\'s Top Hits failed:', err.response?.status, err.response?.data);
      results.tests.push({
        name: 'Today\'s Top Hits',
        success: false,
        error: err.response?.data || err.message
      });
    }

    // Test 3: Get Top 50 France
    try {
      console.log('\nTest 3: Fetching Top 50 France (37i9dQZEVXbIPWwFssbupI)...');
      const top50 = await axios.get('https://api.spotify.com/v1/playlists/37i9dQZEVXbIPWwFssbupI', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Top 50 France OK:', top50.data.name);
      results.tests.push({
        name: 'Top 50 France',
        success: true,
        playlist: { id: top50.data.id, name: top50.data.name, tracks: top50.data.tracks.total }
      });
    } catch (err) {
      console.log('❌ Top 50 France failed:', err.response?.status, err.response?.data);
      results.tests.push({
        name: 'Top 50 France',
        success: false,
        error: err.response?.data || err.message
      });
    }

    // Test 4: Try with different market parameters
    const markets = ['FR', 'US', 'GB', 'from_token'];
    for (const market of markets) {
      try {
        console.log(`\nTest 4.${markets.indexOf(market) + 1}: Fetching with market=${market}...`);
        const withMarket = await axios.get('https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M', {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { market }
        });
        console.log(`✅ With market=${market} OK:`, withMarket.data.name);
        results.tests.push({
          name: `With market=${market}`,
          success: true,
          playlist: { id: withMarket.data.id, name: withMarket.data.name }
        });
      } catch (err) {
        console.log(`❌ With market=${market} failed:`, err.response?.status, err.response?.data);
        results.tests.push({
          name: `With market=${market}`,
          success: false,
          error: err.response?.data || err.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
