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

      const response = await spotifyApi.getPlaylist(playlistId);
      const playlistData = response.body;

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
      logger.error('Failed to load playlist', {
        playlistId,
        error: error.message,
        statusCode: error.statusCode
      });

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
