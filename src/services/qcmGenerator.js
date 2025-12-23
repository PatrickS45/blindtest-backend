// src/services/qcmGenerator.js
// Générateur automatique de QCM à partir des métadonnées Spotify ou questions trivia

const spotifyService = require('./spotifyService');
const triviaService = require('./triviaService');
const { QCM_TYPES, GENERIC_ARTISTS_BY_DECADE } = require('../config/constants');
const logger = require('../utils/logger');

class QCMGenerator {
  /**
   * Génère un QCM "Qui chante ce titre ?"
   * @param {Object} track - Track Spotify
   * @param {Array} playlistTracks - Tous les tracks de la playlist
   * @returns {Promise<Object>}
   */
  async generateArtistQCM(track, playlistTracks) {
    const correctArtist = track.artists[0];
    let wrongArtists = [];

    // STRATÉGIE 1 : Prendre des artistes de la playlist (rapide, cohérent)
    const playlistArtists = playlistTracks
      .map(t => t.artists[0])
      .filter(a => a.id !== correctArtist.id)
      .filter((artist, index, self) =>
        self.findIndex(a => a.id === artist.id) === index // Dédupliquer
      );

    if (playlistArtists.length >= 3) {
      wrongArtists = this.shuffleArray(playlistArtists).slice(0, 3);
      logger.debug('QCM artists from playlist', {
        trackId: track.id,
        strategy: 'playlist'
      });
    }
    // STRATÉGIE 2 : Utiliser Recommendations Spotify (qualité)
    else {
      try {
        const similarArtists = await spotifyService.getSimilarArtists(correctArtist.id);

        wrongArtists = [
          ...playlistArtists,
          ...similarArtists.filter(a => a.id !== correctArtist.id)
        ]
          .filter((artist, index, self) =>
            self.findIndex(a => a.id === artist.id) === index
          )
          .slice(0, 3);

        logger.debug('QCM artists from Spotify recommendations', {
          trackId: track.id,
          strategy: 'recommendations'
        });
      } catch (error) {
        logger.error('Failed to get similar artists, using fallback', {
          error: error.message
        });
      }
    }

    // STRATÉGIE 3 : Fallback générique par décennie
    if (wrongArtists.length < 3) {
      const decade = this.getDecade(track.album.release_date);
      const genericArtists = GENERIC_ARTISTS_BY_DECADE[decade] || GENERIC_ARTISTS_BY_DECADE['2020s'];

      const fallbackArtists = genericArtists
        .filter(name => name !== correctArtist.name)
        .map(name => ({ id: `generic_${name}`, name }));

      wrongArtists = [...wrongArtists, ...fallbackArtists].slice(0, 3);

      logger.debug('QCM artists from generic fallback', {
        trackId: track.id,
        strategy: 'fallback',
        decade
      });
    }

    // Construire les options
    const options = [
      { text: correctArtist.name, correct: true, artistId: correctArtist.id },
      ...wrongArtists.map(artist => ({
        text: artist.name,
        correct: false,
        artistId: artist.id
      }))
    ];

    // Mélanger les options
    const shuffledOptions = this.shuffleArray(options);

    return {
      type: QCM_TYPES.ARTIST,
      question: 'Qui chante ce titre ?',
      options: shuffledOptions,
      correctAnswer: correctArtist.name
    };
  }

  /**
   * Génère un QCM "Quel est ce titre ?"
   * @param {Object} track
   * @param {Array} playlistTracks
   * @returns {Object}
   */
  generateTitleQCM(track, playlistTracks) {
    const correctTitle = track.name;

    // Prendre 3 autres titres de la playlist
    const wrongTitles = playlistTracks
      .filter(t => t.id !== track.id)
      .map(t => t.name)
      .filter((title, index, self) => self.indexOf(title) === index) // Dédupliquer
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const options = [
      { text: correctTitle, correct: true },
      ...wrongTitles.map(title => ({ text: title, correct: false }))
    ];

    const shuffledOptions = this.shuffleArray(options);

    logger.debug('QCM title generated', { trackId: track.id });

    return {
      type: QCM_TYPES.TITLE,
      question: 'Quel est le titre de cette chanson ?',
      options: shuffledOptions,
      correctAnswer: correctTitle
    };
  }

