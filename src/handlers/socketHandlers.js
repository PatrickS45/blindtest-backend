// src/handlers/socketHandlers.js
// Gestion des événements Socket.IO

const Game = require('../models/Game');
const gameEngine = require('../services/gameEngine');
const r2MusicService = require('../services/r2MusicService');
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
 * Génère un ID d'équipe unique
 * @returns {string}
 */
function generateTeamId() {
  return `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * Vérifie si le jeu doit se terminer et émet l'événement game_finished si nécessaire
 * @param {SocketIO.Server} io
 * @param {Game} game
 * @param {string} roomCode
 */
function checkAndEmitGameEnd(io, game, roomCode) {
  if (game.hasReachedMaxRounds()) {
    game.endGame();

    const leaderboard = game.getLeaderboard();
    const teamLeaderboard = game.getTeamLeaderboard();
    const winner = leaderboard[0];
    const winnerTeam = teamLeaderboard.length > 0 ? teamLeaderboard[0] : null;

    // Émettre l'événement de fin de partie avec les résultats finaux
    io.to(roomCode).emit('game_finished', {
      finalLeaderboard: leaderboard,
      teamLeaderboard: teamLeaderboard,
      totalRounds: game.roundNumber,
      message: 'Partie terminée ! Voici le classement final.',
      winner: winner,
      winnerTeam: winnerTeam
    });

    logger.info('Game finished - max rounds reached', {
      roomCode,
      totalRounds: game.roundNumber,
      winner: winner,
      winnerTeam: winnerTeam
    });

    return true; // Game ended
  }
  return false; // Game continues
}

/**
 * Configure tous les handlers Socket.IO
 * @param {SocketIO.Server} io
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('🔌 CLIENT CONNECTED:', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
      timestamp: new Date().toISOString()
    });
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
        const playMode = data?.playMode || 'solo';
        const config = {
          ...validators.validateGameConfig(data?.config),
          playMode
        };

        // Générer code unique
        const roomCode = generateRoomCode();

        // Créer la partie
        const game = new Game(roomCode, socket.id, mode, config);
        games.set(roomCode, game);

        // Joindre la room
        socket.join(roomCode);

        logger.info('Game created', { roomCode, mode, hostId: socket.id });

        const response = { success: true, roomCode, mode, playMode, config };

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
        console.log('🎮 JOIN_GAME event received:', JSON.stringify(data));
        const { roomCode, playerName } = data;

        // Validation
        if (!validators.validateRoomCode(roomCode)) {
          console.log('❌ Invalid room code:', roomCode);
          const response = { success: false, error: ERRORS.INVALID_ROOM_CODE };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        const game = games.get(roomCode);
        if (!game) {
          console.log('❌ Game not found:', roomCode);
          console.log('Available games:', Array.from(games.keys()));
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
          console.log('🔄 RECONNEXION - Joueur trouvé:', {
            name: sanitizedName,
            oldId: existingPlayer.id,
            newId: socket.id,
            currentScore: existingPlayer.score,
            teamId: existingPlayer.teamId || 'none'
          });

          game.reconnectPlayer(existingPlayer.id, socket.id);
          socket.join(roomCode);

          logger.info('Player reconnected', { roomCode, playerName: sanitizedName });

          // Récupérer le joueur avec le nouveau ID après reconnexion
          const reconnectedPlayer = game.getPlayer(socket.id);

          console.log('✅ RECONNEXION - Joueur après mise à jour:', {
            name: reconnectedPlayer.name,
            id: reconnectedPlayer.id,
            score: reconnectedPlayer.score,
            teamId: reconnectedPlayer.teamId || 'none'
          });

          const response = {
            success: true,
            player: reconnectedPlayer,
            players: game.getPlayersArray(),
            teams: Array.from(game.teams.values()),
            mode: game.mode,
            playMode: game.playMode,
            config: game.config
          };

          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('game_joined', response);
        }

        // Nouveau joueur
        console.log('➕ NOUVEAU JOUEUR:', {
          name: sanitizedName,
          socketId: socket.id,
          roomCode: roomCode,
          currentPlayerCount: game.players.size,
          maxPlayers: LIMITS.MAX_PLAYERS
        });

        const player = game.addPlayer(socket.id, sanitizedName);
        socket.join(roomCode);

        logger.info('Player added', { roomCode, playerName: sanitizedName, playerId: player.id });

        // Notifier tous les clients
        io.to(roomCode).emit('player_joined', {
          player,
          players: game.getPlayersArray()
        });

        const response = {
          success: true,
          player,
          players: game.getPlayersArray(),
          teams: Array.from(game.teams.values()),
          mode: game.mode,
          playMode: game.playMode,
          config: game.config
        };

        console.log('✅ Player join successful, response:', JSON.stringify(response));

        if (typeof callback === 'function') {
          return callback(response);
        } else {
          return socket.emit('game_joined', response);
        }

      } catch (error) {
        console.error('❌ ERROR in join_game:', {
          error: error.message,
          stack: error.stack,
          roomCode: data?.roomCode,
          playerName: data?.playerName
        });
        logger.error('Failed to join game', { error: error.message, stack: error.stack });
        const response = { success: false, error: error.message };

        if (typeof callback === 'function') {
          return callback(response);
        } else {
          return socket.emit('game_joined', response);
        }
      }
    });

    // ==================== GESTION DES ÉQUIPES ====================

    // Créer une équipe (Host uniquement)
    socket.on('create_team', (data) => {
      try {
        const { roomCode, teamName, teamColor } = data;

        const game = games.get(roomCode);
        if (!game) {
          return socket.emit('error', { message: 'Partie introuvable' });
        }

        // Vérifier que c'est bien l'hôte
        if (socket.id !== game.hostId) {
          return socket.emit('error', { message: 'Seul l\'hôte peut créer des équipes' });
        }

        // Vérifier le mode équipe
        if (game.playMode !== 'team') {
          return socket.emit('error', { message: 'Le mode équipe n\'est pas activé' });
        }

        // Vérifier la limite d'équipes
        if (game.teams.size >= 6) {
          return socket.emit('error', { message: 'Nombre maximum d\'équipes atteint (6)' });
        }

        // Créer l'équipe
        const teamId = generateTeamId();
        const team = game.createTeam(teamId, teamName, teamColor);

        console.log('👥 ÉQUIPE CRÉÉE:', {
          teamId,
          teamName,
          teamColor,
          totalTeams: game.teams.size
        });

        logger.info('Team created', { roomCode, teamId, teamName });

        // Notifier tous les clients
        io.to(roomCode).emit('team_created', {
          team,
          teams: Array.from(game.teams.values())
        });

      } catch (error) {
        logger.error('Failed to create team', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    // Rejoindre une équipe (Player)
    socket.on('join_team', (data) => {
      try {
        const { roomCode, teamId } = data;

        const game = games.get(roomCode);
        if (!game) {
          return socket.emit('error', { message: 'Partie introuvable' });
        }

        const team = game.teams.get(teamId);
        if (!team) {
          return socket.emit('error', { message: 'Équipe introuvable' });
        }

        // Assigner le joueur à l'équipe
        const success = game.assignPlayerToTeam(socket.id, teamId);
        if (!success) {
          return socket.emit('error', { message: 'Impossible de rejoindre l\'équipe' });
        }

        logger.info('Player joined team', { roomCode, playerId: socket.id, teamId });

        // Notifier tous les clients
        io.to(roomCode).emit('player_joined_team', {
          playerId: socket.id,
          teamId,
          team: game.teams.get(teamId),
          teams: Array.from(game.teams.values())
        });

      } catch (error) {
        logger.error('Failed to join team', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    // Quitter une équipe (Player)
    socket.on('leave_team', (data) => {
      try {
        const { roomCode, playerId } = data;
        const targetPlayerId = playerId || socket.id; // Permet à l'hôte de retirer un joueur

        const game = games.get(roomCode);
        if (!game) {
          return socket.emit('error', { message: 'Partie introuvable' });
        }

        // Vérifier les permissions
        if (targetPlayerId !== socket.id && socket.id !== game.hostId) {
          return socket.emit('error', { message: 'Permission refusée' });
        }

        const player = game.players.get(targetPlayerId);
        if (!player || !player.teamId) {
          return socket.emit('error', { message: 'Joueur non trouvé ou pas dans une équipe' });
        }

        const oldTeamId = player.teamId;
        const success = game.removePlayerFromTeam(targetPlayerId);
        if (!success) {
          return socket.emit('error', { message: 'Impossible de quitter l\'équipe' });
        }

        logger.info('Player left team', { roomCode, playerId: targetPlayerId, teamId: oldTeamId });

        // Notifier tous les clients
        io.to(roomCode).emit('player_left_team', {
          playerId: targetPlayerId,
          teamId: oldTeamId,
          teams: Array.from(game.teams.values())
        });

      } catch (error) {
        logger.error('Failed to leave team', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    // Mettre à jour une équipe (Host uniquement)
    socket.on('update_team', (data) => {
      try {
        const { roomCode, teamId, teamName, teamColor } = data;

        const game = games.get(roomCode);
        if (!game) {
          return socket.emit('error', { message: 'Partie introuvable' });
        }

        // Vérifier que c'est bien l'hôte
        if (socket.id !== game.hostId) {
          return socket.emit('error', { message: 'Seul l\'hôte peut modifier les équipes' });
        }

        const team = game.updateTeam(teamId, teamName, teamColor);
        if (!team) {
          return socket.emit('error', { message: 'Équipe introuvable' });
        }

        logger.info('Team updated', { roomCode, teamId, teamName });

        // Notifier tous les clients
        io.to(roomCode).emit('team_updated', {
          team,
          teams: Array.from(game.teams.values())
        });

      } catch (error) {
        logger.error('Failed to update team', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    // Supprimer une équipe (Host uniquement)
    socket.on('delete_team', (data) => {
      try {
        const { roomCode, teamId } = data;

        const game = games.get(roomCode);
        if (!game) {
          return socket.emit('error', { message: 'Partie introuvable' });
        }

        // Vérifier que c'est bien l'hôte
        if (socket.id !== game.hostId) {
          return socket.emit('error', { message: 'Seul l\'hôte peut supprimer les équipes' });
        }

        const success = game.deleteTeam(teamId);
        if (!success) {
          return socket.emit('error', { message: 'Équipe introuvable' });
        }

        logger.info('Team deleted', { roomCode, teamId });

        // Notifier tous les clients
        io.to(roomCode).emit('team_deleted', {
          teamId,
          teams: Array.from(game.teams.values())
        });

      } catch (error) {
        logger.error('Failed to delete team', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    // Assigner un joueur à une équipe (Host uniquement)
    socket.on('assign_player_to_team', (data) => {
      try {
        const { roomCode, playerId, teamId } = data;

        const game = games.get(roomCode);
        if (!game) {
          return socket.emit('error', { message: 'Partie introuvable' });
        }

        // Vérifier que c'est bien l'hôte
        if (socket.id !== game.hostId) {
          return socket.emit('error', { message: 'Seul l\'hôte peut assigner les joueurs' });
        }

        const success = game.assignPlayerToTeam(playerId, teamId);
        if (!success) {
          return socket.emit('error', { message: 'Impossible d\'assigner le joueur' });
        }

        const player = game.getPlayer(playerId);
        const team = game.teams.get(teamId);
        console.log('👤➡️👥 JOUEUR ASSIGNÉ À ÉQUIPE:', {
          playerId,
          playerName: player?.name,
          teamId,
          teamName: team?.name,
          teamMemberCount: team?.memberIds.length
        });

        logger.info('Player assigned to team', { roomCode, playerId, teamId });

        // Notifier tous les clients
        io.to(roomCode).emit('player_joined_team', {
          playerId,
          teamId,
          team: game.teams.get(teamId),
          teams: Array.from(game.teams.values())
        });

      } catch (error) {
        logger.error('Failed to assign player to team', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    // ==================== REJOINDRE COMME HÔTE (RECONNEXION) ====================
    socket.on('join_as_host', (data) => {
      try {
        console.log('🎬 JOIN_AS_HOST event received:', JSON.stringify(data), 'socketId:', socket.id);
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game) {
          console.log('❌ Game not found for host join:', roomCode);
          logger.warn('Host tried to join non-existent game', { roomCode, socketId: socket.id });
          socket.emit('error', { message: 'Partie introuvable' });
          return;
        }

        // Mettre à jour l'ID du socket de l'hôte (reconnexion)
        const oldHostId = game.hostId;
        game.hostId = socket.id;
        socket.join(roomCode);

        console.log('✅ Host joined room:', roomCode, 'oldHostId:', oldHostId, 'newHostId:', socket.id);
        logger.info('Host reconnected', {
          roomCode,
          oldSocketId: oldHostId,
          newSocketId: socket.id
        });

        // Envoyer l'état actuel de la partie à l'hôte
        socket.emit('game_state', {
          roomCode,
          players: game.getPlayersArray(),
          teams: Array.from(game.teams.values()),
          playMode: game.playMode,
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
        console.log('🎵 LOAD_PLAYLIST event received:', JSON.stringify(data), 'socketId:', socket.id);
        const { roomCode, playlistId: rawPlaylistId } = data;

        const game = games.get(roomCode);
        console.log('🎮 Game found:', !!game, 'Host check:', game ? (game.hostId === socket.id) : 'N/A');

        if (!game || game.hostId !== socket.id) {
          console.log('❌ Unauthorized load_playlist - game:', !!game, 'socketId:', socket.id, 'hostId:', game?.hostId);
          const response = { success: false, error: ERRORS.UNAUTHORIZED };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('playlist_loaded', response);
        }

        console.log('📋 Extracting playlist ID from:', rawPlaylistId?.substring(0, 50));
        // Extraire l'ID de playlist
        const playlistId = validators.extractPlaylistId(rawPlaylistId);
        console.log('🔑 Extracted playlist ID:', playlistId);

        if (!playlistId) {
          console.log('❌ Invalid playlist ID after extraction');
          const response = { success: false, error: ERRORS.INVALID_PLAYLIST_ID };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('playlist_loaded', response);
        }

        logger.info('Loading playlist from R2', { roomCode, playlistId });

        // Charger la playlist depuis R2
        console.log('🎵 Loading playlist from Cloudflare R2:', playlistId);
        const playlist = r2MusicService.getPlaylist(playlistId);
        console.log('✅ Playlist retrieved:', playlist ? playlist.name : 'NULL');

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
        // Log with console.error for immediate visibility
        console.error('❌ PLAYLIST LOAD ERROR:', error.message);
        console.error('Stack:', error.stack);
        console.error('Playlist ID:', data.playlistId);

        logger.error('Failed to load playlist', {
          error: error.message,
          stack: error.stack,
          playlistId: data.playlistId,
          roomCode: data.roomCode
        });

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
        console.log('🎮 START_ROUND event received:', JSON.stringify(data), 'socketId:', socket.id);
        const { roomCode } = data;

        const game = games.get(roomCode);
        if (!game) {
          console.log('❌ Game not found for start_round:', roomCode);
          const response = { success: false, error: 'Game not found' };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('round_started', response);
        }

        if (game.hostId !== socket.id) {
          console.log('❌ Unauthorized start_round - socket:', socket.id, 'hostId:', game.hostId);
          const response = { success: false, error: ERRORS.UNAUTHORIZED };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('round_started', response);
        }

        console.log('✅ Starting round for game:', roomCode);

        if (!game.playlist) {
          console.log('❌ No playlist loaded for game:', roomCode);
          const response = { success: false, error: ERRORS.NO_PLAYLIST };
          if (typeof callback === 'function') {
            return callback(response);
          }
          return socket.emit('round_started', response);
        }

        console.log('📀 Playlist loaded:', game.playlist.name, 'tracks:', game.playlist.usableTracks);

        // Démarrer le round via le moteur
        console.log('🎲 Calling gameEngine.startRound...');
        const round = await gameEngine.startRound(game);
        console.log('✅ Round started successfully, track:', round.track.name);

        // Préparer les données pour le client
        const roundData = round.toClientData(true); // Cacher la réponse

        // Notifier tous les clients
        console.log('📡 Emitting round_started to room:', roomCode);
        console.log('🎮 MODE DE JEU:', {
          mode: game.mode,
          playMode: game.playMode,
          config: game.config
        });
        io.to(roomCode).emit('round_started', {
          roundNumber: game.roundNumber,
          playMode: game.playMode,
          ...roundData
        });

        // IMPORTANT: Envoyer aussi play_track pour la compatibilité frontend
        // Si randomStart est activé, générer un temps de départ aléatoire dans le morceau
        let startTime = 0;
        if (game.config.randomStart) {
          // Générer un temps de départ aléatoire entre 0 et 60 secondes
          // (en supposant que les morceaux font au moins 60s + extractDuration)
          startTime = Math.floor(Math.random() * 60);
          console.log('🎲 Random start time:', startTime, 'seconds');
        }

        console.log('🎵 Emitting play_track - URL:', round.track.preview_url);
        io.to(roomCode).emit('play_track', {
          previewUrl: round.track.preview_url,
          duration: round.config.extractDuration,
          startTime: startTime,
          title: round.track.name,
          artist: round.track.artists?.[0]?.name || 'Unknown'
        });

        // Clear previous timer if exists
        if (game.roundTimer) {
          clearTimeout(game.roundTimer);
        }

        // Démarrer un timer de 30 secondes pour skip automatique
        console.log('⏱️ Starting 30s auto-skip timer');
        game.roundTimer = setTimeout(() => {
          console.log('⏱️ Timer expired - auto-skipping round');

          // Vérifier que le round est toujours actif
          if (game.currentRound && game.currentRound.roundId === round.roundId) {
            // Terminer le round sans gagnant
            game.currentRound.end();

            // Notifier tous les clients
            io.to(roomCode).emit('round_result', {
              playerName: null,
              isCorrect: false,
              pointsAwarded: 0,
              correctAnswer: `${round.track.name} - ${round.track.artists[0].name}`,
              leaderboard: game.getLeaderboard(),
              teamLeaderboard: game.getTeamLeaderboard(),
              timeout: true,
              message: 'Temps écoulé ! Personne n\'a trouvé.'
            });

            // Vérifier si le jeu doit se terminer
            checkAndEmitGameEnd(io, game, roomCode);
          }

          game.roundTimer = null;
        }, 30000); // 30 secondes

        if (typeof callback === 'function') {
          callback({ success: true });
        }

      } catch (error) {
        console.error('❌ ERROR in start_round:', error.message);
        console.error('Stack:', error.stack);
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
        if (!game) {
          console.log('⚠️ Buzz ignored - game not found:', roomCode);
          return;
        }

        const player = game.getPlayer(socket.id);
        if (!player) {
          console.log('⚠️ Buzz ignored - player not found:', socket.id);
          return;
        }

        console.log('📥 BUZZ REÇU:', {
          playerId: socket.id,
          playerName: player.name,
          roomCode: roomCode,
          mode: game.mode,
          roundActive: !!game.currentRound,
          roundEnded: game.currentRound?.endTime ? true : false,
          timestamp: Date.now()
        });

        // Vérifier qu'il y a un round actif et non terminé
        if (!game.currentRound || game.currentRound.endTime) {
          console.log('⚠️ Buzz rejected - no active round');
          return;
        }

        // Enregistrer le buzz
        const buzzData = gameEngine.handleBuzz(game, socket.id, player.name);

        console.log('🔔 BUZZ ACCEPTÉ:', {
          playerId: socket.id,
          playerName: player.name,
          position: buzzData.position,
          mode: game.mode,
          timestamp: Date.now()
        });

        // Confirmation immédiate au joueur qui a buzzé
        socket.emit('buzz_confirmed', {
          position: buzzData.position,
          timestamp: Date.now()
        });

        // Notifier tous les clients
        io.to(roomCode).emit('buzz_locked', {
          ...buzzData,
          playerColor: player.color
        });

        // Stop la musique pour tout le monde
        io.to(roomCode).emit('stop_music');

      } catch (error) {
        // Gérer les cas où le buzz est rejeté
        if (error.message === 'Déjà buzzé' || error.message === 'Quelqu\'un a déjà buzzé') {
          const player = game.getPlayer(socket.id);
          console.log('⚠️ BUZZ REJETÉ:', {
            playerId: socket.id,
            playerName: player?.name,
            reason: error.message,
            mode: game.mode,
            currentBuzzCount: game.currentRound?.buzzOrder?.length || 0,
            timestamp: Date.now()
          });
          // Informer le joueur que son buzz a été rejeté
          socket.emit('buzz_rejected', {
            reason: error.message,
            message: error.message === 'Déjà buzzé'
              ? 'Vous avez déjà buzzé !'
              : 'Quelqu\'un a buzzé avant vous !',
            timestamp: Date.now()
          });
        } else {
          logger.error('Buzz error', { error: error.message, stack: error.stack });
        }
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
        console.log('✅ VALIDATE_ANSWER event received:', JSON.stringify(data), 'socketId:', socket.id);
        const { roomCode, playerId, isCorrect } = data;

        const game = games.get(roomCode);
        if (!game || game.hostId !== socket.id) {
          console.log('❌ Unauthorized validate_answer');
          return;
        }

        // Si playerId n'est pas fourni, utiliser le premier joueur qui a buzzé
        let targetPlayerId = playerId;
        if (!targetPlayerId && game.currentRound) {
          const firstBuzzer = game.currentRound.getFirstBuzzer();
          if (firstBuzzer) {
            targetPlayerId = firstBuzzer.playerId;
            console.log('🔍 Auto-detected buzzed player:', firstBuzzer.playerName, 'id:', targetPlayerId);
          }
        }

        if (!targetPlayerId) {
          console.log('❌ No player to validate - no playerId and no buzzer found');
          return;
        }

        console.log('✅ Validating answer for player:', targetPlayerId, 'isCorrect:', isCorrect);

        if (isCorrect) {
          // Clear le timer de skip automatique
          if (game.roundTimer) {
            clearTimeout(game.roundTimer);
            game.roundTimer = null;
            console.log('⏱️ Round timer cleared - correct answer found');
          }

          // Bonne réponse : fin du round
          const result = gameEngine.validateAnswer(game, targetPlayerId, isCorrect);
          console.log('📊 Validation result (correct):', JSON.stringify(result));

          // Notifier tous les clients de la fin du round
          io.to(roomCode).emit('round_result', result);

          // Vérifier si le jeu doit se terminer
          checkAndEmitGameEnd(io, game, roomCode);
        } else {
          // Mauvaise réponse : appliquer points négatifs et continuer
          console.log('❌ Wrong answer - resuming music for other players');

          const round = game.currentRound;
          const player = game.getPlayer(targetPlayerId);

          let pointsAwarded = 0;
          if (round && player) {
            // Appliquer les points négatifs selon le mode
            const { SCORING_CONFIGS } = require('../config/constants');
            const scoringConfig = SCORING_CONFIGS[game.mode];
            pointsAwarded = scoringConfig?.incorrect || -5;
            player.score += pointsAwarded;

            console.log(`⚠️ Wrong answer penalty: ${pointsAwarded} points for ${player.name}`);

            // Retirer ce joueur de l'ordre de buzz (il ne peut plus buzzer ce round)
            round.buzzOrder = round.buzzOrder.filter(b => b.playerId !== targetPlayerId);
          }

          // Reprendre la musique
          io.to(roomCode).emit('resume_audio');

          // Notifier que la réponse était fausse mais le jeu continue
          io.to(roomCode).emit('wrong_answer_continue', {
            playerName: player?.name,
            pointsAwarded: pointsAwarded,
            leaderboard: game.getLeaderboard(),
            teamLeaderboard: game.getTeamLeaderboard(),
            message: 'Mauvaise réponse, la musique reprend !'
          });
        }

      } catch (error) {
        console.error('❌ ERROR in validate_answer:', error.message);
        console.error('Stack:', error.stack);
        logger.error('Validation error', { error: error.message, stack: error.stack });
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

        // Vérifier si le jeu doit se terminer
        checkAndEmitGameEnd(io, game, roomCode);

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

        // Vérifier si le jeu doit se terminer
        checkAndEmitGameEnd(io, game, roomCode);

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

        // Vérifier si le jeu doit se terminer
        checkAndEmitGameEnd(io, game, roomCode);

      } catch (error) {
        logger.error('Skip round error', { error: error.message });
      }
    });

    // ==================== DÉCONNEXION ====================
    socket.on('disconnect', (reason) => {
      console.log('🔌 CLIENT DISCONNECTED:', {
        socketId: socket.id,
        reason: reason,
        transport: socket.conn?.transport?.name,
        timestamp: new Date().toISOString()
      });
      logger.info('Client disconnected', { socketId: socket.id, reason });

      // Parcourir toutes les parties
      games.forEach((game, roomCode) => {
        const player = game.getPlayer(socket.id);

        if (player) {
          // Marquer le joueur comme déconnecté au lieu de le supprimer immédiatement
          game.disconnectPlayer(socket.id);

          // Notifier les autres joueurs qu'un joueur s'est déconnecté (mais reste dans la partie)
          io.to(roomCode).emit('player_disconnected', {
            playerId: socket.id,
            playerName: player.name,
            players: game.getPlayersArray()
          });

          logger.info('Player disconnected - keeping in game for reconnection', {
            roomCode,
            playerName: player.name
          });

          // Donner une période de grâce de 5 minutes pour la reconnexion
          setTimeout(() => {
            const currentGame = games.get(roomCode);
            if (currentGame) {
              const currentPlayer = currentGame.getPlayer(socket.id);
              // Supprimer uniquement si le joueur n'a pas reconnecté (même ID socket)
              if (currentPlayer && !currentPlayer.isConnected) {
                currentGame.removePlayer(socket.id);

                // Notifier que le joueur a définitivement quitté
                io.to(roomCode).emit('player_left', {
                  playerId: socket.id,
                  playerName: currentPlayer.name,
                  players: currentGame.getPlayersArray()
                });

                logger.info('Player removed after reconnection timeout', {
                  roomCode,
                  playerName: currentPlayer.name
                });
              }
            }
          }, 300000); // 5 minutes de grâce pour reconnexion
        }

        // Si c'est l'hôte, NE PAS supprimer immédiatement
        // Garder la partie active pour reconnexion (par exemple lors du changement de page)
        if (game.hostId === socket.id) {
          logger.info('Host disconnected - keeping game alive for reconnection', { roomCode });

          // Notifier que l'hôte s'est déconnecté (les clients peuvent afficher un message)
          io.to(roomCode).emit('host_disconnected');

          // Supprimer la partie après 5 minutes si l'hôte ne se reconnecte pas
          setTimeout(() => {
            const currentGame = games.get(roomCode);
            // Vérifier que la partie existe toujours et que l'hôte n'a pas changé
            if (currentGame && currentGame.hostId === socket.id) {
              games.delete(roomCode);
              io.to(roomCode).emit('game_ended', { reason: 'Host disconnected' });
              logger.info('Game deleted (host reconnection timeout)', { roomCode });
            }
          }, 300000); // 5 minutes de grâce pour reconnexion (pour permettre le flow OAuth)
        }
      });
    });
  });

  return games; // Exposer pour les routes REST
}

module.exports = { setupSocketHandlers, games };
