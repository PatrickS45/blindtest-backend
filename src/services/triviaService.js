// src/services/triviaService.js
// Service pour gérer les questions de trivia dans le jeu

const questionManager = require('./questions/QuestionManager');
const logger = require('../utils/logger');
const { QCM_TYPES } = require('../config/constants');

class TriviaService {
  /**
   * Charge des questions pour une partie
   * @param {Object} config - Configuration de la partie
   * @param {number} config.numberOfRounds - Nombre de questions à charger
   * @param {string} [config.triviaProvider] - Provider à utiliser
   * @param {string} [config.triviaCategory] - Catégorie
   * @param {string} [config.triviaDifficulty] - Difficulté
   * @returns {Promise<Object>} - Playlist-like object contenant les questions
   */
  async loadQuestions(config = {}) {
    const {
      numberOfRounds = 10,
      triviaProvider = 'trivia',
      triviaCategory = null,
      triviaDifficulty = null
    } = config;

    try {
      logger.info('Loading trivia questions', {
        provider: triviaProvider,
        limit: numberOfRounds,
        category: triviaCategory,
        difficulty: triviaDifficulty
      });

      // Récupérer les questions via le QuestionManager
      const questions = await questionManager.fetchQuestions({
        provider: triviaProvider,
        limit: numberOfRounds,
        category: triviaCategory,
        difficulty: triviaDifficulty
      });

      if (!questions || questions.length === 0) {
        throw new Error('Aucune question disponible');
      }

      logger.info('Questions loaded successfully', {
        count: questions.length,
        provider: triviaProvider
      });

      // Convertir en format "playlist" pour compatibilité avec le système existant
      return this.questionsToPlaylist(questions);

    } catch (error) {
      logger.error('Failed to load trivia questions', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Convertit les questions en format playlist pour compatibilité
   * @param {Array<NormalizedQuestion>} questions
   * @returns {Object}
   */
  questionsToPlaylist(questions) {
    // Format similaire à une playlist Spotify pour compatibilité
    return {
      id: `trivia_${Date.now()}`,
      name: 'Quiz Culture Générale',
      type: 'trivia',
      tracks: questions,
      usableTracks: questions.length,
      image: null,
      provider: questions[0]?.source || 'TriviaAPI'
    };
  }

  /**
   * Génère un QCM à partir d'une question trivia
   * @param {NormalizedQuestion} question
   * @returns {Object} - Format QCM compatible avec le jeu
   */
  generateQCM(question) {
    try {
      // Utiliser la méthode de normalisation de la question
      const qcm = question.toQCMFormat();

      logger.debug('QCM generated from trivia question', {
        questionId: question.id,
        category: question.category,
        difficulty: question.difficulty
      });

      return qcm;

    } catch (error) {
      logger.error('Failed to generate QCM from question', {
        error: error.message,
        questionId: question.id
      });
      throw error;
    }
  }

  /**
   * Récupère les catégories disponibles
   * @param {string} [provider] - Provider spécifique (optionnel)
   * @returns {Promise<Array<string>>}
   */
  async getCategories(provider = null) {
    try {
      return await questionManager.getCategories(provider);
    } catch (error) {
      logger.error('Failed to get categories', { error: error.message });
      return [];
    }
  }

  /**
   * Récupère la liste des providers disponibles
   * @returns {Promise<Array>}
   */
  async getProviders() {
    try {
      return await questionManager.listProviders();
    } catch (error) {
      logger.error('Failed to list providers', { error: error.message });
      return [];
    }
  }

  /**
   * Ajoute une question personnalisée
   * @param {Object} question
   * @returns {Promise<NormalizedQuestion>}
   */
  async addCustomQuestion(question) {
    try {
      return await questionManager.addCustomQuestion(question);
    } catch (error) {
      logger.error('Failed to add custom question', { error: error.message });
      throw error;
    }
  }

  /**
   * Valide une réponse trivia
   * @param {number} selectedIndex - Index de la réponse sélectionnée
   * @param {Object} qcm - Objet QCM contenant les options
   * @returns {boolean} - true si correct
   */
  validateAnswer(selectedIndex, qcm) {
    if (!qcm || !qcm.options || !Array.isArray(qcm.options)) {
      logger.error('Invalid QCM format for validation');
      return false;
    }

    if (selectedIndex < 0 || selectedIndex >= qcm.options.length) {
      logger.error('Invalid option index', { selectedIndex, optionsCount: qcm.options.length });
      return false;
    }

    const isCorrect = qcm.options[selectedIndex].correct === true;

    logger.debug('Answer validated', {
      selectedIndex,
      isCorrect,
      correctAnswer: qcm.correctAnswer
    });

    return isCorrect;
  }
}

// Singleton
const triviaService = new TriviaService();

module.exports = triviaService;
