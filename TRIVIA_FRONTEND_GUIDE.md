# Guide Frontend - Mode TRIVIA

## 📋 Vue d'ensemble

Le mode **TRIVIA** est un mode de jeu **QCM avec timer** (pas un jeu de vitesse). Tous les joueurs répondent simultanément pendant le temps imparti, puis les résultats sont révélés ensemble à la fin.

### Différences clés avec les modes musicaux

| Aspect | Modes Musicaux | Mode TRIVIA |
|--------|---------------|-------------|
| **Type** | Buzz + validation manuelle | QCM + validation automatique |
| **Vitesse** | Premier qui buzz gagne | Pas de course, temps de réflexion |
| **Musique** | Oui (30s) | Non (juste la question) |
| **Réponses** | Une seule personne buzz | Tout le monde répond |
| **Timer** | 30s (lecture musique) | 20s configurable (réflexion) |
| **Validation** | Host valide manuellement | Automatique à la fin du timer |

---

## 🎮 Flow complet du jeu

### 1️⃣ **Création et configuration**

```javascript
// Host crée la partie en mode TRIVIA
socket.emit('create_game', {
  mode: 'trivia',
  config: {
    numberOfRounds: 10,              // Nombre de questions
    triviaProvider: 'trivia',        // 'trivia' (API externe) ou 'custom' (perso)
    triviaCategory: 'histoire',      // null = toutes, ou catégorie spécifique
    triviaDifficulty: 'normal',      // 'facile', 'normal', 'difficile', ou null
    triviaTimeout: 20,               // Temps pour répondre (en secondes)
    soundEffectsVolume: 80           // Volume des sons (0-100)
  }
}, (response) => {
  if (response.success) {
    console.log('Partie créée:', response.roomCode);
  }
});
```

### 2️⃣ **Chargement des questions**

```javascript
// Host charge les questions (comme charger une playlist)
socket.emit('load_trivia_questions', {
  roomCode: 'ABCD',
  provider: 'trivia',          // Optionnel (utilise config par défaut)
  category: 'geographie',      // Optionnel
  difficulty: 'facile'         // Optionnel
}, (response) => {
  if (response.success) {
    console.log(`${response.questions.count} questions chargées`);
    console.log('Provider:', response.questions.provider);
    console.log('Catégorie:', response.questions.category);
  }
});

// Tous les clients reçoivent la confirmation
socket.on('trivia_loaded', (data) => {
  showNotification(`${data.questionCount} questions chargées !`);
  showCategory(data.category);
  showDifficulty(data.difficulty);
  enableStartButton(); // Activer le bouton "Démarrer"
});
```

### 3️⃣ **Récupérer les catégories/providers disponibles**

```javascript
// Obtenir les catégories
socket.emit('get_trivia_categories', {
  provider: 'trivia' // optionnel
}, (response) => {
  if (response.success) {
    populateCategoryDropdown(response.categories);
    // Ex: ['histoire', 'geographie', 'sciences', 'cinema', ...]
  }
});

// Obtenir les providers disponibles
socket.emit('get_trivia_providers', {}, (response) => {
  if (response.success) {
    response.providers.forEach(provider => {
      console.log(`${provider.name}: ${provider.available ? '✅' : '❌'}`);
      // Ex: { name: 'trivia', type: 'TriviaAPI', available: true, isDefault: true }
    });
  }
});
```

### 4️⃣ **Démarrage d'un round**

```javascript
// Host démarre le round (même événement que pour la musique)
socket.emit('start_round', { roomCode: 'ABCD' }, (response) => {
  if (response.success) {
    console.log('Round démarré !');
  }
});

// Tous les clients reçoivent la question
socket.on('round_started', (data) => {
  console.log('Question:', data.question);
  console.log('Round:', data.roundNumber);
  console.log('Options:', data.qcm.options);

  // Afficher la question
  displayQuestion(data.qcm.question);
  displayOptions(data.qcm.options);

  // PAS de musique en mode TRIVIA (pas de play_track)

  // Démarrer le countdown
  startCountdown(20); // triviaTimeout secondes

  // Activer les boutons de réponse
  enableAnswerButtons();
});
```

**Format de la question reçue :**

```javascript
{
  roundNumber: 1,
  playMode: 'solo', // ou 'team'
  qcm: {
    type: 'trivia',
    question: 'Quelle est la capitale de la France ?',
    options: [
      { text: 'Lyon', correct: false },
      { text: 'Paris', correct: false },      // ⚠️ correct est caché côté client
      { text: 'Marseille', correct: false },
      { text: 'Toulouse', correct: false }
    ],
    category: 'geographie',
    difficulty: 'facile',
    source: 'TriviaAPI'
    // correctAnswer est CACHÉ jusqu'à la validation
  }
}
```

