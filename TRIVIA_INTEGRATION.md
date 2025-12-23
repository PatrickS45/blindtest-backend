# Intégration des Questions Trivia - Architecture Modulaire

## 📋 Vue d'ensemble

Ce document explique l'architecture modulaire mise en place pour intégrer des questions de culture générale (trivia) dans l'application de blind test, avec la possibilité d'ajouter facilement de nouvelles sources de questions.

## 🏗️ Architecture

### Structure des fichiers

```
src/services/questions/
├── providers/
│   ├── QuestionProvider.js          # Classe abstraite (interface)
│   ├── TriviaAPIProvider.js         # Provider API externe (QuizzAPI)
│   ├── CustomQuestionsProvider.js   # Provider questions personnalisées
│   └── [VotreProvider.js]           # Ajoutez vos propres providers ici
├── QuestionManager.js                # Orchestrateur central
├── questionNormalizer.js             # Format normalisé des questions
└── README.md                          # Ce fichier
```

### Providers actuellement disponibles

1. **TriviaAPIProvider** - API externe QuizzAPI v2
   - Source : https://quizzapi.jomoreschi.fr/api/v2
   - ~596 questions de culture générale
   - Catégories : histoire, géographie, sciences, etc.
   - Difficultés : facile, normal, difficile

2. **CustomQuestionsProvider** - Questions personnalisées
   - Source : fichier JSON local (`src/data/custom-questions.json`)
   - Permet d'ajouter vos propres questions
   - Format flexible et extensible

## 🚀 Utilisation

### Charger des questions dans une partie

#### Côté Backend (Socket.IO)

```javascript
// Charger des questions trivia
socket.emit('load_trivia_questions', {
  roomCode: 'ABCD',
  provider: 'trivia',        // 'trivia' ou 'custom'
  category: 'histoire',       // optionnel
  difficulty: 'normal'        // optionnel
}, (response) => {
  console.log(response); // { success: true, questions: {...} }
});

// Récupérer les catégories disponibles
socket.emit('get_trivia_categories', {
  provider: 'trivia'
}, (response) => {
  console.log(response.categories); // ['histoire', 'geographie', ...]
});

// Récupérer les providers disponibles
socket.emit('get_trivia_providers', {}, (response) => {
  console.log(response.providers);
  // [{ name: 'trivia', type: 'TriviaAPI', available: true }, ...]
});
```

#### Côté Code (Service)

```javascript
const triviaService = require('./services/triviaService');

// Charger des questions
const questionsPlaylist = await triviaService.loadQuestions({
  numberOfRounds: 10,
  triviaProvider: 'trivia',
  triviaCategory: 'histoire',
  triviaDifficulty: 'difficile'
});

// Récupérer les catégories
const categories = await triviaService.getCategories('trivia');
```

### Créer une partie en mode Trivia

```javascript
socket.emit('create_game', {
  mode: 'trivia',  // Nouveau mode de jeu
  config: {
    numberOfRounds: 10,
    triviaProvider: 'trivia',
    triviaCategory: 'histoire',
    triviaDifficulty: 'normal',
    triviaTimeout: 20  // 20 secondes pour répondre
  }
});
```

## 🔧 Ajouter un nouveau provider

### Étape 1 : Créer votre provider

Créez un fichier `src/services/questions/providers/MonProvider.js` :

```javascript
const QuestionProvider = require('./QuestionProvider');
const NormalizedQuestion = require('../questionNormalizer');
const logger = require('../../../utils/logger');

class MonProvider extends QuestionProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'MonProvider';
    this.apiUrl = config.apiUrl || 'https://mon-api.com';
  }

  /**
   * Récupère des questions depuis votre source
   */
  async fetchQuestions(options = {}) {
    const { limit = 10, category, difficulty } = options;

    try {
      // Votre logique pour récupérer les questions
      const response = await fetch(`${this.apiUrl}/questions?limit=${limit}`);
      const data = await response.json();

      // Normaliser les questions
      return data.map(q => this.normalizeQuestion(q));

    } catch (error) {
      logger.error('Failed to fetch questions', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalise une question vers le format standard
   */
  normalizeQuestion(rawQuestion) {
    return new NormalizedQuestion({
      id: `mon_provider_${rawQuestion.id}`,
      question: rawQuestion.question,
      correctAnswer: rawQuestion.correct_answer,
      wrongAnswers: rawQuestion.wrong_answers,
      category: rawQuestion.category,
      difficulty: rawQuestion.difficulty,
      source: this.name,
      metadata: {
        // Vos métadonnées personnalisées
      }
    });
  }

  /**
   * Récupère les catégories disponibles
   */
  async getCategories() {
    // Votre logique
    return ['cat1', 'cat2', 'cat3'];
  }

  /**
   * Vérifie la disponibilité
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

module.exports = MonProvider;
```

### Étape 2 : Enregistrer votre provider

Modifiez `src/services/questions/QuestionManager.js` :

```javascript
const MonProvider = require('./providers/MonProvider');

class QuestionManager {
  initializeDefaultProviders() {
    // Providers existants...

    // Votre nouveau provider
    const monProvider = new MonProvider({
      apiUrl: process.env.MON_PROVIDER_URL
    });
    this.registerProvider('mon-provider', monProvider);
  }
}
```

### Étape 3 : Utiliser votre provider

