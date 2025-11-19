// src/routes/browseRoutes.js
// Routes pour explorer les playlists Spotify disponibles

const express = require('express');
const router = express.Router();
const { getActiveToken, hasValidUserToken } = require('../config/spotify');
const axios = require('axios');

/**
 * GET /browse/featured
 * Récupère les playlists en vedette sur Spotify
 */
router.get('/featured', async (req, res) => {
  try {
    const token = getActiveToken();
    const isUserToken = hasValidUserToken();

    console.log('Fetching featured playlists, using user token:', isUserToken);

    // Try multiple markets in order of preference
    const markets = ['US', 'FR', 'GB'];
    let response = null;
    let lastError = null;

    for (const market of markets) {
      try {
        console.log(`  Trying market=${market}...`);
        response = await axios.get('https://api.spotify.com/v1/browse/featured-playlists', {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            limit: 20,
            market: market  // Use 'market' instead of 'country'
          }
        });
        console.log(`✅ Success with market=${market}`);
        break;
      } catch (err) {
        console.log(`  ❌ market=${market} failed:`, err.response?.status);
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error('All markets failed');
    }

    const playlists = response.data.playlists.items.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image: p.images?.[0]?.url,
      tracks: p.tracks.total,
      url: `https://open.spotify.com/playlist/${p.id}`
    }));

    res.json({
      success: true,
      message: response.data.message,
      playlists
    });

  } catch (error) {
    console.error('Failed to fetch featured playlists:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/**
 * GET /browse/categories
 * Récupère les catégories de playlists
 */
router.get('/categories', async (req, res) => {
  try {
    const token = getActiveToken();

    // Try multiple markets
    const markets = ['US', 'FR', 'GB'];
    let response = null;
    let lastError = null;

    for (const market of markets) {
      try {
        response = await axios.get('https://api.spotify.com/v1/browse/categories', {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            limit: 20,
            market: market,
            locale: 'fr_FR'
          }
        });
        console.log(`✅ Categories success with market=${market}`);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error('All markets failed');
    }

    const categories = response.data.categories.items.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icons?.[0]?.url
    }));

    res.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('Failed to fetch categories:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/**
 * GET /browse/category/:id/playlists
 * Récupère les playlists d'une catégorie
 */
router.get('/category/:id/playlists', async (req, res) => {
  try {
    const token = getActiveToken();
    const categoryId = req.params.id;

    // Try multiple markets
    const markets = ['US', 'FR', 'GB'];
    let response = null;
    let lastError = null;

    for (const market of markets) {
      try {
        response = await axios.get(`https://api.spotify.com/v1/browse/categories/${categoryId}/playlists`, {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            limit: 20,
            market: market
          }
        });
        console.log(`✅ Category playlists success with market=${market}`);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error('All markets failed');
    }

    const playlists = response.data.playlists.items.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image: p.images?.[0]?.url,
      tracks: p.tracks.total,
      url: `https://open.spotify.com/playlist/${p.id}`
    }));

    res.json({
      success: true,
      playlists
    });

  } catch (error) {
    console.error('Failed to fetch category playlists:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;
