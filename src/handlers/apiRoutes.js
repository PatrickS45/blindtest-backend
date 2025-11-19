// src/handlers/apiRoutes.js
// Routes REST API

const express = require('express');
const validators = require('../utils/validators');
const logger = require('../utils/logger');
const musicRoutes = require('../routes/musicRoutes');

/**
 * Configure les routes REST
 * @param {Map} games - Store des parties
 * @returns {express.Router}
 */
function setupApiRoutes(games) {
  const router = express.Router();

  // ==================== MUSIC ROUTES (R2 CUSTOM MUSIC) ====================
  router.use('/music', musicRoutes);

  // ==================== HEALTH CHECK ====================
  router.get('/health', (req, res) => {
    const health = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      storage: 'Cloudflare R2',
      games: {
        active: games.size,
        totalPlayers: Array.from(games.values()).reduce((sum, g) => sum + g.players.size, 0)
      }
    };

    res.status(200).json(health);
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
        storage: {
          type: 'Cloudflare R2',
          enabled: true
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
