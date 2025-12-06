// src/models/Game.js
// Modèle de partie de jeu

const { GAME_STATUS, PLAYER_COLORS } = require('../config/constants');
const logger = require('../utils/logger');

class Game {
  constructor(roomCode, hostId, mode, config) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.displayId = null;
    this.players = new Map(); // playerId -> Player object
    this.teams = new Map(); // teamId -> Team object
    this.playMode = config?.playMode || 'solo'; // 'solo' or 'team'
    this.status = GAME_STATUS.WAITING;
    this.mode = mode;
    this.config = config;
    this.playlist = null;
    this.usedTrackIndices = new Set(); // Indices des tracks déjà joués
    this.currentRound = null;
    this.roundNumber = 0;
    this.roundTimer = null; // Timer pour skip automatique après 30s
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    logger.info('Game created', { roomCode, mode });
  }

  /**
   * Ajoute un joueur à la partie
   * @param {string} playerId - Socket ID
   * @param {string} playerName - Nom du joueur
   * @returns {Object} Player object
   */
  addPlayer(playerId, playerName) {
    const playerIndex = this.players.size;
    const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];

    const player = {
      id: playerId,
      name: playerName,
      score: 0,
      color,
      buzzOrder: null,
      qcmAnswer: null,
      isConnected: true,
      joinedAt: Date.now(),
      teamId: null // Ajout pour le mode équipe
    };

    this.players.set(playerId, player);
    this.lastActivity = Date.now();

    logger.info('Player added', {
      roomCode: this.roomCode,
      playerId,
      playerName,
      totalPlayers: this.players.size
    });

    return player;
  }

  /**
   * Trouve un joueur par son nom (pour reconnexion)
   * @param {string} playerName
   * @returns {Object|null}
   */
  findPlayerByName(playerName) {
    for (const player of this.players.values()) {
      if (player.name === playerName) {
        return player;
      }
    }
    return null;
  }

  /**
   * Reconnecte un joueur existant
   * @param {string} oldPlayerId
   * @param {string} newPlayerId
   */
  reconnectPlayer(oldPlayerId, newPlayerId) {
    const player = this.players.get(oldPlayerId);
    if (player) {
      // Mettre à jour l'ID
      this.players.delete(oldPlayerId);
      player.id = newPlayerId;
      player.isConnected = true;
      this.players.set(newPlayerId, player);

      // Mettre à jour les memberIds dans l'équipe si le joueur est dans une équipe
      if (player.teamId) {
        const team = this.teams.get(player.teamId);
        if (team) {
          // Retirer l'ancien ID et ajouter le nouveau
          team.memberIds = team.memberIds.filter(id => id !== oldPlayerId);
          if (!team.memberIds.includes(newPlayerId)) {
            team.memberIds.push(newPlayerId);
          }
          logger.info('Player team membership updated after reconnection', {
            roomCode: this.roomCode,
            playerName: player.name,
            teamId: player.teamId
          });
        }
      }

      logger.info('Player reconnected', {
        roomCode: this.roomCode,
        playerName: player.name,
        oldId: oldPlayerId,
        newId: newPlayerId,
        teamId: player.teamId || 'none'
      });
    }
  }

  /**
   * Marque un joueur comme déconnecté (sans le supprimer)
   * @param {string} playerId
   * @returns {Object|null} Le joueur déconnecté ou null
   */
  disconnectPlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      this.lastActivity = Date.now();
      logger.info('Player marked as disconnected', {
        roomCode: this.roomCode,
        playerId,
        playerName: player.name
      });
      return player;
    }
    return null;
  }

  /**
   * Supprime un joueur
   * @param {string} playerId
   * @returns {boolean}
   */
  removePlayer(playerId) {
    const removed = this.players.delete(playerId);
    if (removed) {
      this.lastActivity = Date.now();
      logger.info('Player removed', { roomCode: this.roomCode, playerId });
    }
    return removed;
  }

  /**
   * Obtient un joueur par son ID
   * @param {string} playerId
   * @returns {Object|null}
   */
  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  /**
   * Obtient tous les joueurs sous forme de tableau
   * @returns {Array}
   */
  getPlayersArray() {
    return Array.from(this.players.values());
  }

  /**
   * Obtient le classement trié par score
   * @returns {Array}
   */
  getLeaderboard() {
    return this.getPlayersArray()
      .sort((a, b) => b.score - a.score)
      .map((p, index) => ({
        rank: index + 1,
        name: p.name,
        score: p.score,
        color: p.color
      }));
  }

  /**
   * Charge une playlist
   * @param {Object} playlist
   */
  setPlaylist(playlist) {
    this.playlist = playlist;
    this.usedTrackIndices.clear();
    this.lastActivity = Date.now();

    logger.info('Playlist loaded', {
      roomCode: this.roomCode,
      playlistName: playlist.name,
      trackCount: playlist.tracks.length
    });
  }

  /**
   * Sélectionne un track aléatoire non joué
   * @returns {Object|null}
   */
  selectRandomTrack() {
    if (!this.playlist || !this.playlist.tracks) {
      return null;
    }

    // Réinitialiser si tous les tracks ont été joués
    if (this.usedTrackIndices.size >= this.playlist.tracks.length) {
      this.usedTrackIndices.clear();
      logger.info('Track pool reset', { roomCode: this.roomCode });
    }

    // Trouver les indices disponibles
    const availableIndices = [];
    for (let i = 0; i < this.playlist.tracks.length; i++) {
      if (!this.usedTrackIndices.has(i)) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length === 0) {
      return null;
    }

    // Sélectionner aléatoirement
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedTrackIndices.add(randomIndex);

    return {
      ...this.playlist.tracks[randomIndex],
      index: randomIndex
    };
  }

  /**
   * Réinitialise les buzzs et réponses QCM
   */
  resetRoundData() {
    for (const player of this.players.values()) {
      player.buzzOrder = null;
      player.qcmAnswer = null;
    }
  }

  /**
   * Vérifie si la partie est inactive
   * @param {number} timeoutMs - Temps d'inactivité en ms
   * @returns {boolean}
   */
  isInactive(timeoutMs) {
    return Date.now() - this.lastActivity > timeoutMs;
  }

  /**
   * Vérifie si la partie a atteint le nombre maximum de manches
   * @returns {boolean}
   */
  hasReachedMaxRounds() {
    return this.roundNumber >= this.config.numberOfRounds;
  }

  /**
   * Termine la partie et définit le statut à FINISHED
   */
  endGame() {
    this.status = GAME_STATUS.FINISHED;
    this.lastActivity = Date.now();

    logger.info('Game ended', {
      roomCode: this.roomCode,
      totalRounds: this.roundNumber,
      finalLeaderboard: this.getLeaderboard()
    });
  }

  /**
   * Crée une nouvelle équipe
   * @param {string} teamId
   * @param {string} teamName
   * @param {string} teamColor
   * @returns {Object}
   */
  createTeam(teamId, teamName, teamColor) {
    const team = {
      id: teamId,
      name: teamName,
      color: teamColor,
      score: 0,
      memberIds: [],
      createdAt: Date.now()
    };

    this.teams.set(teamId, team);
    this.lastActivity = Date.now();

    logger.info('Team created', { roomCode: this.roomCode, teamId, teamName });
    return team;
  }

  /**
   * Met à jour une équipe
   * @param {string} teamId
   * @param {string} teamName
   * @param {string} teamColor
   * @returns {Object|null}
   */
  updateTeam(teamId, teamName, teamColor) {
    const team = this.teams.get(teamId);
    if (!team) return null;

    if (teamName) team.name = teamName;
    if (teamColor) team.color = teamColor;
    this.lastActivity = Date.now();

    logger.info('Team updated', { roomCode: this.roomCode, teamId, teamName });
    return team;
  }

  /**
   * Supprime une équipe
   * @param {string} teamId
   * @returns {boolean}
   */
  deleteTeam(teamId) {
    const team = this.teams.get(teamId);
    if (!team) return false;

    // Retirer tous les joueurs de l'équipe
    for (const player of this.players.values()) {
      if (player.teamId === teamId) {
        player.teamId = null;
      }
    }

    this.teams.delete(teamId);
    this.lastActivity = Date.now();

    logger.info('Team deleted', { roomCode: this.roomCode, teamId });
    return true;
  }

  /**
   * Assigne un joueur à une équipe
   * @param {string} playerId
   * @param {string} teamId
   * @returns {boolean}
   */
  assignPlayerToTeam(playerId, teamId) {
    const player = this.players.get(playerId);
    const team = this.teams.get(teamId);

    if (!player || !team) return false;

    // Retirer de l'ancienne équipe si nécessaire
    if (player.teamId) {
      const oldTeam = this.teams.get(player.teamId);
      if (oldTeam) {
        oldTeam.memberIds = oldTeam.memberIds.filter(id => id !== playerId);
      }
    }

    // Ajouter à la nouvelle équipe
    player.teamId = teamId;
    if (!team.memberIds.includes(playerId)) {
      team.memberIds.push(playerId);
    }

    this.lastActivity = Date.now();

    logger.info('Player assigned to team', {
      roomCode: this.roomCode,
      playerId,
      teamId
    });

    return true;
  }

  /**
   * Retire un joueur d'une équipe
   * @param {string} playerId
   * @returns {boolean}
   */
  removePlayerFromTeam(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.teamId) return false;

    const team = this.teams.get(player.teamId);
    if (team) {
      team.memberIds = team.memberIds.filter(id => id !== playerId);
    }

    player.teamId = null;
    this.lastActivity = Date.now();

    logger.info('Player removed from team', { roomCode: this.roomCode, playerId });
    return true;
  }

  /**
   * Recalcule les scores des équipes
   */
  recalculateTeamScores() {
    // Réinitialiser les scores d'équipe
    for (const team of this.teams.values()) {
      team.score = 0;
    }

    // Sommer les scores des joueurs
    for (const player of this.players.values()) {
      if (player.teamId) {
        const team = this.teams.get(player.teamId);
        if (team) {
          team.score += player.score;
        }
      }
    }
  }

  /**
   * Retourne le classement des équipes
   * @returns {Array}
   */
  getTeamLeaderboard() {
    if (this.playMode !== 'team') return [];

    this.recalculateTeamScores();

    return Array.from(this.teams.values())
      .sort((a, b) => b.score - a.score)
      .map(team => ({
        id: team.id,
        name: team.name,
        color: team.color,
        score: team.score,
        memberIds: team.memberIds,
        createdAt: team.createdAt
      }));
  }

  /**
   * Sérialise la partie pour envoi au client
   * @returns {Object}
   */
  toJSON() {
    return {
      roomCode: this.roomCode,
      status: this.status,
      mode: this.mode,
      playMode: this.playMode,
      playerCount: this.players.size,
      teamCount: this.teams.size,
      roundNumber: this.roundNumber,
      hasPlaylist: !!this.playlist,
      playlistName: this.playlist?.name
    };
  }
}

module.exports = Game;
