# 🚀 Guide de Déploiement - Blindtest Full Stack

## 🔍 Diagnostic du Problème

Votre frontend est déployé en **production** mais essaie de se connecter à `localhost:3001`, ce qui est **impossible** !

```typescript
// Frontend (src/hooks/useSocket.ts)
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
```

**Résultat :**
- ❌ Frontend (Vercel) → `localhost:3001` → Backend introuvable
- ❌ Impossible de créer une partie
- ❌ Erreur de connexion Socket.IO

## ✅ Solution en 3 Étapes

---

## 📦 ÉTAPE 1 : Déployer le Backend sur Render (5 minutes)

### 1.1 Créer un compte Render
- Aller sur https://render.com
- S'inscrire avec GitHub (gratuit)

### 1.2 Créer un Web Service
1. Cliquer sur **"New +"** → **"Web Service"**
2. **Connecter le repository** : `PatrickS45/blindtest-backend`
3. **Configuration** :

| Paramètre | Valeur |
|-----------|--------|
| **Name** | `blindtest-backend` (ou votre choix) |
| **Region** | Europe (London) - Plus proche |
| **Branch** | `main` |
| **Root Directory** | (vide) |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | **Free** |

### 1.3 Ajouter les Variables d'Environnement

Cliquer sur **"Advanced"** → **"Add Environment Variable"**

```bash
# Spotify API (IMPORTANT: Régénérez vos credentials avant !)
SPOTIFY_CLIENT_ID=05d698903a5746aba3e5a603d0c5b038
SPOTIFY_CLIENT_SECRET=cadc03075c664a8f9b1793d59607f39a

# URL du frontend (remplacez par votre URL Vercel)
CLIENT_URL=https://votre-frontend.vercel.app

# Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

⚠️ **IMPORTANT** : Remplacez `CLIENT_URL` par l'URL exacte de votre frontend Vercel !

### 1.4 Déployer

1. Cliquer sur **"Create Web Service"**
2. Attendre 2-3 minutes (première compilation)
3. **Copier l'URL générée** : `https://blindtest-backend-XXXX.onrender.com`

### 1.5 Vérifier le Déploiement

Ouvrir dans un navigateur :
```
https://blindtest-backend-XXXX.onrender.com/api/health
```

Vous devriez voir :
```json
{
  "status": "ok",
  "uptime": 123.45,
  "spotify": "connected",
  "games": {
    "active": 0,
    "totalPlayers": 0
  }
}
```

---

## 🎨 ÉTAPE 2 : Configurer le Frontend sur Vercel

### 2.1 Aller sur Vercel Dashboard
- https://vercel.com/dashboard
- Sélectionner votre projet `blindtest-frontend`

### 2.2 Ajouter les Variables d'Environnement

1. **Settings** → **Environment Variables**
2. **Ajouter** :

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_SOCKET_URL` | `https://blindtest-backend-XXXX.onrender.com` | Production, Preview, Development |

⚠️ **Remplacez** `XXXX` par votre vraie URL Render !

### 2.3 Redéployer

**Option A** - Automatique :
- Vercel détecte le changement et redéploie

**Option B** - Manuel :
1. **Deployments** → **...** (dernier déploiement)
2. **Redeploy**

---

## 🧪 ÉTAPE 3 : Tester l'Application

### 3.1 Ouvrir le Frontend
```
https://votre-frontend.vercel.app
```

### 3.2 Console du Navigateur (F12)

Vous devriez voir :
```
✅ Socket connected to: https://blindtest-backend-XXXX.onrender.com
```

Et PAS :
```
❌ Failed to connect to http://localhost:3001
```

### 3.3 Créer une Partie

1. **Créer une partie** → Devrait fonctionner ✅
2. **Charger une playlist** Spotify
3. **Démarrer un round**

---

## 🔒 SÉCURITÉ : Régénérer les Credentials Spotify

