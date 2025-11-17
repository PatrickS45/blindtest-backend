# 📦 Guide de Migration v1.0 → v2.0

Ce guide explique les changements entre l'ancienne version (server.js monolithique) et la nouvelle architecture v2.0.

## 🔄 Changements Majeurs

### Architecture
| Avant (v1.0) | Après (v2.0) |
|--------------|--------------|
| 1 fichier monolithique | Architecture modulaire MVC |
| Pas de validation | Validation stricte de toutes les entrées |
| Axios brut | SDK Spotify officiel + cache |
| Console.log | Logger Winston structuré |
| 1 mode de jeu | 6 modes de jeu |
| Pas de QCM | Génération automatique QCM |

### Compatibilité Frontend

✅ **Les événements Socket.IO sont rétrocompatibles** pour le mode de base :
- `create_game`
- `join_game`
- `load_playlist`
- `start_round`
- `buzz`
- `validate_answer`
- `skip_round`

⚠️ **Nouveaux événements** pour les nouveaux modes :
- `submit_qcm_answer` (mode QCM)
- `validate_qcm` (mode QCM)
- `select_target` (mode Tueurs à Gages)
- `bomb_exploded` (mode Chaud Devant)

### Configuration

#### Avant (.env v1.0)
```bash
PORT=3001
CLIENT_URL=http://localhost:3000
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

#### Après (.env v2.0)
```bash
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
LOG_LEVEL=info  # ← Nouveau
```

## 🚀 Migration Étape par Étape

### 1. Backup
```bash
# Sauvegarder l'ancien serveur (déjà fait)
# server.js → server.js.old
```

### 2. Installer les nouvelles dépendances
```bash
npm install
```

Nouvelles dépendances :
- `spotify-web-api-node` - SDK Spotify officiel
- `winston` - Logging structuré
- `node-cache` - Cache en mémoire
- `express-rate-limit` - Rate limiting

### 3. Mettre à jour .env
```bash
# Copier le template
cp env.example .env

# Éditer avec vos credentials
nano .env
```

### 4. Tester le nouveau backend
```bash
# Développement
npm run dev

# Le serveur devrait afficher :
# 🚀 Server started { port: 3001, env: 'development' }
# ✅ Spotify authenticated
# 🎵 Spotify API authenticated
```

### 5. Vérifier l'API
```bash
# Health check
curl http://localhost:3001/api/health

# Devrait retourner :
# {
#   "status": "ok",
#   "uptime": 12.34,
#   "spotify": "connected",
#   "games": { "active": 0, "totalPlayers": 0 }
# }
```

## 🔧 Adaptation du Frontend

### Pas de changement nécessaire pour :
- Connexion Socket.IO
- Création/Join de partie
- Chargement de playlist
- Mode "Accumul' Points" basique

### Changements optionnels pour nouveaux modes :

#### Mode QCM
```javascript
// Écouter le QCM
socket.on('round_started', (data) => {
  if (data.qcm) {
    // Afficher la question et les 4 options
    console.log(data.qcm.question); // "Qui chante ce titre ?"
    console.log(data.qcm.options);  // [{ text: "...", correct: false }, ...]
  }
});

// Répondre
socket.emit('submit_qcm_answer', {
  roomCode: 'ABC1',
  optionIndex: 2  // L'option sélectionnée (0-3)
});

// Recevoir le résultat
socket.on('qcm_result', (data) => {
  console.log(data.results);      // Résultats de tous les joueurs
  console.log(data.correctAnswer); // La bonne réponse
  console.log(data.leaderboard);   // Classement mis à jour
});
```

#### Mode Questions en Rafale
```javascript
socket.on('round_started', (data) => {
  if (data.hints) {
    // Afficher les indices progressivement
    data.hints.forEach(hint => {
      setTimeout(() => {
        console.log(hint.text);
      }, hint.time * 1000);
    });
  }
});
```

#### Mode Chaud Devant
```javascript
socket.on('round_started', (data) => {
  if (data.bombHolder) {
    console.log(`💣 Bombe chez : ${data.bombHolder}`);
  }
});

