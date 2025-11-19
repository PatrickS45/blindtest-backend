// src/handlers/apiRoutes.js
// Routes REST API

const express = require('express');
const spotifyService = require('../services/spotifyService');
const { checkSpotifyHealth } = require('../config/spotify');
const validators = require('../utils/validators');
const logger = require('../utils/logger');
const authRoutes = require('../routes/authRoutes');
const testRoutes = require('../routes/testRoutes');
const browseRoutes = require('../routes/browseRoutes');
const musicRoutes = require('../routes/musicRoutes');

/**
 * Configure les routes REST
 * @param {Map} games - Store des parties
 * @returns {express.Router}
 */
function setupApiRoutes(games) {
  const router = express.Router();

  // ==================== AUTHENTICATION ROUTES ====================
  router.use('/auth', authRoutes);

  // ==================== TEST ROUTES (DEBUG) ====================
  router.use('/test', testRoutes);

  // ==================== BROWSE ROUTES (SPOTIFY DISCOVERY) ====================
  router.use('/browse', browseRoutes);

  // ==================== MUSIC ROUTES (R2 CUSTOM MUSIC) ====================
  router.use('/music', musicRoutes);

  // ==================== HEALTH CHECK ====================
  router.get('/health', async (req, res) => {
    const spotifyHealthy = await checkSpotifyHealth();

    const health = {
      status: 'ok', // Service is ok even without Spotify (R2 is available)
      uptime: process.uptime(),
      timestamp: Date.now(),
      services: {
        spotify: spotifyHealthy ? 'connected' : 'disabled',
        r2: 'enabled', // R2 is always enabled
      },
      games: {
        active: games.size,
        totalPlayers: Array.from(games.values()).reduce((sum, g) => sum + g.players.size, 0)
      }
    };

    res.status(200).json(health);

    if (!spotifyHealthy) {
      logger.info('Health check: Spotify disabled, using R2 for playlists');
    }
  });

  // ==================== RÉCUPÉRER UNE PLAYLIST ====================
  router.get('/spotify/playlist/:id', async (req, res) => {
    try {
      const playlistId = validators.extractPlaylistId(req.params.id);

      if (!playlistId) {
        return res.status(400).json({
          error: 'Invalid playlist ID'
        });
      }

      const playlist = await spotifyService.getPlaylist(playlistId);

      res.json({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        image: playlist.image,
        trackCount: playlist.usableTracks,
        totalTracks: playlist.totalTracks
      });

    } catch (error) {
      logger.error('Playlist API error', { error: error.message });

      // Message spécifique si Spotify n'est pas configuré
      if (error.message && error.message.includes('Spotify')) {
        return res.status(503).json({
          error: 'Spotify API is not configured. Please use R2 playlists instead.',
          hint: 'Visit /playlist-manager.html to create R2 playlists'
        });
      }

      res.status(500).json({
        error: error.message
      });
    }
  });

  // ==================== STATUT D'UNE PARTIE ====================
  router.get('/game/:roomCode/status', (req, res) => {
    try {
      const roomCode = req.params.roomCode.toUpperCase();

      if (!validators.validateRoomCode(roomCode)) {
        return res.status(400).json({
          error: 'Invalid room code'
        });
      }

      const game = games.get(roomCode);

      if (!game) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      res.json({
        roomCode: game.roomCode,
        status: game.status,
        mode: game.mode,
        playerCount: game.players.size,
        hasPlaylist: !!game.playlist,
        playlistName: game.playlist?.name,
        roundNumber: game.roundNumber,
        createdAt: game.createdAt
      });

    } catch (error) {
      logger.error('Game status API error', { error: error.message });
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ==================== LISTE DES PARTIES ACTIVES ====================
  router.get('/games', (req, res) => {
    try {
      const activeGames = Array.from(games.values()).map(game => ({
        roomCode: game.roomCode,
        mode: game.mode,
        playerCount: game.players.size,
        status: game.status,
        hasPlaylist: !!game.playlist
      }));

      res.json({
        total: activeGames.length,
        games: activeGames
      });

    } catch (error) {
      logger.error('Games list API error', { error: error.message });
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ==================== MÉTRIQUES ====================
  router.get('/metrics', (req, res) => {
    try {
      const totalGames = games.size;
      const totalPlayers = Array.from(games.values()).reduce((sum, g) => sum + g.players.size, 0);
      const gamesByMode = {};

      games.forEach(game => {
        gamesByMode[game.mode] = (gamesByMode[game.mode] || 0) + 1;
      });

      const metrics = {
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        },
        games: {
          total: totalGames,
          byMode: gamesByMode
        },
        players: {
          total: totalPlayers,
          average: totalGames > 0 ? (totalPlayers / totalGames).toFixed(2) : 0
        },
        spotify: (() => {
          try {
            return {
              enabled: true,
              cacheStats: spotifyService.getCacheStats()
            };
          } catch {
            return {
              enabled: false,
              message: 'Spotify not configured'
            };
          }
        })(),
        timestamp: Date.now()
      };

      res.json(metrics);

    } catch (error) {
      logger.error('Metrics API error', { error: error.message });
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  return router;
}

module.exports = { setupApiRoutes };
