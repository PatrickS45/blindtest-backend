// src/services/questions/providers/CustomQuestionsProvider.js
// Provider pour les questions personnalisées (JSON, DB, contributions)

const QuestionProvider = require('./QuestionProvider');
const NormalizedQuestion = require('../questionNormalizer');
const logger = require('../../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class CustomQuestionsProvider extends QuestionProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'CustomQuestions';
    this.questionsFile = config.questionsFile || path.join(__dirname, '../../../data/custom-questions.json');
    this.questions = []; // Cache en mémoire
    this.loaded = false;
  }

  /**
   * Charge les questions depuis le fichier JSON
   * @private
   */
  async loadQuestions() {
    if (this.loaded) return;

    try {
      // Vérifier si le fichier existe
      try {
        await fs.access(this.questionsFile);
      } catch (error) {
        // Fichier n'existe pas, créer un fichier vide avec exemples
        await this.createDefaultQuestionsFile();
      }

      const data = await fs.readFile(this.questionsFile, 'utf-8');
      const parsed = JSON.parse(data);

      if (!Array.isArray(parsed.questions)) {
        throw new Error('Format invalide : questions doit être un tableau');
      }

      this.questions = parsed.questions;
      this.loaded = true;

      logger.info('Custom questions loaded', {
        count: this.questions.length,
        file: this.questionsFile
      });

    } catch (error) {
      logger.error('Failed to load custom questions', {
        error: error.message,
        file: this.questionsFile
      });

      // Utiliser des questions par défaut en cas d'erreur
      this.questions = this.getDefaultQuestions();
      this.loaded = true;
    }
  }

  /**
   * Crée un fichier de questions par défaut
   * @private
   */
  async createDefaultQuestionsFile() {
    const defaultData = {
      version: '1.0',
      questions: this.getDefaultQuestions()
    };

    // Créer le dossier si nécessaire
    const dir = path.dirname(this.questionsFile);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      this.questionsFile,
      JSON.stringify(defaultData, null, 2),
      'utf-8'
    );

    logger.info('Created default questions file', { file: this.questionsFile });
  }

  /**
   * Questions par défaut (exemples)
   * @private
   */
  getDefaultQuestions() {
    return [
      {
        id: 'custom_1',
        question: 'Quelle est la capitale de la France ?',
        correctAnswer: 'Paris',
        wrongAnswers: ['Lyon', 'Marseille', 'Toulouse'],
        category: 'geographie',
        difficulty: 'facile',
        author: 'System'
      },
      {
        id: 'custom_2',
        question: 'Combien de joueurs y a-t-il dans une équipe de football ?',
        correctAnswer: '11',
        wrongAnswers: ['10', '12', '9'],
        category: 'sport',
        difficulty: 'facile',
        author: 'System'
      },
      {
        id: 'custom_3',
        question: 'En quelle année a eu lieu la Révolution française ?',
        correctAnswer: '1789',
        wrongAnswers: ['1776', '1804', '1815'],
        category: 'histoire',
        difficulty: 'normal',
        author: 'System'
      }
    ];
  }

  /**
   * Récupère des questions selon les critères
   * @param {Object} options
   * @returns {Promise<Array<NormalizedQuestion>>}
   */
  async fetchQuestions(options = {}) {
    const { limit = 10, category, difficulty } = options;

    // Charger les questions si pas encore fait
    await this.loadQuestions();

    try {
      // Filtrer selon les critères
      let filtered = [...this.questions];

      if (category) {
        filtered = filtered.filter(q => q.category === category);
      }

      if (difficulty) {
        filtered = filtered.filter(q => q.difficulty === difficulty);
      }

      // Mélanger (Fisher-Yates)
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }

      // Limiter le nombre
      const selected = filtered.slice(0, limit);

      logger.info('Custom questions fetched', {
        requested: limit,
        available: filtered.length,
        returned: selected.length,
        category,
        difficulty
      });

      // Normaliser les questions
      return selected.map(q => this.normalizeQuestion(q));

    } catch (error) {
      logger.error('Failed to fetch custom questions', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalise une question custom vers le format standard
   * @param {Object} rawQuestion
   * @returns {NormalizedQuestion}
   */
  normalizeQuestion(rawQuestion) {
    return new NormalizedQuestion({
      id: rawQuestion.id || `custom_${Date.now()}_${Math.random()}`,
      question: rawQuestion.question,
      correctAnswer: rawQuestion.correctAnswer || rawQuestion.answer,
      wrongAnswers: rawQuestion.wrongAnswers || rawQuestion.badAnswers || [],
      category: rawQuestion.category || 'general',
      difficulty: rawQuestion.difficulty || 'normal',
      source: this.name,
      metadata: {
        author: rawQuestion.author || 'Unknown',
        createdAt: rawQuestion.createdAt,
        tags: rawQuestion.tags || []
      }
    });
  }

  /**
   * Récupère les catégories disponibles
   * @returns {Promise<Array<string>>}
   */
  async getCategories() {
    await this.loadQuestions();

    const categories = new Set();
    this.questions.forEach(q => {
      if (q.category) categories.add(q.category);
    });

    return Array.from(categories);
  }

  /**
   * Ajoute une nouvelle question (contribution)
   * @param {Object} question
   * @returns {Promise<NormalizedQuestion>}
   */
  async addQuestion(question) {
    await this.loadQuestions();

    // Normaliser la question
    const normalized = this.normalizeQuestion(question);

    // Ajouter au tableau en mémoire
    this.questions.push(normalized.toJSON());

    // Sauvegarder dans le fichier
    await this.saveQuestions();

    logger.info('Question added', { id: normalized.id });

    return normalized;
  }

  /**
   * Sauvegarde les questions dans le fichier
   * @private
   */
  async saveQuestions() {
    try {
      const data = {
        version: '1.0',
        questions: this.questions,
        lastModified: new Date().toISOString()
      };

      await fs.writeFile(
        this.questionsFile,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      logger.info('Questions saved', { count: this.questions.length });

    } catch (error) {
      logger.error('Failed to save questions', { error: error.message });
      throw error;
    }
  }

  /**
   * Recharge les questions depuis le fichier
   */
  async reload() {
    this.loaded = false;
    await this.loadQuestions();
  }
}

module.exports = CustomQuestionsProvider;