### 5️⃣ **Joueur répond**

```javascript
// Joueur clique sur une option (index 0-3)
function answerQuestion(optionIndex) {
  socket.emit('submit_qcm_answer', {
    roomCode: currentRoomCode,
    optionIndex: optionIndex
  }, (response) => {
    if (response.success) {
      // Feedback visuel : réponse enregistrée
      highlightSelectedAnswer(optionIndex);
      disableAnswerButtons();
      showMessage('Réponse enregistrée ✓');

      // PAS de validation immédiate, attendre la fin du timer
    } else {
      showError(response.error);
    }
  });
}
```

### 6️⃣ **Fin du timer - Validation (Host)**

```javascript
// Le host (ou le frontend automatiquement) appelle validate_qcm à la fin du timer
function onTimerEnd() {
  socket.emit('validate_qcm', {
    roomCode: currentRoomCode
  });

  // Optionnel : afficher un loader en attendant les résultats
  showLoader('Calcul des résultats...');
}
```

### 7️⃣ **Réception des résultats**

```javascript
// TOUS les clients reçoivent les résultats
socket.on('qcm_result', (data) => {
  console.log('Résultats:', data);

  // Arrêter le timer s'il tourne encore
  stopCountdown();

  // Révéler la bonne réponse
  revealCorrectAnswer(data.correctAnswer, data.correctOption);

  // Afficher les résultats de chaque joueur
  displayResults(data.results);

  // Mettre à jour le leaderboard
  updateLeaderboard(data.leaderboard);

  // IMPORTANT : Jouer les sons selon le résultat
  playResultSounds(data.results);
});
```

**Format des résultats :**

```javascript
{
  results: [
    {
      playerId: 'player1',
      playerName: 'Alice',
      answer: 'Paris',           // Réponse donnée par le joueur
      isCorrect: true,           // ✅ Pour jouer le bon son
      pointsAwarded: 10,
      newScore: 50
    },
    {
      playerId: 'player2',
      playerName: 'Bob',
      answer: 'Lyon',
      isCorrect: false,          // ❌ Pour jouer le mauvais son
      pointsAwarded: -3,
      newScore: 20
    }
  ],
  correctAnswer: 'Paris',        // La bonne réponse
  correctOption: 'Paris',        // Texte de l'option correcte
  leaderboard: [...],            // Classement solo
  teamLeaderboard: [...]         // Classement équipe (si mode team)
}
```

---

## 🔊 Gestion des sons

### Sons à prévoir

Créez ces fichiers audio dans votre projet :

```
public/sounds/
├── trivia/
│   ├── countdown.mp3          # Tick-tock pendant le timer (optionnel)
│   ├── countdown_urgent.mp3   # 5 dernières secondes (optionnel)
│   ├── time_up.mp3            # Fin du temps
│   ├── correct.mp3            # ✅ Bonne réponse (ding positif)
│   ├── wrong.mp3              # ❌ Mauvaise réponse (buzzer négatif)
│   ├── reveal.mp3             # Révélation de la bonne réponse
│   └── next_question.mp3      # Transition vers la question suivante
```

### Implémentation des sons

```javascript
// Classe utilitaire pour gérer les sons
class SoundManager {
  constructor(volume = 80) {
    this.volume = volume / 100;
    this.sounds = {};
    this.loadSounds();
  }

  loadSounds() {
    const soundFiles = {
      countdown: '/sounds/trivia/countdown.mp3',
      countdownUrgent: '/sounds/trivia/countdown_urgent.mp3',
      timeUp: '/sounds/trivia/time_up.mp3',
      correct: '/sounds/trivia/correct.mp3',
      wrong: '/sounds/trivia/wrong.mp3',
      reveal: '/sounds/trivia/reveal.mp3',
      nextQuestion: '/sounds/trivia/next_question.mp3'
    };

    for (const [key, path] of Object.entries(soundFiles)) {
      const audio = new Audio(path);
      audio.volume = this.volume;
      this.sounds[key] = audio;
    }
  }

  play(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.currentTime = 0; // Reset si déjà en cours
      sound.play().catch(err => console.error('Erreur son:', err));
    }
  }

  setVolume(volume) {
    this.volume = volume / 100;
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
    });
  }
}

// Initialisation
const soundManager = new SoundManager(80);

// Utilisation
socket.on('qcm_result', (data) => {
  // 1. Son de fin de temps
  soundManager.play('timeUp');

  // 2. Petit délai puis révélation
  setTimeout(() => {
    soundManager.play('reveal');
    revealCorrectAnswer(data.correctAnswer);
  }, 1000);

  // 3. Afficher les résultats un par un avec sons
  data.results.forEach((result, index) => {
    setTimeout(() => {
      // Animer l'affichage du résultat
      animateResult(result);

      // Jouer le son approprié
      if (result.isCorrect) {
        soundManager.play('correct');
        showAnimation('✓', 'green');
      } else {
        soundManager.play('wrong');
        showAnimation('✗', 'red');
      }
    }, 2000 + (index * 500)); // Espacer de 500ms
  });
});
```

