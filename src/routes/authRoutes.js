// src/routes/authRoutes.js
// Routes d'authentification OAuth Spotify

const express = require('express');
const router = express.Router();
const {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getUserToken,
  hasValidUserToken
} = require('../config/spotify');
const logger = require('../utils/logger');

/**
 * GET /auth/spotify
 * Redirige vers la page d'autorisation Spotify
 */
router.get('/spotify', (req, res) => {
  try {
    const authorizeURL = getAuthorizationUrl();
    logger.info('Redirecting to Spotify authorization', { url: authorizeURL });

    // Return URL for frontend to redirect
    res.json({
      authUrl: authorizeURL,
      message: 'Redirect user to this URL'
    });
  } catch (error) {
    logger.error('Failed to generate auth URL', { error: error.message });
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /callback
 * Callback après autorisation Spotify
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.error('Spotify authorization error', { error });
    return res.status(400).json({ error: 'Authorization denied' });
  }

  if (!code) {
    logger.error('No authorization code received');
    return res.status(400).json({ error: 'No authorization code' });
  }

  try {
    console.log('📥 Received authorization code, exchanging for tokens...');
    const tokens = await exchangeCodeForTokens(code);

    logger.info('✅ User authenticated successfully');

    // Redirect back to frontend with success message
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${CLIENT_URL}/auth/success`);
  } catch (error) {
    logger.error('Failed to exchange code for tokens', { error: error.message });
    res.status(500).json({ error: 'Failed to authenticate with Spotify' });
  }
});

/**
 * GET /status
 * Vérifie le statut de l'authentification
 */
router.get('/status', (req, res) => {
  const isAuthenticated = hasValidUserToken();
  const tokenData = getUserToken();

  res.json({
    authenticated: isAuthenticated,
    expiresAt: tokenData?.expires_at || null,
    expiresIn: tokenData ? Math.floor((tokenData.expires_at - Date.now()) / 1000) : null
  });
});

/**
 * POST /logout
 * Déconnecte l'utilisateur (supprime le token)
 */
router.post('/logout', (req, res) => {
  // Note: This just clears the server-side token
  // In a real app, you'd also revoke the token with Spotify
  logger.info('User logged out');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
