# 🎮 Blindtest Backend v2.0

Backend multi-modes de jeu Buzz! avec Spotify Web API.

## ✨ Fonctionnalités

### 6 Modes de jeu
- **Accumul' Points** - Buzz classique avec validation manuelle
- **Réflex-O-Quiz** - Bonus de vitesse pour les premiers buzzers
- **QCM Musical** - Questions à choix multiples auto-générées
- **Questions en Rafale** - Révélation progressive d'indices
- **Chaud Devant** - Patate chaude musicale
- **Tueurs à Gages** - Vol de points entre joueurs

### Système QCM automatique
- **3 types de questions** : Artiste, Titre, Année
- **3 stratégies de génération** :
  1. Artistes de la playlist (rapide, cohérent)
  2. Recommendations Spotify (qualité)
  3. Fallback générique par décennie

### Architecture robuste
- ✅ **Cache intelligent** - Réduit les appels Spotify API
- ✅ **Rate limiting** - Respecte les quotas Spotify (180 req/min)
- ✅ **Logging structuré** - Winston avec niveaux configurables
- ✅ **Validation stricte** - Toutes les entrées utilisateur validées
- ✅ **Gestion d'erreurs** - Fallbacks et retry logic
- ✅ **Monitoring** - Métriques temps réel et health checks

## 🚀 Installation

### Prérequis
- Node.js 18+
- Compte Spotify Developer (gratuit)

### Configuration

1. **Cloner et installer**
```bash
git clone <repo-url>
cd blindtest-backend
npm install
```

2. **Configuration Spotify**
- Aller sur https://developer.spotify.com/dashboard
- Créer une application
- Copier `Client ID` et `Client Secret`

3. **Variables d'environnement**
```bash
cp env.example .env
```

Éditer `.env` :
```bash
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
CLIENT_URL=http://localhost:3000
PORT=3001
```

4. **Démarrer**
```bash
# Développement
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### REST API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/` | GET | Informations API |
| `/api/health` | GET | Health check + statut Spotify |
| `/api/spotify/playlist/:id` | GET | Récupérer une playlist |
| `/api/game/:roomCode/status` | GET | Statut d'une partie |
| `/api/games` | GET | Liste des parties actives |
| `/api/metrics` | GET | Métriques serveur |

### Socket.IO Events

#### Client → Serveur

| Event | Payload | Description |
|-------|---------|-------------|
| `create_game` | `{ mode, config }` | Créer une partie |
| `join_game` | `{ roomCode, playerName }` | Rejoindre |
| `load_playlist` | `{ roomCode, playlistId }` | Charger playlist |
| `start_round` | `{ roomCode }` | Démarrer manche |
| `buzz` | `{ roomCode }` | Buzzer |
| `submit_qcm_answer` | `{ roomCode, optionIndex }` | Réponse QCM |
| `validate_answer` | `{ roomCode, playerId, isCorrect }` | Valider (host) |
| `validate_qcm` | `{ roomCode }` | Valider QCM (host) |
| `skip_round` | `{ roomCode }` | Passer manche |
| `select_target` | `{ roomCode, targetId }` | Sélectionner cible |
| `bomb_exploded` | `{ roomCode }` | Bombe a explosé |

#### Serveur → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `player_joined` | `{ player, players }` | Joueur rejoint |
| `player_left` | `{ playerId, players }` | Joueur parti |
| `playlist_loaded` | `{ playlistName, trackCount }` | Playlist chargée |
| `round_started` | `{ roundNumber, track, qcm?, hints? }` | Manche démarrée |
| `buzz_locked` | `{ playerId, playerName, position }` | Buzz enregistré |
| `stop_music` | - | Stopper musique |
| `round_result` | `{ isCorrect, points, leaderboard }` | Résultat manche |
| `qcm_result` | `{ results, correctAnswer, leaderboard }` | Résultat QCM |
| `round_skipped` | `{ answer, leaderboard }` | Manche passée |
| `target_selected` | `{ targetId }` | Cible sélectionnée |
| `bomb_explosion_result` | `{ victimId, pointsLost }` | Bombe explosée |
| `game_ended` | `{ reason }` | Partie terminée |

## 📁 Structure du projet