  /**
   * Génère un QCM "En quelle année ?"
   * @param {Object} track
   * @returns {Object}
   */
  generateYearQCM(track) {
    const releaseDate = track.album.release_date; // Format: "YYYY-MM-DD" ou "YYYY"
    const correctYear = parseInt(releaseDate.split('-')[0]);

    // Générer 3 années proches aléatoires
    const offsets = [-3, -2, -1, 1, 2, 3];
    const wrongYears = this.shuffleArray(offsets)
      .slice(0, 3)
      .map(offset => correctYear + offset)
      .filter(year => year > 1950 && year <= new Date().getFullYear()); // Années valides

    // Compléter si nécessaire
    while (wrongYears.length < 3) {
      const randomYear = correctYear + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5 + 1);
      if (!wrongYears.includes(randomYear) && randomYear > 1950 && randomYear <= new Date().getFullYear()) {
        wrongYears.push(randomYear);
      }
    }

    const options = [
      { text: correctYear.toString(), correct: true },
      ...wrongYears.map(year => ({ text: year.toString(), correct: false }))
    ];

    const shuffledOptions = this.shuffleArray(options);

    logger.debug('QCM year generated', { trackId: track.id, year: correctYear });

    return {
      type: QCM_TYPES.YEAR,
      question: 'En quelle année est sorti ce titre ?',
      options: shuffledOptions,
      correctAnswer: correctYear.toString()
    };
  }

  /**
   * Point d'entrée principal pour générer un QCM
   * @param {Object} track - Track Spotify ou question trivia
   * @param {Array} playlistTracks
   * @param {string} questionType - 'artist', 'title', 'year', 'trivia'
   * @returns {Promise<Object>}
   */
  async generateQCM(track, playlistTracks, questionType = QCM_TYPES.ARTIST) {
    try {
      // Si c'est une question trivia (détectée par la présence de la méthode toQCMFormat)
      if (questionType === QCM_TYPES.TRIVIA || (track && typeof track.toQCMFormat === 'function')) {
        logger.debug('Generating trivia QCM', { questionId: track.id });
        return triviaService.generateQCM(track);
      }

      // Sinon, utiliser la logique musicale classique
      switch (questionType) {
        case QCM_TYPES.ARTIST:
          return await this.generateArtistQCM(track, playlistTracks);

        case QCM_TYPES.TITLE:
          return this.generateTitleQCM(track, playlistTracks);

        case QCM_TYPES.YEAR:
          return this.generateYearQCM(track);

        default:
          logger.warn('Unknown QCM type, using artist', { questionType });
          return await this.generateArtistQCM(track, playlistTracks);
      }
    } catch (error) {
      logger.error('Failed to generate QCM', {
        trackId: track?.id,
        questionType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Détermine la décennie d'une date
   * @param {string} releaseDate - Format "YYYY-MM-DD" ou "YYYY"
   * @returns {string} - Ex: "1980s"
   */
  getDecade(releaseDate) {
    const year = parseInt(releaseDate.split('-')[0]);
    const decade = Math.floor(year / 10) * 10;
    return `${decade}s`;
  }

  /**
   * Mélange un tableau (Fisher-Yates)
   * @param {Array} array
   * @returns {Array}
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Génère des indices pour le mode Questions en Rafale
   * @param {Object} track
   * @returns {Array}
   */
  generateHints(track) {
    const year = track.album.release_date.split('-')[0];

    return [
      { time: 0, text: '🎵 Écoute l\'extrait...' },
      { time: 5, text: `💿 Album : ${track.album.name}` },
      { time: 10, text: `📅 Année : ${year}` },
      { time: 15, text: `🎤 Indice : ${this.generateCustomHint(track)}` }
    ];
  }

  /**
   * Génère un indice personnalisé
   * @param {Object} track
   * @returns {string}
   */
  generateCustomHint(track) {
    const hints = [
      `Artiste commence par "${track.artists[0].name.charAt(0)}"`,
      `Titre contient ${track.name.split(' ').length} mots`,
      `Album : "${track.album.name}"`,
      `Un hit des années ${this.getDecade(track.album.release_date)}`
    ];

    return hints[Math.floor(Math.random() * hints.length)];
  }
}

module.exports = new QCMGenerator();
