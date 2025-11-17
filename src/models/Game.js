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
    this.status = GAME_STATUS.WAITING;
    this.mode = mode;
    this.config = config;
    this.playlist = null;
    this.usedTrackIndices = new Set(); // Indices des tracks déjà joués
    this.currentRound = null;
    this.roundNumber = 0;
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
      joinedAt: Date.now()
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

      logger.info('Player reconnected', {
        roomCode: this.roomCode,
        playerName: player.name,
        oldId: oldPlayerId,
        newId: newPlayerId
      });
    }
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
   * Sérialise la partie pour envoi au client
   * @returns {Object}
   */
  toJSON() {
    return {
      roomCode: this.roomCode,
      status: this.status,
      mode: this.mode,
      playerCount: this.players.size,
      roundNumber: this.roundNumber,
      hasPlaylist: !!this.playlist,
      playlistName: this.playlist?.name
    };
  }
}

module.exports = Game;
