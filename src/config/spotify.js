// src/config/spotify.js
// Configuration et authentification Spotify API

const SpotifyWebApi = require('spotify-web-api-node');
const logger = require('../utils/logger');

// Instance Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

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

module.exports = {
  spotifyApi,
  authenticateSpotify,
  checkSpotifyHealth
};
