# ⚡ Quick Start - Blindtest Backend v2.0

Démarrage rapide en 5 minutes !

## 🚀 Installation Express

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer Spotify API
# Aller sur https://developer.spotify.com/dashboard
# → Create an app
# → Copier Client ID et Client Secret

# 3. Configuration
cp env.example .env
nano .env  # Éditer avec vos credentials
```

## 🔑 Configuration Minimale (.env)

```bash
SPOTIFY_CLIENT_ID=votre_client_id_ici
SPOTIFY_CLIENT_SECRET=votre_secret_ici
CLIENT_URL=http://localhost:3000
PORT=3001
```

## ▶️ Démarrer

```bash
# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm start
```

Vous devriez voir :
```
✅ Spotify authenticated
🚀 Server started { port: 3001, env: 'development' }
📡 Socket.IO listening for connections
🎵 Spotify API authenticated
```

## ✅ Vérifier que ça marche

### Test 1 : Health Check
```bash
curl http://localhost:3001/api/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "uptime": 12.34,
  "spotify": "connected",
  "games": { "active": 0, "totalPlayers": 0 }
}
```

### Test 2 : Info API
```bash
curl http://localhost:3001/
```

Devrait afficher les endpoints disponibles.

### Test 3 : Playlist Spotify
```bash
# Tester avec une playlist publique (exemple : Top 50 France)
curl "http://localhost:3001/api/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M"
```

Devrait retourner le nom et le nombre de tracks.

## 🎮 Tester avec le Frontend

1. **Démarrer le backend** : `npm run dev`
2. **Démarrer le frontend** dans un autre terminal
3. **Créer une partie** sur le frontend
4. **Rejoindre avec plusieurs onglets**
5. **Charger une playlist Spotify publique**
6. **Jouer !**

## 📋 Playlists de Test

Playlists Spotify publiques pour tester :

| Nom | ID | Tracks |
|-----|----|----|
| Top 50 France | `37i9dQZF1DXcBWIGoYBM5M` | ~50 |
| Today's Top Hits | `37i9dQZF1DXcBWIGoYBM5M` | ~50 |
| Rock Classics | `37i9dQZF1DWXRqgorJj26U` | ~100 |

URL format : `https://open.spotify.com/playlist/[ID]`

## 🐛 Dépannage Rapide

### "Spotify authentication failed"
➡️ Vérifier `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` dans `.env`

### "Playlist vide"
➡️ La playlist doit être **publique** et avoir au moins 10 tracks avec preview

### "Port already in use"
➡️ Changer `PORT=3001` dans `.env` ou tuer le processus :
```bash
lsof -ti:3001 | xargs kill -9
```

### "CORS error"
➡️ Vérifier que `CLIENT_URL` dans `.env` correspond à l'URL du frontend

## 📚 Documentation Complète

- **README.md** - Documentation complète
- **MIGRATION.md** - Guide de migration depuis v1.0
- **CONFIGURATION_FRONTEND.md** - Config frontend (ancien)

## 🎯 Prochaines Étapes

1. ✅ Backend qui tourne
2. 🎨 Connecter le frontend
3. 🎮 Tester le mode "Accumul' Points"
4. ✨ Ajouter les nouveaux modes (QCM, etc.)

## 🆘 Besoin d'Aide ?

1. Vérifier les logs du serveur (Winston affiche tout)
2. Tester `/api/health`
3. Consulter `README.md` pour plus de détails

## 💡 Tips

- Les logs sont colorisés et détaillés
- Le serveur redémarre auto avec `npm run dev` (nodemon)
- Les parties inactives sont nettoyées après 30min
- Le cache Spotify réduit les appels API

---

**Temps de setup** : ~5 minutes
**Prérequis** : Node.js 18+, compte Spotify Developer (gratuit)
