// src/services/spotifyService.js
// Service pour interagir avec Spotify API avec cache

const { spotifyApi } = require('../config/spotify');
const { LIMITS, ERRORS } = require('../config/constants');
const logger = require('../utils/logger');
const NodeCache = require('node-cache');

// Cache pour réduire les appels API (TTL: 1h)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Rate limiter simple
let requestCount = 0;
let requestWindow = Date.now();

class SpotifyService {
  /**
   * Rate limiter: attend si nécessaire pour ne pas dépasser 180 req/min
   */
  async waitIfNeeded() {
    const now = Date.now();

    // Réinitialiser le compteur toutes les minutes
    if (now - requestWindow > 60000) {
      requestCount = 0;
      requestWindow = now;
    }

    // Si limite atteinte, attendre
    if (requestCount >= LIMITS.SPOTIFY_RATE_LIMIT) {
      const waitTime = 60000 - (now - requestWindow);
      logger.warn('Spotify rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      requestCount = 0;
      requestWindow = Date.now();
    }

    requestCount++;
  }

  /**
   * Récupère une playlist Spotify avec filtrage des tracks
   * @param {string} playlistId - ID de la playlist
   * @returns {Promise<Object>}
   */
  async getPlaylist(playlistId) {
    // Vérifier le cache
    const cacheKey = `playlist_${playlistId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info('Playlist from cache', { playlistId });
      return cached;
    }

    try {
      await this.waitIfNeeded();

      // 🔧 Use direct API call instead of buggy library
      console.log('🔍 DEBUG: Fetching playlist via direct API call');
      console.log('Playlist ID:', playlistId);

      const axios = require('axios');
      const token = spotifyApi.getAccessToken();

      const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const playlistData = response.data;

      console.log('✅ Playlist fetched successfully!');
      console.log('Playlist name:', playlistData.name);
      console.log('Total tracks:', playlistData.tracks?.total || 0);

      if (!playlistData || !playlistData.tracks) {
        throw new Error(ERRORS.NO_PLAYLIST);
      }

      // Filtrer et transformer les tracks
      const allTracks = playlistData.tracks.items
        .filter(item => item.track && item.track.preview_url) // ⚠️ FILTRE CRITIQUE
        .map(item => this.transformTrack(item.track));

      // Vérifier qu'il y a assez de tracks
      if (allTracks.length < LIMITS.MIN_TRACKS_WITH_PREVIEW) {
        throw new Error(ERRORS.INSUFFICIENT_TRACKS);
      }

      const playlist = {
        id: playlistData.id,
        name: playlistData.name,
        description: playlistData.description,
        image: playlistData.images?.[0]?.url,
        tracks: allTracks,
        totalTracks: playlistData.tracks.total,
        usableTracks: allTracks.length
      };

      // Mettre en cache
      cache.set(cacheKey, playlist);

      logger.info('Playlist loaded', {
        playlistId,
        name: playlist.name,
        total: playlist.totalTracks,
        usable: playlist.usableTracks
      });

      return playlist;

    } catch (error) {
      // Handle axios errors differently from library errors
      if (error.response) {
        // Axios error with response
        console.error('❌ SPOTIFY API ERROR:');
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        console.error('Headers:', error.response.headers);

        logger.error('Failed to load playlist', {
          playlistId,
          error: error.message,
          statusCode: error.response.status,
          body: error.response.data
        });
      } else {
        // Other errors (network, etc.)
        console.error('❌ REQUEST ERROR:', error.message);
        logger.error('Failed to load playlist', {
          playlistId,
          error: error.message
        });
      }

      if (error.message === ERRORS.INSUFFICIENT_TRACKS) {
        throw error;
      }

      throw new Error(ERRORS.SPOTIFY_ERROR);
    }
  }

  /**
   * Transforme un track Spotify en format interne
   * @param {Object} track - Track Spotify
   * @returns {Object}
   */
  transformTrack(track) {
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => ({
        id: a.id,
        name: a.name
      })),
      album: {
        id: track.album.id,
        name: track.album.name,
        release_date: track.album.release_date,
        image: track.album.images?.[0]?.url
      },
      preview_url: track.preview_url,
      duration_ms: track.duration_ms
    };
  }

  /**
   * Récupère des artistes similaires (pour génération QCM)
   * @param {string} artistId - ID de l'artiste
   * @returns {Promise<Array>}
   */
  async getSimilarArtists(artistId) {
    const cacheKey = `similar_${artistId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      await this.waitIfNeeded();

      // Utiliser les recommendations pour trouver des artistes similaires
      const response = await spotifyApi.getRecommendations({
        seed_artists: [artistId],
        limit: 10
      });

      const artists = response.body.tracks
        .map(t => t.artists[0])
        .filter((artist, index, self) =>
          self.findIndex(a => a.id === artist.id) === index // Dédupliquer
        )
        .map(a => ({ id: a.id, name: a.name }));

      cache.set(cacheKey, artists);
      return artists;

    } catch (error) {
      logger.error('Failed to get similar artists', {
        artistId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Récupère les détails d'un artiste
   * @param {string} artistId
   * @returns {Promise<Object>}
   */
  async getArtist(artistId) {
    const cacheKey = `artist_${artistId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      await this.waitIfNeeded();

      const response = await spotifyApi.getArtist(artistId);
      const artist = {
        id: response.body.id,
        name: response.body.name,
        genres: response.body.genres,
        popularity: response.body.popularity
      };

      cache.set(cacheKey, artist);
      return artist;

    } catch (error) {
      logger.error('Failed to get artist', { artistId, error: error.message });
      return null;
    }
  }

  /**
   * Recherche d'artistes par nom
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async searchArtists(query, limit = 10) {
    try {
      await this.waitIfNeeded();

      const response = await spotifyApi.searchArtists(query, { limit });
      return response.body.artists.items.map(a => ({
        id: a.id,
        name: a.name
      }));

    } catch (error) {
      logger.error('Failed to search artists', { query, error: error.message });
      return [];
    }
  }

  /**
   * Test des credentials Spotify avec différents endpoints
   */
  async testCredentials() {
    console.log('\n🧪 TESTING SPOTIFY CREDENTIALS...\n');

    // First, try a DIRECT API call to bypass the library
    try {
      console.log('🔧 Direct API Test: Calling Spotify API directly...');
      const axios = require('axios');
      const token = spotifyApi.getAccessToken();

      // Try to get a specific track (should always work with valid token)
      const trackResponse = await axios.get('https://api.spotify.com/v1/tracks/11dFghVXANMlKmJXsNCbNl', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Direct API call SUCCESS! Track:', trackResponse.data.name);
      console.log('   Artist:', trackResponse.data.artists[0].name);

    } catch (error) {
      console.error('❌ Direct API call FAILED!');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('This means the token itself is invalid or expired');
      return false;
    }

    try {
      // Test 1: Get available genre seeds (devrait toujours fonctionner)
      console.log('\nTest 1: Getting genre seeds...');
      const genres = await spotifyApi.getAvailableGenreSeeds();
      console.log('✅ Genre seeds OK:', genres.body.genres.slice(0, 5));

      // Test 2: Search for an artist (devrait fonctionner avec Client Credentials)
      console.log('\nTest 2: Searching for artist "Taylor Swift"...');
      const artistSearch = await spotifyApi.searchArtists('Taylor Swift', { limit: 1 });
      if (artistSearch.body.artists.items.length > 0) {
        console.log('✅ Artist search OK:', artistSearch.body.artists.items[0].name);
      }

      // Test 3: Try to get a well-known public playlist
      console.log('\nTest 3: Getting Today\'s Top Hits playlist (37i9dQZF1DXcBWIGoYBM5M)...');
      const playlist = await spotifyApi.getPlaylist('37i9dQZF1DXcBWIGoYBM5M');
      console.log('✅ Playlist OK:', playlist.body.name);

      console.log('\n✅ ALL TESTS PASSED!\n');
      return true;
    } catch (error) {
      console.error('\n❌ LIBRARY TEST FAILED:');
      console.error('Error name:', error.name);
      console.error('Message:', error.message);
      console.error('Status Code:', error.statusCode);
      console.error('Body:', JSON.stringify(error.body, null, 2));
      console.error('Headers:', JSON.stringify(error.headers, null, 2));
      console.error('\n⚠️ The direct API call worked, but the library calls fail.');
      console.error('This might be a bug in spotify-web-api-node v5.0.2');
      console.error('Let\'s try to use the playlist directly...\n');
      return false;
    }
  }

  /**
   * Nettoie le cache (utile pour tests)
   */
  clearCache() {
    cache.flushAll();
    logger.info('Spotify cache cleared');
  }

  /**
   * Obtient les statistiques du cache
   * @returns {Object}
   */
  getCacheStats() {
    return cache.getStats();
  }
}

module.exports = new SpotifyService();
