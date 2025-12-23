// src/services/questions/QuestionManager.js
// Orchestrateur pour gérer tous les providers de questions

const TriviaAPIProvider = require('./providers/TriviaAPIProvider');
const CustomQuestionsProvider = require('./providers/CustomQuestionsProvider');
const logger = require('../../utils/logger');

/**
 * Gestionnaire centralisé des providers de questions
 * Permet d'ajouter, gérer et utiliser plusieurs sources de questions
 */
class QuestionManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;

    // Initialiser les providers par défaut
    this.initializeDefaultProviders();
  }

  /**
   * Initialise les providers par défaut
   * @private
   */
  initializeDefaultProviders() {
    try {
      // Provider API externe (QuizzAPI)
      const triviaProvider = new TriviaAPIProvider({
        baseURL: process.env.TRIVIA_API_URL || 'https://quizzapi.jomoreschi.fr/api/v2',
        timeout: 10000
      });
      this.registerProvider('trivia', triviaProvider);

      // Provider questions personnalisées
      const customProvider = new CustomQuestionsProvider({
        questionsFile: process.env.CUSTOM_QUESTIONS_FILE
      });
      this.registerProvider('custom', customProvider);

      // Définir le provider par défaut
      this.defaultProvider = 'trivia';

      logger.info('Question providers initialized', {
        providers: Array.from(this.providers.keys()),
        default: this.defaultProvider
      });

    } catch (error) {
      logger.error('Failed to initialize default providers', { error: error.message });
    }
  }

  /**
   * Enregistre un nouveau provider
   * @param {string} name - Nom unique du provider
   * @param {QuestionProvider} provider - Instance du provider
   */
  registerProvider(name, provider) {
    if (this.providers.has(name)) {
      logger.warn('Provider already exists, replacing', { name });
    }

    this.providers.set(name, provider);
    logger.info('Provider registered', { name, providerType: provider.getName() });

    // Si c'est le premier provider, le définir comme défaut
    if (!this.defaultProvider) {
      this.defaultProvider = name;
    }
  }

  /**
   * Récupère un provider par son nom
   * @param {string} name - Nom du provider
   * @returns {QuestionProvider|null}
   */
  getProvider(name) {
    return this.providers.get(name) || null;
  }

  /**
   * Liste tous les providers disponibles
   * @returns {Array<{name: string, type: string, available: boolean}>}
   */
  async listProviders() {
    const list = [];

    for (const [name, provider] of this.providers) {
      const available = await provider.isAvailable();
      list.push({
        name,
        type: provider.getName(),
        available,
        isDefault: name === this.defaultProvider
      });
    }

    return list;
  }

  /**
   * Récupère des questions depuis un provider spécifique ou le provider par défaut
   * @param {Object} options
   * @param {string} [options.provider] - Nom du provider à utiliser (optionnel)
   * @param {number} [options.limit] - Nombre de questions
   * @param {string} [options.category] - Catégorie
   * @param {string} [options.difficulty] - Difficulté
   * @returns {Promise<Array<NormalizedQuestion>>}
   */
  async fetchQuestions(options = {}) {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.getProvider(providerName);

    if (!provider) {
      throw new Error(`Provider "${providerName}" introuvable`);
    }

    try {
      logger.info('Fetching questions', {
        provider: providerName,
        limit: options.limit,
        category: options.category,
        difficulty: options.difficulty
      });

      const questions = await provider.fetchQuestions(options);

      logger.info('Questions fetched successfully', {
        provider: providerName,
        count: questions.length
      });

      return questions;

    } catch (error) {
      logger.error('Failed to fetch questions', {
        provider: providerName,
        error: error.message
      });

      // Fallback : essayer avec un autre provider si disponible
      if (this.providers.size > 1) {
        logger.info('Trying fallback provider');
        return await this.fetchQuestionsWithFallback(options, providerName);
      }

      throw error;
    }
  }

  /**
   * Récupère des questions avec fallback automatique
   * @private
   */
  async fetchQuestionsWithFallback(options, excludeProvider) {
    for (const [name, provider] of this.providers) {
      if (name === excludeProvider) continue;

      try {
        logger.info('Attempting fallback provider', { provider: name });
        const questions = await provider.fetchQuestions(options);

        if (questions && questions.length > 0) {
          logger.info('Fallback successful', { provider: name, count: questions.length });
          return questions;
        }
      } catch (error) {
        logger.warn('Fallback provider failed', { provider: name, error: error.message });
      }
    }

    throw new Error('Tous les providers ont échoué');
  }

  /**
   * Récupère des questions depuis plusieurs providers (mix)
   * @param {Object} options
   * @param {Array<string>} options.providers - Liste des providers à utiliser
   * @param {number} options.limit - Nombre total de questions
   * @returns {Promise<Array<NormalizedQuestion>>}
   */
  async fetchMixedQuestions(options = {}) {
    const { providers = [], limit = 10 } = options;

    if (providers.length === 0) {
      throw new Error('Aucun provider spécifié pour le mix');
    }

    const questionsPerProvider = Math.ceil(limit / providers.length);
    const allQuestions = [];

    for (const providerName of providers) {
      try {
        const questions = await this.fetchQuestions({
          ...options,
          provider: providerName,
          limit: questionsPerProvider
        });

        allQuestions.push(...questions);
      } catch (error) {
        logger.warn('Failed to fetch from provider in mix', {
          provider: providerName,
          error: error.message
        });
      }
    }

    // Mélanger toutes les questions
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    // Limiter au nombre demandé
    return allQuestions.slice(0, limit);
  }

  /**
   * Récupère les catégories de tous les providers ou d'un provider spécifique
   * @param {string} [providerName] - Nom du provider (optionnel)
   * @returns {Promise<Array<string>>}
   */
  async getCategories(providerName = null) {
    if (providerName) {
      const provider = this.getProvider(providerName);
      if (!provider) {
        throw new Error(`Provider "${providerName}" introuvable`);
      }
      return await provider.getCategories();
    }

    // Récupérer les catégories de tous les providers
    const allCategories = new Set();

    for (const provider of this.providers.values()) {
      try {
        const categories = await provider.getCategories();
        categories.forEach(cat => allCategories.add(cat));
      } catch (error) {
        logger.warn('Failed to get categories from provider', {
          provider: provider.getName(),
          error: error.message
        });
      }
    }

    return Array.from(allCategories).sort();
  }

  /**
   * Définit le provider par défaut
   * @param {string} providerName
   */
  setDefaultProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider "${providerName}" n'existe pas`);
    }

    this.defaultProvider = providerName;
    logger.info('Default provider changed', { provider: providerName });
  }

  /**
   * Ajoute une question personnalisée
   * @param {Object} question
   * @returns {Promise<NormalizedQuestion>}
   */
  async addCustomQuestion(question) {
    const customProvider = this.getProvider('custom');

    if (!customProvider) {
      throw new Error('Custom provider not available');
    }

    return await customProvider.addQuestion(question);
  }
}

// Singleton
const questionManager = new QuestionManager();

module.exports = questionManager;
