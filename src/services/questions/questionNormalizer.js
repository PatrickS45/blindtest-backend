// src/services/questions/questionNormalizer.js
// Format normalisé pour toutes les questions, quelle que soit la source

/**
 * Format standard d'une question
 * Toutes les sources doivent être converties vers ce format
 */
class NormalizedQuestion {
  constructor({
    id,
    question,
    correctAnswer,
    wrongAnswers,
    category,
    difficulty,
    source,
    metadata = {}
  }) {
    this.id = id;
    this.question = question;
    this.correctAnswer = correctAnswer;
    this.wrongAnswers = wrongAnswers; // Tableau de 3 mauvaises réponses
    this.category = category;
    this.difficulty = difficulty;
    this.source = source; // Nom du provider (ex: 'TriviaAPI', 'Custom')
    this.metadata = metadata; // Infos supplémentaires (auteur, date, etc.)

    // Validation
    this.validate();
  }

  validate() {
    if (!this.question || typeof this.question !== 'string') {
      throw new Error('Question invalide : question manquante ou invalide');
    }

    if (!this.correctAnswer || typeof this.correctAnswer !== 'string') {
      throw new Error('Question invalide : réponse correcte manquante');
    }

    if (!Array.isArray(this.wrongAnswers) || this.wrongAnswers.length < 1) {
      throw new Error('Question invalide : au moins 1 mauvaise réponse requise');
    }

    // Compléter avec des réponses génériques si moins de 3
    while (this.wrongAnswers.length < 3) {
      this.wrongAnswers.push(`Réponse ${this.wrongAnswers.length + 1}`);
    }

    // Limiter à 3 mauvaises réponses
    if (this.wrongAnswers.length > 3) {
      this.wrongAnswers = this.wrongAnswers.slice(0, 3);
    }
  }

  /**
   * Génère les options du QCM (mélangées)
   * @returns {Array} - Tableau de 4 options avec indication de la bonne réponse
   */
  generateQCMOptions() {
    const options = [
      { text: this.correctAnswer, correct: true },
      ...this.wrongAnswers.map(answer => ({ text: answer, correct: false }))
    ];

    // Mélanger (Fisher-Yates)
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return options;
  }

  /**
   * Convertit en format QCM pour le jeu
   * @returns {Object}
   */
  toQCMFormat() {
    return {
      type: 'trivia',
      question: this.question,
      options: this.generateQCMOptions(),
      correctAnswer: this.correctAnswer,
      category: this.category,
      difficulty: this.difficulty,
      source: this.source,
      metadata: this.metadata
    };
  }

  /**
   * Exporte en JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      question: this.question,
      correctAnswer: this.correctAnswer,
      wrongAnswers: this.wrongAnswers,
      category: this.category,
      difficulty: this.difficulty,
      source: this.source,
      metadata: this.metadata
    };
  }
}

module.exports = NormalizedQuestion;
