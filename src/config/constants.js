// src/config/constants.js
// Configuration globale et constantes du jeu

module.exports = {
  // Modes de jeu disponibles
  GAME_MODES: {
    ACCUMUL_POINTS: 'accumul_points',
    REFLEXOQUIZ: 'reflexoquiz',
    QCM: 'qcm',
    QUESTIONS_RAFALE: 'questions_rafale',
    CHAUD_DEVANT: 'chaud_devant',
    TUEURS_GAGES: 'tueurs_gages'
  },

  // Types de questions QCM
  QCM_TYPES: {
    ARTIST: 'artist',
    TITLE: 'title',
    YEAR: 'year'
  },

  // Statuts de partie
  GAME_STATUS: {
    WAITING: 'waiting',
    PLAYING: 'playing',
    PAUSED: 'paused',
    FINISHED: 'finished'
  },

  // Limites
  LIMITS: {
    MAX_PLAYERS: 25,
    MAX_ACTIVE_GAMES: 10,
    MIN_TRACKS_WITH_PREVIEW: 10,
    ROOM_CODE_LENGTH: 4,
    MAX_PLAYER_NAME_LENGTH: 20,
    SPOTIFY_RATE_LIMIT: 180, // requêtes par minute
    GAME_TIMEOUT_MS: 30 * 60 * 1000 // 30 minutes
  },

  // Configuration par défaut
  DEFAULT_CONFIG: {
    extractDuration: 30, // secondes
    timerDuration: 10,
    musicVolume: 70,
    soundEffectsVolume: 80,
    qcmType: 'artist',
    numberOfRounds: 10, // nombre de manches dans la partie
    randomStart: true // démarrer la musique aléatoirement dans le morceau
  },

  // Configurations de scoring par mode
  SCORING_CONFIGS: {
    accumul_points: {
      correct: 10,
      incorrect: -5,
      timeout: 0
    },
    reflexoquiz: {
      first: 15,
      second: 10,
      third: 5,
      incorrect: -5
    },
    qcm: {
      correct: 10,
      incorrect: -3
    },
    questions_rafale: {
      instant: 20,  // < 3s
      fast: 15,     // 3-8s
      normal: 10,   // 8-15s
      late: 5,      // 15-20s
      incorrect: -5
    },
    chaud_devant: {
      correct: 5,
      incorrect: 0,
      explosion: -15
    },
    tueurs_gages: {
      correct: 10,
      steal: 10,
      incorrect: -5
    }
  },

  // Indices pour Questions en Rafale
  HINTS_TEMPLATE: [
    { time: 0, type: 'music', text: '🎵 Écoute l\'extrait...' },
    { time: 5, type: 'album', text: '💿 Album : {album}' },
    { time: 10, type: 'year', text: '📅 Année : {year}' },
    { time: 15, type: 'hint', text: '🎤 {hint}' }
  ],

  // Couleurs des joueurs
  PLAYER_COLORS: [
    '#FF3366', '#00D9FF', '#FFD700', '#9D4EDD',
    '#06FFA5', '#FF6B6B', '#4ECDC4', '#FFE66D',
    '#FF9F1C', '#2EC4B6', '#E71D36', '#011627',
    '#F72585', '#7209B7', '#3A0CA3', '#4361EE',
    '#4CC9F0', '#06FFA5', '#FFD60A', '#FF006E',
    '#8338EC', '#FB5607', '#FFBE0B', '#3A86FF',
    '#8AC926'
  ],

  // Artistes génériques par décennie (fallback)
  GENERIC_ARTISTS_BY_DECADE: {
    '1960s': ['The Beatles', 'The Rolling Stones', 'Bob Dylan', 'The Beach Boys'],
    '1970s': ['Led Zeppelin', 'Pink Floyd', 'Queen', 'David Bowie'],
    '1980s': ['Michael Jackson', 'Madonna', 'Prince', 'U2'],
    '1990s': ['Nirvana', 'Oasis', 'Spice Girls', 'Backstreet Boys'],
    '2000s': ['Beyoncé', 'Eminem', 'Coldplay', 'Rihanna'],
    '2010s': ['Ed Sheeran', 'Adele', 'Bruno Mars', 'Taylor Swift'],
    '2020s': ['The Weeknd', 'Dua Lipa', 'Olivia Rodrigo', 'Bad Bunny']
  },

  // Messages d'erreur
  ERRORS: {
    GAME_NOT_FOUND: 'Partie introuvable',
    UNAUTHORIZED: 'Non autorisé',
    NO_PLAYLIST: 'Pas de playlist chargée',
    NO_TRACKS_AVAILABLE: 'Aucun track disponible',
    INVALID_ROOM_CODE: 'Code de partie invalide',
    INVALID_PLAYLIST_ID: 'ID de playlist invalide',
    SPOTIFY_ERROR: 'Erreur Spotify API',
    INSUFFICIENT_TRACKS: 'Playlist insuffisante (minimum 10 extraits requis)',
    MAX_PLAYERS_REACHED: 'Nombre maximum de joueurs atteint',
    ALREADY_BUZZED: 'Un joueur a déjà buzzé'
  }
};