⚠️ **VOS CREDENTIALS SPOTIFY SONT EXPOSÉS** dans l'historique Git !

### Actions URGENTES :

1. **Aller sur** : https://developer.spotify.com/dashboard
2. **Cliquer** sur votre app
3. **Settings** → **View client secret** → **RESET CLIENT SECRET**
4. **Copier** les nouveaux credentials
5. **Mettre à jour sur Render** :
   - Dashboard → Service → Environment
   - Modifier `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET`
   - Save → Service redémarre automatiquement

---

## 🐛 Résolution des Problèmes

### Problème : "Backend en veille" (Render gratuit)

**Symptôme** : Première connexion lente (30s)

**Cause** : Render gratuit se met en veille après 15 min d'inactivité

**Solutions** :
1. Ajouter un ping keep-alive (optionnel)
2. Prévenir l'utilisateur : "Chargement initial..."
3. Upgrade vers Render payant ($7/mois)

### Problème : Erreur CORS

**Symptôme** : `Access-Control-Allow-Origin`

**Solution** : Vérifier que `CLIENT_URL` sur Render correspond EXACTEMENT à l'URL Vercel

### Problème : "Spotify disconnected"

**Symptôme** : `spotify: "disconnected"` dans `/api/health`

**Causes possibles** :
1. Credentials invalides
2. Credentials non régénérés après exposition
3. Problème réseau temporaire

**Solution** : Régénérer et mettre à jour les credentials

### Problème : "Cannot create game"

**Symptôme** : Erreur lors de création de partie

**Diagnostic** :
1. Vérifier logs Render (Dashboard → Logs)
2. Vérifier console navigateur (F12)
3. Tester l'endpoint : `/api/health`

---

## 📊 Checklist de Déploiement

### Backend (Render)
- [ ] Service créé et déployé
- [ ] Variables d'environnement configurées
- [ ] Credentials Spotify régénérés et mis à jour
- [ ] `CLIENT_URL` correspond à l'URL Vercel
- [ ] `/api/health` retourne `status: "ok"`
- [ ] Spotify connecté (`spotify: "connected"`)

### Frontend (Vercel)
- [ ] Variable `NEXT_PUBLIC_SOCKET_URL` configurée
- [ ] URL pointe vers Render (pas localhost)
- [ ] Application redéployée
- [ ] Console affiche connexion Socket.IO réussie
- [ ] Création de partie fonctionne

### Tests
- [ ] Créer une partie ✅
- [ ] Rejoindre une partie ✅
- [ ] Charger une playlist Spotify ✅
- [ ] Démarrer un round ✅
- [ ] Buzzer fonctionne ✅
- [ ] Scores s'actualisent ✅

---

## 🎯 URLs Finales

Une fois déployé, vos URLs seront :

```
Frontend:  https://blindtest-frontend.vercel.app
Backend:   https://blindtest-backend-XXXX.onrender.com
API Docs:  https://blindtest-backend-XXXX.onrender.com/
Health:    https://blindtest-backend-XXXX.onrender.com/api/health
```

---

## 💡 Conseils de Production

### Performance
- Render gratuit : Cold start ~30s
- Prévoir un message de chargement
- Considérer Render payant pour usage intensif

### Monitoring
- Consulter logs Render régulièrement
- Surveiller `/api/metrics` pour statistiques
- Vérifier quota Spotify (180 req/min)

### Sécurité
- ✅ `.env` dans `.gitignore`
- ✅ Credentials régénérés
- ✅ CORS configuré correctement
- ✅ Rate limiting actif

---

## 📞 Support

En cas de problème :
1. Consulter les logs Render
2. Vérifier console navigateur (F12)
3. Tester `/api/health`
4. Vérifier que les URLs correspondent

**Logs Render** : Dashboard → Service → Logs
**Logs Vercel** : Dashboard → Project → Logs

---

**Date de création** : 17/11/2025
**Version Backend** : 2.0.0
**Version Frontend** : 1.0.0
