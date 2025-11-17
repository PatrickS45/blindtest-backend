// src/handlers/apiRoutes.js
// Routes REST API

const express = require('express');
const spotifyService = require('../services/spotifyService');
const { checkSpotifyHealth } = require('../config/spotify');
const validators = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Configure les routes REST
 * @param {Map} games - Store des parties
 * @returns {express.Router}
 */
function setupApiRoutes(games) {
  const router = express.Router();

  // ==================== HEALTH CHECK ====================
  router.get('/health', async (req, res) => {
    const spotifyHealthy = await checkSpotifyHealth();

    const health = {
      status: spotifyHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: Date.now(),
      spotify: spotifyHealthy ? 'connected' : 'disconnected',
      games: {
        active: games.size,
        totalPlayers: Array.from(games.values()).reduce((sum, g) => sum + g.players.size, 0)
      }
    };

    const statusCode = spotifyHealthy ? 200 : 503;
    res.status(statusCode).json(health);

    if (!spotifyHealthy) {
      logger.warn('Health check degraded - Spotify disconnected');
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
        spotify: {
          cacheStats: spotifyService.getCacheStats()
        },
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
