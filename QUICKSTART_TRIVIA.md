# Guide de Démarrage Rapide - Mode TRIVIA

## 🚀 Comment lancer une partie ?

Ce guide explique comment créer et lancer une partie en mode TRIVIA en 5 minutes.

---

## 📋 Prérequis

- Backend démarré sur le port 3000
- Socket.IO configuré côté client
- Connexion à `http://localhost:3000` ou votre URL de production

---

## 🎮 Flow complet en 9 étapes

### 1️⃣ **Créer la partie (Host)**

```javascript
socket.emit('create_game', {
  mode: 'trivia',                    // Mode TRIVIA
  playMode: 'solo',                  // 'solo' ou 'team'
  config: {
    numberOfRounds: 10,              // Nombre de questions
    triviaProvider: 'trivia',        // 'trivia' (API externe) ou 'custom' (perso)
    triviaCategory: null,            // null = toutes, ou 'histoire', 'geographie', etc.
    triviaDifficulty: null,          // null = toutes, ou 'facile', 'normal', 'difficile'
    triviaTimeout: 20,               // Temps pour répondre (secondes)
    soundEffectsVolume: 80
  }
}, (response) => {
  if (response.success) {
    console.log('Room code:', response.roomCode);  // Ex: "ABCD"
  }
});
```

### 2️⃣ **Joueurs rejoignent (Buzzers)**

```javascript
socket.emit('join_game', {
  roomCode: 'ABCD',                  // Code fourni par le host
  playerName: 'Alice'
}, (response) => {
  if (response.success) {
    console.log('Connecté :', response.player);
  }
});

// Tous reçoivent
socket.on('player_joined', (data) => {
  console.log(`${data.player.name} a rejoint`);
});
```

### 3️⃣ **Charger les questions (Host)**

```javascript
socket.emit('load_trivia_questions', {
  roomCode: 'ABCD',
  provider: 'trivia',                // Optionnel
  category: 'histoire',              // Optionnel
  difficulty: 'normal'               // Optionnel
}, (response) => {
  console.log(`${response.questions.count} questions chargées`);
});

// Tous reçoivent
socket.on('trivia_loaded', (data) => {
  console.log(`${data.questionCount} questions prêtes`);
  enableStartButton();
});
```

### 4️⃣ **Démarrer le round (Host)**

```javascript
socket.emit('start_round', { roomCode: 'ABCD' });

// Tous reçoivent
socket.on('round_started', (data) => {
  displayQuestion(data.qcm.question);
  displayOptions(data.qcm.options);
  startCountdown(20);
});
```

### 5️⃣ **Joueurs répondent (pendant 20s)**

```javascript
socket.emit('submit_qcm_answer', {
  roomCode: 'ABCD',
  optionIndex: 2                     // Index 0-3
}, (response) => {
  if (response.success) {
    disableAnswerButtons();
    showMessage('Réponse enregistrée ✓');
  }
});
```

### 6️⃣ **Fin du timer - Validation**

```javascript
// Auto-validation à la fin du timer
setTimeout(() => {
  socket.emit('validate_qcm', { roomCode: 'ABCD' });
}, 20000);
```

### 7️⃣ **Résultats (tous)**

```javascript
socket.on('qcm_result', (data) => {
  // Révéler la bonne réponse
  console.log('Réponse:', data.correctAnswer);

  // Résultats par joueur
  data.results.forEach(result => {
    console.log(`${result.playerName}: ${result.isCorrect ? '✅' : '❌'}`);

    // Jouer les sons
    playSound(result.isCorrect ? 'correct.mp3' : 'wrong.mp3');
  });

  // Leaderboard
  updateLeaderboard(data.leaderboard);
});
```

### 8️⃣ **Question suivante**

```javascript
// Après 5 secondes, lancer la prochaine question
setTimeout(() => {
  socket.emit('start_round', { roomCode: 'ABCD' });
}, 5000);
```

### 9️⃣ **Fin de partie**

```javascript
socket.on('game_finished', (data) => {
  console.log('Gagnant:', data.winner);
  showGameOverScreen(data.finalLeaderboard);
});
```

---

## 🎯 Résumé visuel

```
Host crée partie (create_game)
         ↓
Joueurs rejoignent (join_game)
         ↓
Host charge questions (load_trivia_questions)
         ↓
Host démarre round (start_round)
         ↓
Joueurs répondent (submit_qcm_answer) [20s]
         ↓
Validation (validate_qcm)
         ↓
Résultats (qcm_result) + Sons
         ↓
Répéter pour chaque question
         ↓
Fin de partie (game_finished)
```

