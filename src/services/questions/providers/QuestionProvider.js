// src/services/questions/providers/QuestionProvider.js
// Classe abstraite pour tous les providers de questions

/**
 * Classe de base abstraite pour les providers de questions
 * Tous les providers doivent étendre cette classe
 */
class QuestionProvider {
  constructor(config = {}) {
    if (new.target === QuestionProvider) {
      throw new Error('QuestionProvider est une classe abstraite et ne peut pas être instanciée directement');
    }
    this.config = config;
    this.name = 'BaseProvider';
  }

  /**
   * Récupère des questions
   * @param {Object} options - Options de récupération
   * @param {number} options.limit - Nombre de questions à récupérer
   * @param {string} [options.category] - Catégorie des questions
   * @param {string} [options.difficulty] - Difficulté (facile, normal, difficile)
   * @returns {Promise<Array>} - Tableau de questions normalisées
   */
  async fetchQuestions(options) {
    throw new Error('La méthode fetchQuestions() doit être implémentée par les sous-classes');
  }

  /**
   * Récupère les catégories disponibles
   * @returns {Promise<Array<string>>} - Liste des catégories
   */
  async getCategories() {
    throw new Error('La méthode getCategories() doit être implémentée par les sous-classes');
  }

  /**
   * Récupère les difficultés disponibles
   * @returns {Promise<Array<string>>} - Liste des difficultés
   */
  async getDifficulties() {
    return ['facile', 'normal', 'difficile']; // Valeurs par défaut
  }

  /**
   * Vérifie la disponibilité du provider
   * @returns {Promise<boolean>} - true si le provider est disponible
   */
  async isAvailable() {
    return true;
  }

  /**
   * Normalise une question au format standard
   * @param {Object} rawQuestion - Question brute du provider
   * @returns {Object} - Question normalisée
   */
  normalizeQuestion(rawQuestion) {
    throw new Error('La méthode normalizeQuestion() doit être implémentée par les sous-classes');
  }

  /**
   * Retourne le nom du provider
   * @returns {string}
   */
  getName() {
    return this.name;
  }
}

module.exports = QuestionProvider;