```
blindtest-backend/
├── src/
│   ├── config/
│   │   ├── constants.js        # Constantes globales
│   │   └── spotify.js          # Config Spotify API
│   ├── models/
│   │   ├── Game.js             # Modèle de partie
│   │   └── Round.js            # Modèle de manche
│   ├── services/
│   │   ├── spotifyService.js   # Intégration Spotify
│   │   ├── qcmGenerator.js     # Génération QCM auto
│   │   └── gameEngine.js       # Moteur de jeu
│   ├── handlers/
│   │   ├── socketHandlers.js   # Gestion Socket.IO
│   │   └── apiRoutes.js        # Routes REST
│   ├── utils/
│   │   ├── logger.js           # Logger Winston
│   │   ├── validators.js       # Validation données
│   │   └── scoring.js          # Calcul scores
│   └── index.js                # Point d'entrée
├── package.json
├── render.yaml                 # Config Render.com
├── env.example                 # Template config
└── README.md
```

## 🎯 Modes de jeu - Détails

### 1. Accumul' Points
- Buzz classique
- Validation manuelle par le MC
- +10 points si correct, -5 si incorrect

### 2. Réflex-O-Quiz
- Plusieurs joueurs peuvent buzzer
- Ordre enregistré
- 1er = 15pts, 2e = 10pts, 3e = 5pts
- -5 si incorrect

### 3. QCM Musical
- 4 options générées automatiquement
- Tous les joueurs répondent
- Validation automatique
- +10 si correct, -3 si incorrect

### 4. Questions en Rafale
- Indices révélés progressivement
- Plus on buzze tôt, plus on gagne
- <3s = 20pts, 3-8s = 15pts, 8-15s = 10pts, >15s = 5pts

### 5. Chaud Devant
- Bombe attribuée aléatoirement
- Réponse correcte = passer la bombe (+5pts)
- Réponse incorrecte = garder la bombe (0pts)
- Explosion après 30s = -15pts

### 6. Tueurs à Gages
- Réponse correcte = choisir une cible
- Voler 10 points à la cible + gagner 10 points
- -5 si incorrect

## 🔒 Sécurité & Performance

### Implémenté
- ✅ Rate limiting (60 req/min pour API REST)
- ✅ Validation stricte des entrées
- ✅ CORS configuré
- ✅ Sanitization des noms de joueurs
- ✅ Cache Spotify (TTL 1h)
- ✅ Nettoyage automatique des parties inactives (30min)
- ✅ Gestion du rate limit Spotify (180 req/min)

### Limites
- Max 25 joueurs par partie
- Max 10 parties actives simultanées
- Min 10 tracks avec preview par playlist

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/api/health
```

Réponse :
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": 1234567890,
  "spotify": "connected",
  "games": {
    "active": 3,
    "totalPlayers": 12
  }
}
```

### Métriques
```bash
curl http://localhost:3001/api/metrics
```

Inclut :
- Uptime serveur
- Mémoire utilisée
- Nombre de parties par mode
- Stats du cache Spotify
- Nombre de joueurs

## 🚢 Déploiement sur Render.com

1. **Créer un compte** sur https://render.com

2. **Nouveau Web Service**
- Connecter le repo GitHub
- Build Command: `npm install`
- Start Command: `npm start`

3. **Variables d'environnement**
```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
CLIENT_URL=https://votre-frontend.vercel.app
NODE_ENV=production
```

4. **Déployer** 🚀

L'URL sera : `https://votre-app.onrender.com`

## 🧪 Tests

### Test manuel
```bash
# Démarrer le serveur
npm run dev

# Dans un autre terminal
curl http://localhost:3001/api/health
curl http://localhost:3001/api/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M
```

### Tester Socket.IO
Utiliser le frontend ou un client Socket.IO de test.

## ❓ FAQ

### Playlist Spotify vide ?
➡️ Vérifier que la playlist est **publique** et contient au moins 10 tracks avec preview (certains tracks n'ont pas de preview 30s)

### Erreur d'authentification Spotify ?
➡️ Vérifier `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` dans `.env`

### "Too many requests" ?
➡️ Le système attend automatiquement. Si persistant, c'est que le quota Spotify est dépassé (180 req/min)

### Serveur Render endormi ?
➡️ Render gratuit se met en veille après 15min. Première connexion = 30s de démarrage

## 📝 Changelog

### v2.0.0 (2025-01-17)
- ✨ 6 modes de jeu complets
- ✨ Génération automatique de QCM
- ✨ Cache Spotify intelligent
- ✨ Architecture modulaire
- ✨ Logging structuré Winston
- ✨ Monitoring et métriques
- 🔧 Migration vers SDK Spotify officiel
- 🔧 Amélioration gestion erreurs
- 🔧 Rate limiting Spotify automatique

### v1.0.0
- Mode Accumul' Points basique
- Intégration Spotify manuelle

## 📄 Licence

ISC

## 👨‍💻 Auteur

**Paddy Sancho**

---

**Stack** : Node.js 18+ • Express • Socket.IO • Spotify Web API • Winston • Node-Cache