---

## 🔊 Gestion des sons

Les sons doivent être joués **côté frontend** en fonction de `isCorrect` :

```javascript
socket.on('qcm_result', (data) => {
  const myResult = data.results.find(r => r.playerId === myPlayerId);

  if (myResult.isCorrect) {
    playSound('correct.mp3');         // ✅ Son positif
    showAnimation('green');
  } else {
    playSound('wrong.mp3');           // ❌ Son négatif
    showAnimation('red');
  }
});
```

**Sons recommandés :**
- `correct.mp3` - Bonne réponse (ding)
- `wrong.mp3` - Mauvaise réponse (buzzer)
- `time_up.mp3` - Fin du timer
- `countdown.mp3` - 5 dernières secondes (optionnel)

---

## ⏱️ Timer automatique

```javascript
let timerInterval;
let timeLeft = 20;

function startCountdown(duration) {
  timeLeft = duration;
  updateDisplay(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateDisplay(timeLeft);

    if (timeLeft === 5) {
      playSound('countdown_urgent.mp3');
      addUrgentClass();
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      socket.emit('validate_qcm', { roomCode });
    }
  }, 1000);
}
```

---

## 📦 Événements Socket.IO (Référence)

### Émettre (Client → Serveur)

| Événement | Paramètres | Description |
|-----------|------------|-------------|
| `create_game` | `{ mode, config }` | Créer une partie |
| `join_game` | `{ roomCode, playerName }` | Rejoindre une partie |
| `load_trivia_questions` | `{ roomCode, provider?, category?, difficulty? }` | Charger les questions |
| `get_trivia_categories` | `{ provider? }` | Liste des catégories |
| `get_trivia_providers` | `{}` | Liste des providers |
| `start_round` | `{ roomCode }` | Démarrer un round |
| `submit_qcm_answer` | `{ roomCode, optionIndex }` | Répondre (0-3) |
| `validate_qcm` | `{ roomCode }` | Valider les réponses |

### Recevoir (Serveur → Client)

| Événement | Data | Description |
|-----------|------|-------------|
| `game_created` | `{ success, roomCode, mode }` | Partie créée |
| `game_joined` | `{ success, player, players }` | Joueur rejoint |
| `player_joined` | `{ player, players }` | Nouveau joueur |
| `trivia_loaded` | `{ questionCount, provider, category }` | Questions chargées |
| `trivia_categories` | `{ categories }` | Liste catégories |
| `trivia_providers` | `{ providers }` | Liste providers |
| `round_started` | `{ roundNumber, qcm }` | Question affichée |
| `qcm_result` | `{ results, correctAnswer, leaderboard }` | Résultats |
| `game_finished` | `{ finalLeaderboard, winner, totalRounds }` | Fin de partie |

---

## 🎨 Interface minimale

### HTML Host (Dashboard)

```html
<div id="host">
  <h1>Code: <span id="code">-</span></h1>
  <button onclick="createGame()">Créer</button>
  <button onclick="loadQuestions()">Charger questions</button>
  <button onclick="startRound()">Démarrer</button>

  <div id="question"></div>
  <div id="results"></div>
</div>
```

### HTML Joueur (Buzzer)

```html
<div id="buzzer">
  <div id="timer">20s</div>
  <h2 id="question"></h2>

  <button class="answer" onclick="answer(0)">A</button>
  <button class="answer" onclick="answer(1)">B</button>
  <button class="answer" onclick="answer(2)">C</button>
  <button class="answer" onclick="answer(3)">D</button>

  <div id="score">0</div>
</div>
```

---

## 💡 Exemple complet JavaScript

### Host

```javascript
const socket = io('http://localhost:3000');
let roomCode;

// 1. Créer
document.getElementById('create-btn').onclick = () => {
  socket.emit('create_game', {
    mode: 'trivia',
    config: { numberOfRounds: 5, triviaTimeout: 20 }
  }, (response) => {
    roomCode = response.roomCode;
    document.getElementById('code').textContent = roomCode;
  });
};

// 2. Charger questions
document.getElementById('load-btn').onclick = () => {
  socket.emit('load_trivia_questions', { roomCode });
};

socket.on('trivia_loaded', (data) => {
  alert(`${data.questionCount} questions prêtes !`);
  document.getElementById('start-btn').disabled = false;
});

// 3. Démarrer
document.getElementById('start-btn').onclick = () => {
  socket.emit('start_round', { roomCode });
};

// 4. Afficher résultats
socket.on('qcm_result', (data) => {
  displayResults(data);
  setTimeout(() => socket.emit('start_round', { roomCode }), 5000);
});
```

