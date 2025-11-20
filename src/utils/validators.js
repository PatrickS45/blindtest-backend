// src/utils/validators.js
// Validation et sanitization des entrées utilisateur

const { LIMITS } = require('../config/constants');

/**
 * Valide un code de partie (4 caractères alphanumériques)
 * @param {string} code
 * @returns {boolean}
 */
function validateRoomCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9]{4}$/.test(code);
}

/**
 * Valide un ID de playlist Spotify (22 caractères alphanumériques)
 * @param {string} id
 * @returns {boolean}
 */
function validatePlaylistId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9]{22}$/.test(id);
}

/**
 * Valide un ID de playlist R2 (32 caractères hexadécimaux MD5)
 * @param {string} id
 * @returns {boolean}
 */
function validateR2PlaylistId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-f0-9]{32}$/.test(id);
}

/**
 * Extrait l'ID de playlist depuis une URL Spotify ou un ID R2
 * @param {string} input - URL Spotify, ID Spotify, ou ID R2
 * @returns {string|null}
 */
function extractPlaylistId(input) {
  if (!input) return null;

  // Si c'est un ID R2 valide (32 caractères hex)
  if (validateR2PlaylistId(input)) return input;

  // Si c'est un ID Spotify valide (22 caractères)
  if (validatePlaylistId(input)) return input;

  // Extraire depuis URL Spotify
  // Format: https://open.spotify.com/playlist/{id}?...
  const urlMatch = input.match(/playlist\/([a-zA-Z0-9]{22})/);
  if (urlMatch) return urlMatch[1];

  // Format: spotify:playlist:{id}
  const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]{22})/);
  if (uriMatch) return uriMatch[1];

  return null;
}

/**
 * Nettoie et valide un nom de joueur
 * @param {string} name
 * @returns {string|null}
 */
function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') return null;

  // Supprimer espaces, limiter à 20 caractères
  const cleaned = name.trim().slice(0, LIMITS.MAX_PLAYER_NAME_LENGTH);

  // Vérifier qu'il reste au moins 1 caractère
  if (cleaned.length === 0) return null;

  return cleaned;
}

/**
 * Valide un mode de jeu
 * @param {string} mode
 * @returns {boolean}
 */
function validateGameMode(mode) {
  const { GAME_MODES } = require('../config/constants');
  return Object.values(GAME_MODES).includes(mode);
}

/**
 * Valide un type de question QCM
 * @param {string} type
 * @returns {boolean}
 */
function validateQCMType(type) {
  const { QCM_TYPES } = require('../config/constants');
  return Object.values(QCM_TYPES).includes(type);
}

/**
 * Valide une configuration de partie
 * @param {Object} config
 * @returns {Object} Config validée avec valeurs par défaut
 */
function validateGameConfig(config = {}) {
  const { DEFAULT_CONFIG } = require('../config/constants');

  return {
    extractDuration: Number(config.extractDuration) || DEFAULT_CONFIG.extractDuration,
    timerDuration: Number(config.timerDuration) || DEFAULT_CONFIG.timerDuration,
    musicVolume: Math.max(0, Math.min(100, Number(config.musicVolume) || DEFAULT_CONFIG.musicVolume)),
    soundEffectsVolume: Math.max(0, Math.min(100, Number(config.soundEffectsVolume) || DEFAULT_CONFIG.soundEffectsVolume)),
    qcmType: validateQCMType(config.qcmType) ? config.qcmType : DEFAULT_CONFIG.qcmType
  };
}

module.exports = {
  validateRoomCode,
  validatePlaylistId,
  validateR2PlaylistId,
  extractPlaylistId,
  sanitizePlayerName,
  validateGameMode,
  validateQCMType,
  validateGameConfig
};
