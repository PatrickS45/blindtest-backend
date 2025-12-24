// src/models/Round.js
// Modèle de manche/round

const crypto = require('crypto');
const { GAME_MODES } = require('../config/constants');

class Round {
  constructor(mode, track, config) {
    this.roundId = this.generateId();
    this.mode = mode;
    this.track = track;
    this.config = config;
    this.qcm = null; // Sera défini pour le mode QCM
    this.hints = []; // Indices pour Questions en Rafale
    this.bombHolder = null; // Pour mode Chaud Devant
    this.bombTimer = null;
    this.startTime = null;
    this.endTime = null;
    this.buzzOrder = []; // [{ playerId, playerName, timestamp }]
    this.answers = new Map(); // playerId -> { answer, timestamp }
    this.result = null;
    this.selectedTarget = null; // Pour mode Tueurs à Gages
    this.startOffset = this.calculateStartOffset(); // Offset de démarrage pour randomStart
  }

  /**
   * Calcule l'offset de démarrage aléatoire si randomStart est activé
   * @returns {number} Offset en secondes (0 si randomStart désactivé)
   */
  calculateStartOffset() {
    if (!this.config.randomStart) {
      return 0;
    }

    // Démarrage aléatoire entre 10% et 70% de la durée du track
    // Supposons que la durée du track est dans track.duration_ms (Spotify format)
    const trackDuration = this.track.duration_ms ? this.track.duration_ms / 1000 : 180; // Défaut 3 minutes si non spécifié

    // Calculer un offset aléatoire entre 10% et 70%
    const minPercent = 0.10;
    const maxPercent = 0.70;
    const randomPercent = minPercent + Math.random() * (maxPercent - minPercent);

    return Math.floor(trackDuration * randomPercent);
  }

  /**
   * Génère un ID unique pour le round
   * @returns {string}
   */
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Démarre le round
   */
  start() {
    this.startTime = Date.now();
  }

  /**
   * Termine le round
   */
  end() {
    this.endTime = Date.now();
  }

  /**
   * Enregistre un buzz
   * @param {string} playerId
   * @param {string} playerName
   * @returns {number} Position du buzz
   */
  recordBuzz(playerId, playerName) {
    const timestamp = Date.now();
    this.buzzOrder.push({ playerId, playerName, timestamp });
    return this.buzzOrder.length;
  }

  /**
   * Vérifie si un joueur a déjà buzzé
   * @param {string} playerId
   * @returns {boolean}
   */
  hasBuzzed(playerId) {
    return this.buzzOrder.some(b => b.playerId === playerId);
  }

  /**
   * Obtient le premier joueur qui a buzzé
   * @returns {Object|null}
   */
  getFirstBuzzer() {
    return this.buzzOrder.length > 0 ? this.buzzOrder[0] : null;
  }

  /**
   * Enregistre une réponse QCM
   * @param {string} playerId
   * @param {number} optionIndex
   */
  recordAnswer(playerId, optionIndex) {
    this.answers.set(playerId, {
      optionIndex,
      timestamp: Date.now()
    });
  }

  /**
   * Vérifie si un joueur a répondu
   * @param {string} playerId
   * @returns {boolean}
   */
  hasAnswered(playerId) {
    return this.answers.has(playerId);
  }

  /**
   * Obtient la réponse d'un joueur
   * @param {string} playerId
   * @returns {Object|null}
   */
  getAnswer(playerId) {
    return this.answers.get(playerId) || null;
  }

  /**
   * Définit le QCM pour ce round
   * @param {Object} qcm
   */
  setQCM(qcm) {
    this.qcm = qcm;
  }

  /**
   * Définit les indices pour ce round
   * @param {Array} hints
   */
  setHints(hints) {
    this.hints = hints;
  }

  /**
   * Définit le porteur de la bombe
   * @param {string} playerId
   */
  setBombHolder(playerId) {
    this.bombHolder = playerId;
  }

  /**
   * Définit la cible (mode Tueurs à Gages)
   * @param {string} playerId
   */
  setTarget(playerId) {
    this.selectedTarget = playerId;
  }

  /**
   * Calcule la durée du round en secondes
   * @returns {number}
   */
  getDuration() {
    if (!this.startTime || !this.endTime) return 0;
    return (this.endTime - this.startTime) / 1000;
  }

  /**
   * Prépare les données du round pour envoi au client
   * @param {boolean} hideAnswer - Cacher la réponse correcte
   * @returns {Object}
   */
  toClientData(hideAnswer = true) {
    const data = {
      roundId: this.roundId,
      mode: this.mode,
      config: this.config
    };

    // Pour TRIVIA mode, pas de track audio
    if (this.mode === GAME_MODES.TRIVIA) {
      data.track = {
        id: this.track.id,
        category: this.track.category,
        difficulty: this.track.difficulty
      };
    } else {
      // Pour les modes musicaux
      data.track = {
        id: this.track.id,
        previewUrl: this.track.preview_url,
        duration: this.config.extractDuration,
        startOffset: this.startOffset // Offset de démarrage en secondes
      };
    }

    // Ajouter le QCM si présent (sans dévoiler la réponse)
    if (this.qcm) {
      data.qcm = {
        type: this.qcm.type,
        question: this.qcm.question,
        options: hideAnswer
          ? this.qcm.options.map(opt => ({ text: opt.text }))
          : this.qcm.options
      };
    }

    // Ajouter les indices si présents
    if (this.hints.length > 0) {
      data.hints = this.hints;
    }

    // Ajouter le porteur de bombe si présent
    if (this.bombHolder) {
      data.bombHolder = this.bombHolder;
    }

    return data;
  }

  /**
   * Sérialise le résultat du round
   * @returns {Object}
   */
  getResult() {
    return {
      roundId: this.roundId,
      correctAnswer: this.result?.correctAnswer,
      winners: this.result?.winners || [],
      duration: this.getDuration()
    };
  }
}

module.exports = Round;