### Joueur

```javascript
const socket = io('http://localhost:3000');
let myPlayerId;

// 1. Rejoindre
function join(name) {
  const code = prompt('Code ?');
  socket.emit('join_game', { roomCode: code, playerName: name }, (r) => {
    myPlayerId = r.player.id;
  });
}

// 2. Recevoir question
socket.on('round_started', (data) => {
  document.getElementById('question').textContent = data.qcm.question;
  data.qcm.options.forEach((opt, i) => {
    document.getElementById(`btn-${i}`).textContent = opt.text;
  });
  startTimer(20);
});

// 3. Répondre
function answer(index) {
  socket.emit('submit_qcm_answer', {
    roomCode: currentRoom,
    optionIndex: index
  });
  document.querySelectorAll('.answer').forEach(b => b.disabled = true);
}

// 4. Résultats
socket.on('qcm_result', (data) => {
  const me = data.results.find(r => r.playerId === myPlayerId);
  playSound(me.isCorrect ? 'correct.mp3' : 'wrong.mp3');
  document.getElementById('score').textContent = me.newScore;
});
```

---

## 🔧 Configuration avancée

### Choisir la catégorie

```javascript
socket.emit('get_trivia_categories', {}, (response) => {
  response.categories.forEach(cat => {
    console.log(cat); // 'histoire', 'geographie', etc.
  });
});

// Puis charger avec catégorie spécifique
socket.emit('load_trivia_questions', {
  roomCode: 'ABCD',
  category: 'histoire',
  difficulty: 'difficile'
});
```

### Utiliser des questions custom

```javascript
socket.emit('load_trivia_questions', {
  roomCode: 'ABCD',
  provider: 'custom'  // Utilise src/data/custom-questions.json
});
```

### Mode équipe

```javascript
socket.emit('create_game', {
  mode: 'trivia',
  playMode: 'team',  // Mode équipe
  config: { numberOfRounds: 10 }
});

// Créer des équipes (après création)
socket.emit('create_team', {
  roomCode: 'ABCD',
  teamName: 'Les champions',
  teamColor: '#FF3366'
});

// Joueurs rejoignent une équipe
socket.emit('join_team', {
  roomCode: 'ABCD',
  teamId: 'team-123'
});
```

---

## ✅ Checklist de démarrage

### Backend
- [ ] Serveur démarré (`npm start` ou `node src/index.js`)
- [ ] Port 3000 accessible
- [ ] Logs "Server running on port 3000" visible

### Frontend
- [ ] Socket.IO connecté
- [ ] Événement `connect` reçu
- [ ] Interface Host prête
- [ ] Interface Buzzer prête

### Sons (optionnel mais recommandé)
- [ ] `correct.mp3` disponible
- [ ] `wrong.mp3` disponible
- [ ] `time_up.mp3` disponible
- [ ] Volume configuré

### Tests
- [ ] Créer une partie → OK
- [ ] Rejoindre avec un joueur → OK
- [ ] Charger questions → OK
- [ ] Démarrer round → OK
- [ ] Répondre → OK
- [ ] Voir résultats → OK
- [ ] Sons joués → OK

---

## 🐛 Troubleshooting

### "Game not found"
→ Vérifier que le `roomCode` est correct (4 caractères, ex: "ABCD")

### "No questions available"
→ Appeler `load_trivia_questions` avant `start_round`

### "TRIVIA_API_ERROR"
→ L'API externe est indisponible, utiliser `provider: 'custom'`

### Pas de sons
→ Vérifier que les fichiers audio existent et que le volume n'est pas à 0

### Timer désynchronisé
→ Implémenter le timer côté serveur (feature à venir)

---

## 📚 Documentation complète

- **Architecture backend** : `TRIVIA_INTEGRATION.md`
- **Guide frontend** : `TRIVIA_FRONTEND_GUIDE.md`
- **API Socket.IO** : `README.md`

---

## 🚀 Démarrage ultra-rapide (1 minute)

```javascript
// 1. Créer
socket.emit('create_game', { mode: 'trivia' }, (r) => {
  console.log('Code:', r.roomCode);

  // 2. Charger
  socket.emit('load_trivia_questions', { roomCode: r.roomCode }, () => {

    // 3. Démarrer
    socket.emit('start_round', { roomCode: r.roomCode });
  });
});

// 4. Résultats
socket.on('qcm_result', (data) => console.log(data));
```

**C'est tout !** 🎉

---

Pour plus d'informations, consultez la documentation complète ou posez vos questions.
