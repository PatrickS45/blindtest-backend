// src/services/questions/providers/TriviaAPIProvider.js
// Provider pour l'API QuizzAPI v2 (https://quizzapi.jomoreschi.fr)

const QuestionProvider = require('./QuestionProvider');
const NormalizedQuestion = require('../questionNormalizer');
const logger = require('../../../utils/logger');

class TriviaAPIProvider extends QuestionProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'TriviaAPI';
    this.baseURL = config.baseURL || 'https://quizzapi.jomoreschi.fr/api/v2';
    this.timeout = config.timeout || 10000; // 10 secondes
    this.cache = new Map(); // Cache simple pour les catégories
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Récupère des questions depuis l'API externe
   * @param {Object} options
   * @returns {Promise<Array<NormalizedQuestion>>}
   */
  async fetchQuestions(options = {}) {
    const { limit = 10, category, difficulty } = options;

    try {
      // Construire l'URL avec les paramètres
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit);
      if (category) params.append('category', category);
      if (difficulty) params.append('difficulty', difficulty);

      const url = `${this.baseURL}/quiz?${params.toString()}`;

      logger.info('Fetching questions from TriviaAPI', {
        url,
        limit,
        category,
        difficulty
      });

      // Appel fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BlindTest-Backend/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Vérifier le format de la réponse
      if (!data.quizzes || !Array.isArray(data.quizzes)) {
        throw new Error('Format de réponse invalide de l\'API');
      }

      logger.info('Questions fetched successfully', {
        count: data.count,
        received: data.quizzes.length
      });

      // Normaliser toutes les questions
      const normalizedQuestions = data.quizzes.map(q => this.normalizeQuestion(q));

      return normalizedQuestions;

    } catch (error) {
      logger.error('Failed to fetch questions from TriviaAPI', {
        error: error.message,
        stack: error.stack
      });

      if (error.name === 'AbortError') {
        throw new Error('Timeout lors de la récupération des questions');
      }

      throw new Error(`Erreur TriviaAPI: ${error.message}`);
    }
  }

  /**
   * Normalise une question de l'API vers le format standard
   * @param {Object} rawQuestion - Format API: { id, question, answer, badAnswers[], category, difficulty }
   * @returns {NormalizedQuestion}
   */
  normalizeQuestion(rawQuestion) {
    try {
      return new NormalizedQuestion({
        id: `trivia_${rawQuestion.id}`,
        question: rawQuestion.question,
        correctAnswer: rawQuestion.answer,
        wrongAnswers: rawQuestion.badAnswers || [],
        category: rawQuestion.category || 'general',
        difficulty: rawQuestion.difficulty || 'normal',
        source: this.name,
        metadata: {
          apiId: rawQuestion.id,
          fetchedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to normalize question', {
        error: error.message,
        rawQuestion
      });
      throw error;
    }
  }

  /**
   * Récupère les catégories disponibles
   * @returns {Promise<Array<string>>}
   */
  async getCategories() {
    try {
      // Vérifier le cache
      const cached = this.cache.get('categories');
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        return cached.data;
      }

      const url = `${this.baseURL}/quiz/categories`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const categories = await response.json();

      // Mettre en cache
      this.cache.set('categories', {
        data: categories,
        timestamp: Date.now()
      });

      logger.info('Categories fetched', { count: categories.length });

      return categories;

    } catch (error) {
      logger.error('Failed to fetch categories', { error: error.message });

      // Retourner des catégories par défaut en cas d'erreur
      return [
        'histoire',
        'geographie',
        'sciences',
        'culture_generale',
        'sport',
        'cinema',
        'musique',
        'litterature'
      ];
    }
  }

  /**
   * Vérifie la disponibilité de l'API
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseURL}/quiz?limit=1`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      logger.warn('TriviaAPI not available', { error: error.message });
      return false;
    }
  }
}

module.exports = TriviaAPIProvider;