socket.on('round_result', (data) => {
  if (data.newBombHolder) {
    console.log(`💣 Bombe passée à : ${data.newBombHolder}`);
  }
});
```

## 📊 Comparaison des Fonctionnalités

| Fonctionnalité | v1.0 | v2.0 |
|----------------|------|------|
| Modes de jeu | 1 | 6 ✅ |
| QCM automatique | ❌ | ✅ |
| Cache Spotify | ❌ | ✅ |
| Rate limiting | ❌ | ✅ |
| Validation entrées | ❌ | ✅ |
| Logging structuré | ❌ | ✅ |
| Monitoring | ❌ | ✅ |
| Health check | ❌ | ✅ |
| Gestion preview null | ⚠️ Partiel | ✅ |
| Reconnexion joueur | ✅ | ✅ |
| Mode Display | ✅ | ✅ |

## 🐛 Bugs Corrigés

### v1.0 → v2.0

1. **Preview URL null**
   - ❌ Avant : Crash si track sans preview
   - ✅ Après : Filtrage automatique

2. **Tracks dupliqués**
   - ❌ Avant : Pouvait rejouer le même track
   - ✅ Après : Set() pour tracking

3. **Pas de limite de joueurs**
   - ❌ Avant : Illimité
   - ✅ Après : Max 25 joueurs

4. **Token Spotify expiré**
   - ❌ Avant : Renouvellement manuel
   - ✅ Après : Auto-refresh toutes les 50min

5. **Pas de nettoyage mémoire**
   - ❌ Avant : Parties accumulées
   - ✅ Après : Cleanup auto après 30min

## 🧪 Tests de Régression

Vérifier que ces fonctionnalités marchent toujours :

```bash
# 1. Créer une partie
# 2. Joindre avec plusieurs joueurs
# 3. Charger une playlist Spotify publique
# 4. Démarrer un round
# 5. Buzzer fonctionne
# 6. Validation correcte/incorrecte
# 7. Leaderboard mis à jour
# 8. Skip round fonctionne
# 9. Reconnexion joueur
# 10. Display mode
```

## 📝 Nouveaux Endpoints à Utiliser

### Avant chargement playlist
```javascript
// Valider la playlist avant de la charger
const response = await fetch(
  `http://localhost:3001/api/spotify/playlist/${playlistId}`
);

const data = await response.json();
console.log(`✅ ${data.trackCount} tracks utilisables`);
```

### Monitoring
```javascript
// Métriques du serveur
const metrics = await fetch('http://localhost:3001/api/metrics');
console.log(await metrics.json());

// Statut d'une partie
const gameStatus = await fetch(`http://localhost:3001/api/game/${roomCode}/status`);
```

## ⚠️ Breaking Changes

### Aucun pour le mode basique !

Le mode "Accumul' Points" reste 100% compatible.

Les nouveaux modes sont **opt-in** - le frontend peut les ignorer.

## 🎯 Recommandations

1. **Tester en local d'abord**
   - Valider avec `npm run dev`
   - Tester tous les flows

2. **Déployer sur une branche de test**
   - Ne pas écraser la prod directement
   - Tester avec quelques utilisateurs

3. **Monitorer les logs**
   - Utiliser `/api/metrics`
   - Vérifier `/api/health`

4. **Mettre à jour progressivement**
   - Phase 1 : Backend v2.0 en mode compatible
   - Phase 2 : Ajouter nouveaux modes au frontend
   - Phase 3 : UX avancée

## 🆘 Rollback si Problème

Si besoin de revenir à v1.0 :

```bash
# Restaurer l'ancien serveur
mv server.js.old server.js

# Revenir au package.json v1.0
git checkout HEAD~1 package.json

# Réinstaller
npm install

# Redémarrer
npm start
```

## 📞 Support

En cas de problème :
1. Vérifier les logs : Winston affiche tout
2. Tester `/api/health`
3. Vérifier les credentials Spotify
4. Consulter `README.md`

---

**Dernière mise à jour** : 17/11/2025