---

## ⏱️ Gestion du countdown

### Option 1 : Countdown côté frontend (simple)

```javascript
let countdownTimer = null;
let timeRemaining = 20;

function startCountdown(duration) {
  timeRemaining = duration;
  updateCountdownDisplay(timeRemaining);

  countdownTimer = setInterval(() => {
    timeRemaining--;
    updateCountdownDisplay(timeRemaining);

    // Sons optionnels
    if (timeRemaining === 5) {
      soundManager.play('countdownUrgent'); // Urgence à 5s
    } else if (timeRemaining > 0 && timeRemaining <= 3) {
      soundManager.play('countdown'); // Tick chaque seconde
    }

    // Animation visuelle
    if (timeRemaining <= 5) {
      addUrgentClass(); // Rougir le timer
      pulseAnimation();
    }

    // Fin du temps
    if (timeRemaining <= 0) {
      stopCountdown();
      onTimerEnd(); // Valider automatiquement
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function updateCountdownDisplay(seconds) {
  document.getElementById('countdown').textContent = seconds + 's';

  // Barre de progression visuelle
  const percentage = (seconds / 20) * 100;
  document.getElementById('progress-bar').style.width = percentage + '%';
}
```

### Option 2 : Countdown côté serveur (synchronisé)

Si vous voulez que tous les clients soient parfaitement synchronisés, demandez au backend d'émettre des événements de countdown :

```javascript
// Côté backend (optionnel, à implémenter)
// Émettre 'countdown_tick' chaque seconde

// Côté frontend
socket.on('countdown_tick', (data) => {
  updateCountdownDisplay(data.timeRemaining);

  if (data.timeRemaining === 5) {
    soundManager.play('countdownUrgent');
  }
});

socket.on('countdown_end', () => {
  soundManager.play('timeUp');
  disableAnswerButtons();
  // Les résultats arrivent automatiquement via 'qcm_result'
});
```

---

## 🎨 Interface utilisateur recommandée

### Dashboard (écran commun)

```html
<div class="trivia-round">
  <!-- En-tête -->
  <div class="round-header">
    <h2>Question <span id="round-number">1</span>/10</h2>
    <div class="category-badge">
      <span id="category">Géographie</span>
      <span id="difficulty">Facile</span>
    </div>
  </div>

  <!-- Timer -->
  <div class="countdown-container">
    <div class="countdown" id="countdown">20s</div>
    <div class="progress-bar">
      <div class="progress-fill" id="progress-bar"></div>
    </div>
  </div>

  <!-- Question -->
  <div class="question-container">
    <h1 id="question">Quelle est la capitale de la France ?</h1>
  </div>

  <!-- Options -->
  <div class="options-grid">
    <div class="option" data-index="0">A. Paris</div>
    <div class="option" data-index="1">B. Lyon</div>
    <div class="option" data-index="2">C. Marseille</div>
    <div class="option" data-index="3">D. Toulouse</div>
  </div>

  <!-- Résultats (cachés pendant la question) -->
  <div class="results-container" style="display: none;">
    <div class="correct-answer">
      ✓ Bonne réponse : <strong id="correct-text">Paris</strong>
    </div>
    <div class="players-results" id="players-results">
      <!-- Résultats des joueurs -->
    </div>
  </div>

  <!-- Leaderboard -->
  <div class="leaderboard" id="leaderboard">
    <!-- Classement -->
  </div>
</div>
```

### Buzzer (mobile - joueurs)

