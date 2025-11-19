// src/config/spotify.js
// Configuration et authentification Spotify API

const SpotifyWebApi = require('spotify-web-api-node');
const logger = require('../utils/logger');

// OAuth Configuration
const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-private',
  'user-read-email'
];

const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/api/auth/callback';

// Instance Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: REDIRECT_URI
});

// User token storage (in-memory for now, will move to DB later)
let userTokenData = null;

/**
 * Authentifie l'application avec Spotify (Client Credentials)
 * Renouvelle automatiquement le token toutes les 50 minutes
 */
async function authenticateSpotify() {
  try {
    // 🔍 DEBUG: Log credential info (masked)
    console.log('\n🔑 SPOTIFY CREDENTIALS CHECK:');
    console.log('Has Client ID:', !!process.env.SPOTIFY_CLIENT_ID);
    console.log('Has Client Secret:', !!process.env.SPOTIFY_CLIENT_SECRET);
    console.log('Client ID length:', process.env.SPOTIFY_CLIENT_ID?.length || 0);
    console.log('Client Secret length:', process.env.SPOTIFY_CLIENT_SECRET?.length || 0);
    console.log('Client ID (first 10 chars):', process.env.SPOTIFY_CLIENT_ID?.substring(0, 10) + '...');
    console.log('Client Secret (first 10 chars):', process.env.SPOTIFY_CLIENT_SECRET?.substring(0, 10) + '...');

    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);

    const expiresIn = data.body['expires_in']; // 3600 secondes (1h)

    console.log('✅ Token obtained successfully');
    console.log('Token (first 20 chars):', data.body['access_token']?.substring(0, 20) + '...');
    console.log('Expires in:', expiresIn + 's\n');

    logger.info('✅ Spotify authenticated', {
      expiresIn: `${expiresIn}s`,
      nextRefresh: `${Math.floor(expiresIn * 0.83)}s` // 50min
    });

    // Renouveler le token toutes les 50 minutes (avant expiration)
    setTimeout(authenticateSpotify, (expiresIn * 0.83) * 1000);

  } catch (error) {
    console.error('\n❌ SPOTIFY AUTHENTICATION ERROR:');
    console.error('Message:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Body:', JSON.stringify(error.body, null, 2));
    console.error('Full error:', error);

    logger.error('❌ Spotify authentication failed', {
      error: error.message,
      statusCode: error.statusCode,
      body: error.body,
      hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
      hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
      clientIdLength: process.env.SPOTIFY_CLIENT_ID?.length || 0,
      clientSecretLength: process.env.SPOTIFY_CLIENT_SECRET?.length || 0
    });

    // Réessayer après 10 secondes en cas d'échec
    setTimeout(authenticateSpotify, 10000);
  }
}

/**
 * Vérifie si l'API Spotify est accessible
 * @returns {Promise<boolean>}
 */
async function checkSpotifyHealth() {
  try {
    await spotifyApi.getAvailableGenreSeeds();
    return true;
  } catch (error) {
    logger.error('Spotify health check failed', { error: error.message });
    return false;
  }
}

/**
 * Génère l'URL d'autorisation OAuth Spotify
 * @returns {string} URL d'autorisation
 */
function getAuthorizationUrl() {
  return spotifyApi.createAuthorizeURL(SPOTIFY_SCOPES, 'state-random-string');
}

/**
 * Échange le code d'autorisation contre des tokens
 * @param {string} code - Code d'autorisation Spotify
 * @returns {Promise<Object>} Tokens (access_token, refresh_token)
 */
async function exchangeCodeForTokens(code) {
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);

    userTokenData = {
      access_token: data.body['access_token'],
      refresh_token: data.body['refresh_token'],
      expires_in: data.body['expires_in'],
      expires_at: Date.now() + (data.body['expires_in'] * 1000)
    };

    console.log('✅ User token obtained successfully');
    console.log('   Access token (first 20 chars):', userTokenData.access_token.substring(0, 20) + '...');
    console.log('   Refresh token (first 20 chars):', userTokenData.refresh_token.substring(0, 20) + '...');
    console.log('   Expires in:', data.body['expires_in'] + 's');

    // Schedule automatic refresh
    scheduleTokenRefresh();

    return userTokenData;
  } catch (error) {
    console.error('❌ Failed to exchange code for tokens');
    console.error('Error:', error.message);
    throw error;
  }
}

/**
 * Renouvelle le user token avec le refresh token
 * @returns {Promise<Object>} Nouveau access token
 */
async function refreshUserToken() {
  if (!userTokenData || !userTokenData.refresh_token) {
    throw new Error('No refresh token available');
  }

  try {
    console.log('🔄 Refreshing user token...');
    spotifyApi.setRefreshToken(userTokenData.refresh_token);
    const data = await spotifyApi.refreshAccessToken();

    userTokenData.access_token = data.body['access_token'];
    userTokenData.expires_in = data.body['expires_in'];
    userTokenData.expires_at = Date.now() + (data.body['expires_in'] * 1000);

    console.log('✅ User token refreshed successfully');

    // Schedule next refresh
    scheduleTokenRefresh();

    return userTokenData;
  } catch (error) {
    console.error('❌ Failed to refresh user token');
    console.error('Error:', error.message);
    throw error;
  }
}

/**
 * Planifie le renouvellement automatique du token
 */
function scheduleTokenRefresh() {
  if (!userTokenData) return;

  const timeUntilExpiry = userTokenData.expires_at - Date.now();
  const refreshTime = timeUntilExpiry * 0.9; // Refresh at 90% of lifetime

  setTimeout(async () => {
    try {
      await refreshUserToken();
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, refreshTime);

  console.log(`⏰ Next token refresh scheduled in ${Math.floor(refreshTime / 1000)}s`);
}

/**
 * Obtient le token utilisateur actuel (ou null si pas authentifié)
 * @returns {Object|null} User token data
 */
function getUserToken() {
  return userTokenData;
}

/**
 * Vérifie si un user token est disponible et valide
 * @returns {boolean}
 */
function hasValidUserToken() {
  return userTokenData && userTokenData.expires_at > Date.now();
}

/**
 * Obtient le token Spotify à utiliser (user token si disponible, sinon app token)
 * @returns {string} Access token
 */
function getActiveToken() {
  if (hasValidUserToken()) {
    return userTokenData.access_token;
  }
  return spotifyApi.getAccessToken(); // Fallback to app token
}

module.exports = {
  spotifyApi,
  authenticateSpotify,
  checkSpotifyHealth,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshUserToken,
  getUserToken,
  hasValidUserToken,
  getActiveToken,
  SPOTIFY_SCOPES,
  REDIRECT_URI
};
