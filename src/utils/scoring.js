// src/utils/scoring.js
// Moteur de calcul de scores pour tous les modes de jeu

const { SCORING_CONFIGS } = require('../config/constants');

class ScoringEngine {
  /**
   * Calcul du score pour mode Accumul' Points
   * @param {boolean} isCorrect - Réponse correcte ou non
   * @param {Object} config - Configuration de scoring
   * @returns {number}
   */
  calculateAccumulPoints(isCorrect, config = SCORING_CONFIGS.accumul_points) {
    return isCorrect ? config.correct : config.incorrect;
  }

  /**
   * Calcul du score pour Réflex-O-Quiz
   * @param {boolean} isCorrect
   * @param {number} buzzPosition - Position du buzz (1, 2, 3...)
   * @param {Object} config
   * @returns {number}
   */
  calculateReflexoQuiz(isCorrect, buzzPosition, config = SCORING_CONFIGS.reflexoquiz) {
    if (!isCorrect) return config.incorrect;

    const scores = [config.first, config.second, config.third];
    return scores[buzzPosition - 1] || 0;
  }

  /**
   * Calcul du score pour QCM
   * @param {boolean} isCorrect
   * @param {Object} config
   * @returns {number}
   */
  calculateQCM(isCorrect, config = SCORING_CONFIGS.qcm) {
    return isCorrect ? config.correct : config.incorrect;
  }

  /**
   * Calcul du score pour Questions en Rafale
   * @param {boolean} isCorrect
   * @param {number} buzzTime - Timestamp du buzz
   * @param {number} roundStartTime - Timestamp de démarrage
   * @param {Object} config
   * @returns {number}
   */
  calculateQuestionsRafale(isCorrect, buzzTime, roundStartTime, config = SCORING_CONFIGS.questions_rafale) {
    if (!isCorrect) return config.incorrect;

    const elapsed = (buzzTime - roundStartTime) / 1000; // en secondes

    if (elapsed < 3) return config.instant;
    if (elapsed < 8) return config.fast;
    if (elapsed < 15) return config.normal;
    return config.late;
  }

  /**
   * Calcul du score pour Chaud Devant
   * @param {string} eventType - 'pass', 'keep', 'explode'
   * @param {Object} config
   * @returns {number}
   */
  calculateChaudDevant(eventType, config = SCORING_CONFIGS.chaud_devant) {
    switch (eventType) {
      case 'pass':
        return config.correct;
      case 'keep':
        return config.incorrect;
      case 'explode':
        return config.explosion;
      default:
        return 0;
    }
  }

  /**
   * Calcul du score pour Tueurs à Gages
   * @param {boolean} isCorrect
   * @param {Object} config
   * @returns {Object} { attackerPoints, stolenPoints }
   */
  calculateTueursGages(isCorrect, config = SCORING_CONFIGS.tueurs_gages) {
    if (!isCorrect) {
      return {
        attackerPoints: config.incorrect,
        stolenPoints: 0
      };
    }

    return {
      attackerPoints: config.correct,
      stolenPoints: config.steal
    };
  }

  /**
   * Point d'entrée principal - Calcule le score selon le mode
   * @param {string} mode - Mode de jeu
   * @param {Object} params - Paramètres spécifiques au mode
   * @returns {number|Object}
   */
  calculate(mode, params) {
    switch (mode) {
      case 'accumul_points':
        return this.calculateAccumulPoints(params.isCorrect, params.config);

      case 'reflexoquiz':
        return this.calculateReflexoQuiz(params.isCorrect, params.buzzPosition, params.config);

      case 'qcm':
        return this.calculateQCM(params.isCorrect, params.config);

      case 'questions_rafale':
        return this.calculateQuestionsRafale(
          params.isCorrect,
          params.buzzTime,
          params.roundStartTime,
          params.config
        );

      case 'chaud_devant':
        return this.calculateChaudDevant(params.eventType, params.config);

      case 'tueurs_gages':
        return this.calculateTueursGages(params.isCorrect, params.config);

      default:
        return 0;
    }
  }
}

module.exports = new ScoringEngine();