```html
<div class="buzzer-trivia">
  <!-- Timer -->
  <div class="mobile-countdown" id="mobile-countdown">20s</div>

  <!-- Question -->
  <div class="question-mobile">
    <p id="question-text">Quelle est la capitale de la France ?</p>
  </div>

  <!-- Boutons de réponse -->
  <div class="answer-buttons">
    <button class="answer-btn" data-index="0">
      <span class="letter">A</span>
      <span class="text">Paris</span>
    </button>
    <button class="answer-btn" data-index="1">
      <span class="letter">B</span>
      <span class="text">Lyon</span>
    </button>
    <button class="answer-btn" data-index="2">
      <span class="letter">C</span>
      <span class="text">Marseille</span>
    </button>
    <button class="answer-btn" data-index="3">
      <span class="letter">D</span>
      <span class="text">Toulouse</span>
    </button>
  </div>

  <!-- Feedback -->
  <div class="answer-feedback" id="feedback" style="display: none;">
    <div class="status-icon" id="status-icon"></div>
    <p id="feedback-text">Réponse enregistrée ✓</p>
    <p id="points">+10 points</p>
  </div>
</div>
```

---

## 🎯 Animations et effets visuels

### CSS pour les animations

```css
/* Urgence countdown */
.countdown.urgent {
  color: #ff4444;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Révélation bonne réponse */
.option.correct {
  background: #4caf50;
  animation: revealCorrect 0.5s ease;
}

.option.wrong {
  background: #f44336;
  animation: revealWrong 0.5s ease;
}

@keyframes revealCorrect {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* Feedback joueur */
.feedback.correct {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  animation: slideIn 0.3s ease;
}

.feedback.wrong {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}
```

### JavaScript pour les animations

```javascript
function animateResult(result) {
  const playerElement = document.getElementById(`player-${result.playerId}`);

  if (result.isCorrect) {
    playerElement.classList.add('correct');
    showConfetti(playerElement); // Confettis pour bonne réponse
  } else {
    playerElement.classList.add('wrong');
    shakeElement(playerElement);
  }

  // Afficher les points avec animation
  const pointsEl = playerElement.querySelector('.points');
  pointsEl.textContent = (result.pointsAwarded > 0 ? '+' : '') + result.pointsAwarded;
  pointsEl.classList.add('animate-points');
}

function showConfetti(element) {
  // Utiliser une librairie comme canvas-confetti
  confetti({
    particleCount: 50,
    spread: 70,
    origin: {
      x: element.offsetLeft / window.innerWidth,
      y: element.offsetTop / window.innerHeight
    }
  });
}
```

---

## 📱 UX Mobile (Buzzer)

### Retour haptique (vibration)

```javascript
function vibrateOnAnswer(isCorrect) {
  if ('vibrate' in navigator) {
    if (isCorrect) {
      // Vibration courte et joyeuse
      navigator.vibrate([50, 50, 50]);
    } else {
      // Vibration longue et triste
      navigator.vibrate([200]);
    }
  }
}

// Utilisation
socket.on('qcm_result', (data) => {
  const myResult = data.results.find(r => r.playerId === myPlayerId);
  vibrateOnAnswer(myResult.isCorrect);
});
```

### Désactiver le double-tap zoom

```css
.answer-btn {
  touch-action: manipulation; /* Évite le zoom au double-tap */
  user-select: none;
}
```

---

## 🔧 Gestion des cas d'erreur

```javascript
// Timeout réseau
let validationTimeout;

function onTimerEnd() {
  // Validation automatique
  socket.emit('validate_qcm', { roomCode }, (response) => {
    if (!response || !response.success) {
      showError('Erreur lors de la validation. Réessayez.');
    }
  });

  // Timeout de sécurité
  validationTimeout = setTimeout(() => {
    showError('Pas de réponse du serveur. Vérifiez votre connexion.');
  }, 5000);
}

socket.on('qcm_result', (data) => {
  clearTimeout(validationTimeout);
  // ... reste du code
});

// Déconnexion pendant le round
socket.on('disconnect', () => {
  stopCountdown();
  showReconnectingOverlay();
});

socket.on('reconnect', () => {
  // Demander l'état de la partie
  socket.emit('get_game_state', { roomCode });
});
```

---

## 📊 Statistiques et Analytics

Trackez ces événements pour améliorer l'expérience :

```javascript
// Temps de réponse moyen
const answerStartTime = Date.now();

function answerQuestion(optionIndex) {
  const responseTime = Date.now() - answerStartTime;

  analytics.track('trivia_answer', {
    responseTime,
    questionDifficulty: currentQuestion.difficulty,
    questionCategory: currentQuestion.category
  });

  // ... reste du code
}

// Taux de bonnes réponses
socket.on('qcm_result', (data) => {
  const myResult = data.results.find(r => r.playerId === myPlayerId);

  analytics.track('trivia_result', {
    isCorrect: myResult.isCorrect,
    pointsAwarded: myResult.pointsAwarded,
    category: currentQuestion.category,
    difficulty: currentQuestion.difficulty
  });
});
```