```javascript
// Via le service
const questions = await triviaService.loadQuestions({
  numberOfRounds: 10,
  triviaProvider: 'mon-provider'
});

// Via Socket.IO
socket.emit('load_trivia_questions', {
  roomCode: 'ABCD',
  provider: 'mon-provider'
});
```

## 📊 Format normalisé des questions

Toutes les questions, quelle que soit leur source, sont normalisées au format suivant :

```javascript
{
  id: 'provider_123',
  question: 'Quelle est la capitale de la France ?',
  correctAnswer: 'Paris',
  wrongAnswers: ['Lyon', 'Marseille', 'Toulouse'],  // Tableau de 3 mauvaises réponses
  category: 'geographie',
  difficulty: 'facile',
  source: 'TriviaAPI',
  metadata: {
    // Métadonnées supplémentaires spécifiques au provider
  }
}
```

## 🎮 Flow du jeu en mode Trivia

1. **Host** crée une partie en mode `trivia`
2. **Host** charge les questions via `load_trivia_questions`
3. Questions sont pré-chargées et stockées dans `game.playlist.tracks`
4. **Host** démarre un round → Une question est sélectionnée
5. **Display** et **Buzzers** reçoivent la question avec 4 options (mélangées)
6. **Joueurs** répondent via `submit_qcm_answer`
7. **Validation** automatique basée sur la bonne réponse
8. **Scores** mis à jour
9. Prochaine question ou fin de partie

## 🔑 Événements Socket.IO

### Côté Host

- `load_trivia_questions` - Charger des questions
- `get_trivia_categories` - Récupérer les catégories
- `get_trivia_providers` - Liste des providers disponibles
- `start_round` - Démarrer un round (même événement que musique)

### Côté Joueurs

- `submit_qcm_answer` - Répondre à une question
- `round_started` - Recevoir la question et les options

### Événements broadcast

- `trivia_loaded` - Questions chargées avec succès
- `round_started` - Nouveau round avec question
- `qcm_result` - Résultats de la question

## 🧪 Tester l'intégration

### Test basique

```javascript
// Charger des questions
const triviaService = require('./services/triviaService');

(async () => {
  try {
    const questions = await triviaService.loadQuestions({
      numberOfRounds: 5,
      triviaProvider: 'trivia',
      triviaDifficulty: 'facile'
    });

    console.log('✅ Loaded', questions.tracks.length, 'questions');

    questions.tracks.forEach((q, i) => {
      console.log(`\n${i + 1}. ${q.question}`);
      console.log('   Catégorie:', q.category);
      console.log('   Difficulté:', q.difficulty);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
```

## 🔐 Ajouter des questions personnalisées

### Via fichier JSON

Éditez `src/data/custom-questions.json` :

```json
{
  "version": "1.0",
  "questions": [
    {
      "id": "custom_1",
      "question": "Votre question ?",
      "correctAnswer": "La bonne réponse",
      "wrongAnswers": ["Mauvaise 1", "Mauvaise 2", "Mauvaise 3"],
      "category": "votre_categorie",
      "difficulty": "normal",
      "author": "Votre nom"
    }
  ]
}
```

### Via API (contribution programmatique)

```javascript
const triviaService = require('./services/triviaService');

await triviaService.addCustomQuestion({
  question: 'Votre question ?',
  correctAnswer: 'La bonne réponse',
  wrongAnswers: ['Mauvaise 1', 'Mauvaise 2', 'Mauvaise 3'],
  category: 'custom',
  difficulty: 'normal'
});
```

## 🌐 Variables d'environnement

Ajoutez à votre `.env` :

```bash
# API externe
TRIVIA_API_URL=https://quizzapi.jomoreschi.fr/api/v2

# Questions personnalisées
CUSTOM_QUESTIONS_FILE=/path/to/custom-questions.json

# Votre provider personnalisé
MON_PROVIDER_URL=https://mon-api.com
```

## 📝 Bonnes pratiques

1. **Toujours normaliser** vos questions au format standard
2. **Gérer les erreurs** gracieusement avec des fallbacks
3. **Cacher les données** pour réduire les appels API
4. **Valider les données** avant de les normaliser
5. **Logger** les opérations importantes
6. **Tester la disponibilité** de votre provider

## 🆘 Troubleshooting

### Questions ne se chargent pas

```javascript
// Vérifier la disponibilité du provider
const providers = await triviaService.getProviders();
console.log(providers);

// Tester directement
const questionManager = require('./services/questions/QuestionManager');
const questions = await questionManager.fetchQuestions({
  provider: 'trivia',
  limit: 1
});
```

### Provider custom ne s'affiche pas

1. Vérifier que le provider est bien enregistré dans `QuestionManager`
2. Vérifier que `isAvailable()` retourne `true`
3. Vérifier les logs pour les erreurs d'initialisation

### Format de question invalide

Assurez-vous que votre `normalizeQuestion()` retourne bien :
- `question` (string)
- `correctAnswer` (string)
- `wrongAnswers` (array d'au moins 1 élément)

## 🚀 Évolution future

- Support de questions avec images
- Support de questions multi-réponses
- Système de vote pour les questions custom
- Cache Redis pour les performances
- API REST pour gérer les questions
- Interface admin pour ajouter des questions

## 📚 Références

- [QuizzAPI Documentation](https://quizzapi.jomoreschi.fr/)
- [Architecture SOLID](https://en.wikipedia.org/wiki/SOLID)
- [Provider Pattern](https://refactoring.guru/design-patterns/strategy)
