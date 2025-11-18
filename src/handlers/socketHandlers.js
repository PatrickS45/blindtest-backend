// src/handlers/socketHandlers.js
// Gestion des événements Socket.IO

const Game = require('../models/Game');
const gameEngine = require('../services/gameEngine');
const spotifyService = require('../services/spotifyService');
const validators = require('../utils/validators');
const logger = require('../utils/logger');
const { GAME_MODES, LIMITS, ERRORS } = require('../config/constants');

// Store global des parties (en mémoire)
const games = new Map();

/**
 * Génère un code de partie unique
 * @returns {string}
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    code = '';
    for (let i = 0; i < LIMITS.ROOM_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (games.has(code) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Impossible de générer un code unique');
  }

  return code;
}

/**
 * Nettoie les parties inactives
 */
function cleanupInactiveGames() {
  const now = Date.now();

  games.forEach((game, roomCode) => {
    if (game.isInactive(LIMITS.GAME_TIMEOUT_MS) && game.players.size === 0) {
      games.delete(roomCode);
      logger.info('Inactive game removed', { roomCode });
    }
  });
}

// Nettoyage toutes les 5 minutes
setInterval(cleanupInactiveGames, 5 * 60 * 1000);

/**
 * Configure tous les handlers Socket.IO
 * @param {SocketIO.Server} io
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // ==================== CRÉATION DE PARTIE ====================
    socket.on('create_game', (data, callback) => {
      try {
        // Vérifier la limite de parties actives
        if (games.size >= LIMITS.MAX_ACTIVE_GAMES) {
          const response = {
            success: false,
            error: 'Serveur plein, réessayez dans quelques minutes'
          };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_created', response);
        }

        const mode = data?.mode || GAME_MODES.ACCUMUL_POINTS;
        const config = validators.validateGameConfig(data?.config);

        // Générer code unique
        const roomCode = generateRoomCode();

        // Créer la partie
        const game = new Game(roomCode, socket.id, mode, config);
        games.set(roomCode, game);

        // Joindre la room
        socket.join(roomCode);

        logger.info('Game created', { roomCode, mode, hostId: socket.id });

        const response = { success: true, roomCode, mode, config };

        // Support both callback and event emission
        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('game_created', response);
        }

      } catch (error) {
        logger.error('Failed to create game', { error: error.message, stack: error.stack });
        const response = { success: false, error: error.message };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('game_created', response);
        }
      }
    });

    // ==================== REJOINDRE UNE PARTIE ====================
    socket.on('join_game', (data, callback) => {
      try {
        const { roomCode, playerName } = data;

        // Validation
        if (!validators.validateRoomCode(roomCode)) {
          const response = { success: false, error: ERRORS.INVALID_ROOM_CODE };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        const game = games.get(roomCode);
        if (!game) {
          const response = { success: false, error: ERRORS.GAME_NOT_FOUND };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        // Mode Display
        if (playerName && playerName.startsWith('Display-')) {
          game.displayId = socket.id;
          socket.join(roomCode);
          logger.info('Display joined', { roomCode, displayId: socket.id });

          const response = {
            success: true,
            isDisplay: true,
            players: game.getPlayersArray(),
            mode: game.mode,
            config: game.config
          };

          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        // Validation nom de joueur
        const sanitizedName = validators.sanitizePlayerName(playerName);
        if (!sanitizedName) {
          const response = { success: false, error: 'Nom invalide' };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        // Vérifier limite de joueurs
        if (game.players.size >= LIMITS.MAX_PLAYERS) {
          const response = { success: false, error: ERRORS.MAX_PLAYERS_REACHED };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        // Reconnexion
        const existingPlayer = game.findPlayerByName(sanitizedName);
        if (existingPlayer) {
          game.reconnectPlayer(existingPlayer.id, socket.id);
          socket.join(roomCode);

          logger.info('Player reconnected', { roomCode, playerName: sanitizedName });

          const response = {
            success: true,
            player: existingPlayer,
            players: game.getPlayersArray(),
            mode: game.mode,
            config: game.config
          };

          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        // Nouveau joueur
        const player = game.addPlayer(socket.id, sanitizedName);
        socket.join(roomCode);

        // Notifier tous les clients
        io.to(roomCode).emit('player_joined', {
          player,
          players: game.getPlayersArray()
        });

        const response = {
          success: true,
          player,
          players: game.getPlayersArray(),
          mode: game.mode,
          config: game.config
        };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('game_joined', response);
        }

      } catch (error) {
        logger.error('Failed to join game', { error: error.message, stack: error.stack });
        const response = { success: false, error: error.message };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('game_joined', response);
        }
      }
    });

    // ==================== REJOINDRE COMME HÔTE (RECONNEXION) ====================
    socket.on('join_as_host', (data) => {
      try {
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game) {
          logger.warn('Host tried to join non-existent game', { roomCode, socketId: socket.id });
          socket.emit('error', { message: 'Partie introuvable' });
          return;
        }

        // Mettre à jour l'ID du socket de l'hôte (reconnexion)
        const oldHostId = game.hostId;
        game.hostId = socket.id;
        socket.join(roomCode);

        logger.info('Host reconnected', {
          roomCode,
          oldSocketId: oldHostId,
          newSocketId: socket.id
        });

        // Envoyer l'état actuel de la partie à l'hôte
        socket.emit('game_state', {
          roomCode,
          players: game.getPlayersArray(),
          mode: game.mode,
          status: game.status,
          playlist: game.playlist ? {
            name: game.playlist.name,
            trackCount: game.playlist.usableTracks
          } : null,
          roundNumber: game.roundNumber
        });

      } catch (error) {
        logger.error('Failed to join as host', { error: error.message, stack: error.stack });
        socket.emit('error', { message: error.message });
      }
    });

    // ==================== CHARGER PLAYLIST ====================
    socket.on('load_playlist', async (data, callback) => {
      try {
        const { roomCode, playlistId: rawPlaylistId } = data;

        const game = games.get(roomCode);
        if (!game || game.hostId !== socket.id) {
          const response = { success: false, error: ERRORS.UNAUTHORIZED };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('playlist_loaded', response);
        }

        // Extraire l'ID de playlist
        const playlistId = validators.extractPlaylistId(rawPlaylistId);
        if (!playlistId) {
          const response = { success: false, error: ERRORS.INVALID_PLAYLIST_ID };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('playlist_loaded', response);
        }

        logger.info('Loading playlist', { roomCode, playlistId });

        // Charger depuis Spotify
        const playlist = await spotifyService.getPlaylist(playlistId);

        // Sauvegarder dans la partie
        game.setPlaylist(playlist);

        // Notifier tous les clients
        io.to(roomCode).emit('playlist_loaded', {
          playlistName: playlist.name,
          trackCount: playlist.usableTracks,
          image: playlist.image
        });

        const response = {
          success: true,
          playlist: {
            id: playlist.id,
            name: playlist.name,
            trackCount: playlist.usableTracks,
            image: playlist.image
          }
        };

        if (typeof callback === 'function') {
          callback(response);
        }

      } catch (error) {
        logger.error('Failed to load playlist', { error: error.message, stack: error.stack });
        const response = {
          success: false,
          error: error.message === ERRORS.INSUFFICIENT_TRACKS
            ? ERRORS.INSUFFICIENT_TRACKS
            : ERRORS.SPOTIFY_ERROR
        };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('playlist_loaded', response);
        }
      }
    });

    // ==================== DÉMARRER UN ROUND ====================
    socket.on('start_round', async (data, callback) => {
      try {
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game || game.hostId !== socket.id) {
          const response = { success: false, error: ERRORS.UNAUTHORIZED };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('round_started', response);
        }

        if (!game.playlist) {
          const response = { success: false, error: ERRORS.NO_PLAYLIST };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('round_started', response);
        }

        // Démarrer le round via le moteur
        const round = await gameEngine.startRound(game);

        // Préparer les données pour le client
        const roundData = round.toClientData(true); // Cacher la réponse

        // Notifier tous les clients
        io.to(roomCode).emit('round_started', {
          roundNumber: game.roundNumber,
          ...roundData
        });

        if (typeof callback === 'function') {
          callback({ success: true });
        }

      } catch (error) {
        logger.error('Failed to start round', { error: error.message, stack: error.stack });
        const response = { success: false, error: error.message };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('round_started', response);
        }
      }
    });

    // ==================== BUZZER ====================
    socket.on('buzz', (data) => {
      try {
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game) return;

        const player = game.getPlayer(socket.id);
        if (!player) return;

        // Enregistrer le buzz
        const buzzData = gameEngine.handleBuzz(game, socket.id, player.name);

        // Notifier tous les clients
        io.to(roomCode).emit('buzz_locked', {
          ...buzzData,
          playerColor: player.color
        });

        // Stop la musique pour tout le monde
        io.to(roomCode).emit('stop_music');

      } catch (error) {
        logger.error('Buzz error', { error: error.message });
      }
    });

    // ==================== RÉPONSE QCM ====================
    socket.on('submit_qcm_answer', (data, callback) => {
      try {
        const { roomCode, optionIndex } = data;

        const game = games.get(roomCode);
        if (!game) {
          const response = { success: false, error: ERRORS.GAME_NOT_FOUND };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('qcm_answer_received', response);
        }

        // Enregistrer la réponse
        gameEngine.handleQCMAnswer(game, socket.id, optionIndex);

        if (typeof callback === 'function') {
          callback({ success: true });
        } else {
          socket.emit('qcm_answer_received', { success: true });
        }

      } catch (error) {
        logger.error('QCM answer error', { error: error.message, stack: error.stack });
        const response = { success: false, error: error.message };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('qcm_answer_received', response);
        }
      }
    });

    // ==================== VALIDATION RÉPONSE (HOST) ====================
    socket.on('validate_answer', (data) => {
      try {
        const { roomCode, playerId, isCorrect } = data;

        const game = games.get(roomCode);
        if (!game || game.hostId !== socket.id) return;

        // Valider via le moteur
        const result = gameEngine.validateAnswer(game, playerId, isCorrect);

        // Notifier tous les clients
        io.to(roomCode).emit('round_result', result);

      } catch (error) {
        logger.error('Validation error', { error: error.message });
      }
    });

    // ==================== VALIDATION QCM (AUTO) ====================
    socket.on('validate_qcm', (data) => {
      try {
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game || game.hostId !== socket.id) return;

        // Valider toutes les réponses
        const result = gameEngine.validateQCMAnswers(game);

        // Notifier tous les clients
        io.to(roomCode).emit('qcm_result', result);

      } catch (error) {
        logger.error('QCM validation error', { error: error.message });
      }
    });

    // ==================== SÉLECTION CIBLE (TUEURS À GAGES) ====================
    socket.on('select_target', (data) => {
      try {
        const { roomCode, targetId } = data;

        const game = games.get(roomCode);
        if (!game) return;

        gameEngine.selectTarget(game, targetId);

        // Notifier tous les clients
        io.to(roomCode).emit('target_selected', { targetId });

      } catch (error) {
        logger.error('Target selection error', { error: error.message });
      }
    });

    // ==================== EXPLOSION BOMBE (CHAUD DEVANT) ====================
    socket.on('bomb_exploded', (data) => {
      try {
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game) return;

        const result = gameEngine.handleBombExplosion(game);

        // Notifier tous les clients
        io.to(roomCode).emit('bomb_explosion_result', result);

      } catch (error) {
        logger.error('Bomb explosion error', { error: error.message });
      }
    });

    // ==================== SKIP ROUND ====================
    socket.on('skip_round', (data) => {
      try {
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game || game.hostId !== socket.id) return;

        const result = gameEngine.skipRound(game);

        // Notifier tous les clients
        io.to(roomCode).emit('round_skipped', result);

      } catch (error) {
        logger.error('Skip round error', { error: error.message });
      }
    });

    // ==================== DÉCONNEXION ====================
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });

      // Parcourir toutes les parties
      games.forEach((game, roomCode) => {
        const player = game.getPlayer(socket.id);

        if (player) {
          // Supprimer le joueur
          game.removePlayer(socket.id);

          // Notifier les autres
          io.to(roomCode).emit('player_left', {
            playerId: socket.id,
            playerName: player.name,
            players: game.getPlayersArray()
          });

          logger.info('Player left', { roomCode, playerName: player.name });
        }

        // Si c'est l'hôte, NE PAS supprimer immédiatement
        // Garder la partie active pour reconnexion (par exemple lors du changement de page)
        if (game.hostId === socket.id) {
          logger.info('Host disconnected - keeping game alive for reconnection', { roomCode });

          // Notifier que l'hôte s'est déconnecté (les clients peuvent afficher un message)
          io.to(roomCode).emit('host_disconnected');

          // Supprimer la partie après 60 secondes si l'hôte ne se reconnecte pas
          setTimeout(() => {
            const currentGame = games.get(roomCode);
            // Vérifier que la partie existe toujours et que l'hôte n'a pas changé
            if (currentGame && currentGame.hostId === socket.id) {
              games.delete(roomCode);
              io.to(roomCode).emit('game_ended', { reason: 'Host disconnected' });
              logger.info('Game deleted (host reconnection timeout)', { roomCode });
            }
          }, 60000); // 60 secondes de grâce pour reconnexion
        }
      });
    });
  });

  return games; // Exposer pour les routes REST
}

module.exports = { setupSocketHandlers, games };