---

## ✅ Checklist d'implémentation

### Phase 1 : Core
- [ ] Écouter `round_started` et afficher la question
- [ ] Implémenter le countdown (20s)
- [ ] Permettre de répondre via `submit_qcm_answer`
- [ ] Écouter `qcm_result` et afficher les résultats
- [ ] Révéler la bonne réponse

### Phase 2 : Sons
- [ ] Créer/trouver les fichiers audio
- [ ] Implémenter la classe `SoundManager`
- [ ] Son de fin de timer
- [ ] Son de bonne réponse
- [ ] Son de mauvaise réponse

### Phase 3 : UX
- [ ] Animations de révélation
- [ ] Feedback visuel sur la sélection
- [ ] Désactivation des boutons après réponse
- [ ] Affichage des points gagnés/perdus
- [ ] Mise à jour du leaderboard

### Phase 4 : Polish
- [ ] Vibrations mobile
- [ ] Confettis pour bonnes réponses
- [ ] Transitions fluides entre questions
- [ ] Gestion des erreurs réseau
- [ ] Mode hors-ligne partiel

---

## 🚀 Exemple complet (React/Vue)

### React Hooks

```jsx
import { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import SoundManager from './utils/SoundManager';

function TriviaRound({ roomCode, playerId }) {
  const socket = useSocket();
  const soundManager = useRef(new SoundManager(80));

  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Timer
  useEffect(() => {
    if (question && timeRemaining > 0 && !showResults) {
      const timer = setTimeout(() => {
        setTimeRemaining(time => time - 1);

        if (timeRemaining === 5) {
          soundManager.current.play('countdownUrgent');
        }
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (timeRemaining === 0 && !showResults) {
      // Valider automatiquement
      socket.emit('validate_qcm', { roomCode });
    }
  }, [timeRemaining, question, showResults]);

  // Écouter les événements
  useEffect(() => {
    socket.on('round_started', (data) => {
      setQuestion(data.qcm);
      setTimeRemaining(20);
      setSelectedAnswer(null);
      setShowResults(false);
      setResults(null);
    });

    socket.on('qcm_result', (data) => {
      setResults(data);
      setShowResults(true);
      soundManager.current.play('timeUp');

      const myResult = data.results.find(r => r.playerId === playerId);
      if (myResult) {
        setTimeout(() => {
          soundManager.current.play(myResult.isCorrect ? 'correct' : 'wrong');
        }, 1000);
      }
    });

    return () => {
      socket.off('round_started');
      socket.off('qcm_result');
    };
  }, [socket, playerId]);

  const handleAnswer = (index) => {
    if (selectedAnswer !== null) return;

    setSelectedAnswer(index);
    socket.emit('submit_qcm_answer', {
      roomCode,
      optionIndex: index
    });
  };

  if (!question) return <div>En attente...</div>;

  return (
    <div className="trivia-round">
      <div className="countdown">{timeRemaining}s</div>

      <h2>{question.question}</h2>

      <div className="options">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswer(index)}
            disabled={selectedAnswer !== null}
            className={`
              option
              ${selectedAnswer === index ? 'selected' : ''}
              ${showResults && option.correct ? 'correct' : ''}
              ${showResults && selectedAnswer === index && !option.correct ? 'wrong' : ''}
            `}
          >
            {option.text}
          </button>
        ))}
      </div>

      {showResults && results && (
        <div className="results">
          <h3>✓ Bonne réponse : {results.correctAnswer}</h3>
          {results.results.map(result => (
            <div key={result.playerId} className={result.isCorrect ? 'correct' : 'wrong'}>
              {result.playerName}: {result.pointsAwarded > 0 ? '+' : ''}{result.pointsAwarded} pts
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TriviaRound;
```

---

## 🎓 Bonnes pratiques

1. **Toujours gérer les déconnexions** pendant un round actif
2. **Sauvegarder l'état** dans localStorage pour reconnexion
3. **Précharger les sons** au chargement de la page
4. **Optimiser les animations** (utiliser CSS transforms plutôt que left/top)
5. **Tester sur mobile** (tactile, vibrations, sons)
6. **Accessibilité** : contraste, taille de texte, support clavier
7. **Mode sombre** : adapter les couleurs

---

## 📞 Support

Pour toute question sur l'intégration frontend :
- Consultez `TRIVIA_INTEGRATION.md` pour l'architecture backend
- Vérifiez les événements Socket.IO dans `src/handlers/socketHandlers.js`
- Testez avec les exemples de code fournis

Bon développement ! 🚀
