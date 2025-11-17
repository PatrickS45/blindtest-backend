# 🔧 Guide de Dépannage - Blindtest

## 🔴 Erreur: WebSocket Connection Failed

### Symptôme
```
WebSocket connection to 'wss://blindtest-backend-cfbp.onrender.com/socket.io/' failed
❌ Socket connection error: websocket error
```

---

## 🎯 Solution Immédiate

### 1. Réveiller le Backend (Cold Start)

**Cause** : Render gratuit met le service en veille après 15 minutes d'inactivité.

**Solution** :
1. Ouvrir dans un nouvel onglet : https://blindtest-backend-cfbp.onrender.com/api/health
2. **Attendre 30-60 secondes** (première connexion)
3. Vous devriez voir :
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
4. Une fois chargé, **rafraîchir votre frontend**
5. La connexion devrait marcher ✅

---

## 🐛 Diagnostic Approfondi

### Vérifier la Configuration Render

**Dashboard Render** → Service `blindtest-backend` → **Environment**

Variables requises :

| Variable | Valeur | Importance |
|----------|--------|-----------|
| `SPOTIFY_CLIENT_ID` | Votre Client ID | ⚠️ Critique |
| `SPOTIFY_CLIENT_SECRET` | Votre Secret | ⚠️ Critique |
| `CLIENT_URL` | `https://votre-frontend.vercel.app` | ⚠️ DOIT être exact |
| `NODE_ENV` | `production` | Important |
| `PORT` | `3001` | Important |
| `LOG_LEVEL` | `info` | Optionnel |

**⚠️ IMPORTANT** : `CLIENT_URL` doit correspondre **EXACTEMENT** à l'URL de votre frontend Vercel (sans slash final).

---

### Consulter les Logs Render

**Dashboard Render** → Service → **Logs** (en bas de page)

#### Erreurs courantes :

**1. Spotify Authentication Failed**
```
❌ Spotify authentication failed
error: Invalid client
```

**Solution** :
- Vérifier `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET`
- Régénérer les credentials sur https://developer.spotify.com/dashboard
- Mettre à jour sur Render → Save → Service redémarre

**2. CORS Error**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution** :
- Vérifier que `CLIENT_URL` sur Render = URL frontend exacte
- Format : `https://blindtest-frontend.vercel.app` (sans slash final)

**3. Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution** :
- Redéployer le service (Dashboard → Manual Deploy → Deploy)

**4. Module Not Found**
```
Error: Cannot find module 'express'
```

**Solution** :
- Vérifier Build Command : `npm install`
- Redéployer

---

## 🔄 Problème : Backend "Endormi"

### Symptômes
- Première connexion très lente (30-60s)
- Timeout
- WebSocket fail immédiatement après

### Cause
Render gratuit met en veille après 15 minutes d'inactivité.

### Solutions

#### Solution A : Ping Automatique (Recommandé)

Ajouter dans le frontend un ping toutes les 10 minutes :

```typescript
// src/utils/keepBackendAlive.ts
export function keepBackendAlive(backendUrl: string) {
  setInterval(async () => {
    try {
      await fetch(`${backendUrl}/api/health`, { method: 'HEAD' });
      console.log('🔄 Backend ping: OK');
    } catch (error) {
      console.warn('⚠️ Backend ping failed:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes
}

// Dans votre composant principal
useEffect(() => {
  keepBackendAlive(process.env.NEXT_PUBLIC_SOCKET_URL);
}, []);
```

#### Solution B : Message de Chargement

Informer l'utilisateur du cold start :

```typescript
const [isWakingUp, setIsWakingUp] = useState(false);

useEffect(() => {
  if (!socket.connected) {
    setIsWakingUp(true);
    setTimeout(() => setIsWakingUp(false), 60000); // 1 min max
  }
}, [socket.connected]);

// Dans le JSX
{isWakingUp && (
  <div className="loading-message">
    🔄 Démarrage du serveur... (30-60 secondes)
  </div>
)}
```

#### Solution C : Render Payant

Upgrade vers Render payant ($7/mois) :
- ✅ Pas de veille
- ✅ Démarrage instantané
- ✅ Meilleure performance

---

## 🔐 Problème : Spotify Déconnecté

### Symptôme
```json
{
  "status": "degraded",
  "spotify": "disconnected"
}
```

### Causes & Solutions

**1. Credentials Invalides**

Vérifier sur https://developer.spotify.com/dashboard :
- Client ID correct
- Client Secret correct
- Credentials pas expirés/révoqués

**2. Credentials Exposés**

Vos credentials ont été exposés sur GitHub !

**Actions URGENTES** :
1. Dashboard Spotify → Settings → **RESET CLIENT SECRET**
2. Copier les nouveaux credentials
3. Mettre à jour sur Render
4. Service redémarre automatiquement

**3. Rate Limit Dépassé**

Spotify limite à 180 requêtes/minute.

**Solution** :
- Le cache est déjà implémenté
- Éviter de recharger la page en boucle
- Attendre quelques minutes

---

## 🌐 Problème : CORS Blocked

### Symptôme
```
Access-Control-Allow-Origin header is absent
Cross-Origin Request Blocked
```

### Diagnostic

**Vérifier CLIENT_URL sur Render** :

✅ Correct : `https://blindtest-frontend.vercel.app`
❌ Incorrect : `https://blindtest-frontend.vercel.app/` (slash final)
❌ Incorrect : `http://blindtest-frontend.vercel.app` (http au lieu de https)
❌ Incorrect : `localhost:3000` (si frontend en prod)

### Solution

1. Dashboard Render → Environment
2. Modifier `CLIENT_URL` avec l'URL **exacte**
3. Save → Service redémarre

---

## 📱 Problème : Manifest 404

### Symptôme
```
Failed to load manifest.json: 404
```

### Cause
Fichier `manifest.json` manquant dans le frontend (PWA).

### Solution

Créer `public/manifest.json` dans le frontend :

```json
{
  "name": "Blindtest Buzz",
  "short_name": "Blindtest",
  "description": "Jeu de blind test musical multi-modes",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Note** : Cette erreur n'empêche PAS le fonctionnement de l'app.

---

## 🧪 Tests de Diagnostic

### Test 1 : Backend Accessible

```bash
curl https://blindtest-backend-cfbp.onrender.com/api/health
```

**Attendu** :
```json
{
  "status": "ok",
  "spotify": "connected"
}
```

### Test 2 : WebSocket Direct

Ouvrir la console navigateur sur votre frontend et taper :

```javascript
const socket = io('https://blindtest-backend-cfbp.onrender.com');

socket.on('connect', () => console.log('✅ Connected!'));
socket.on('connect_error', (err) => console.error('❌ Error:', err));
```

### Test 3 : Créer une Partie

```javascript
socket.emit('create_game', { mode: 'accumul_points' }, (response) => {
  console.log('Response:', response);
});
```

**Attendu** :
```json
{
  "success": true,
  "roomCode": "ABCD",
  "mode": "accumul_points"
}
```

---

## 📊 Checklist Complète

### Backend (Render)
- [ ] Service déployé et actif
- [ ] Health check retourne `status: "ok"`
- [ ] Spotify connecté (`spotify: "connected"`)
- [ ] Variables d'environnement correctes
- [ ] CLIENT_URL = URL frontend exacte
- [ ] Logs sans erreur critique

### Frontend (Vercel)
- [ ] `NEXT_PUBLIC_SOCKET_URL` configurée
- [ ] Pointe vers Render (pas localhost)
- [ ] Redéployé après config
- [ ] Console affiche connexion Socket.IO
- [ ] Pas d'erreur CORS

### Tests Fonctionnels
- [ ] Backend accessible (/api/health)
- [ ] WebSocket se connecte
- [ ] Créer partie fonctionne
- [ ] Charger playlist fonctionne
- [ ] Démarrer round fonctionne

---

## 💡 Optimisations

### Performance

**1. Préchargement**
```typescript
// Précharger le backend au chargement de la page
useEffect(() => {
  fetch(`${SOCKET_URL}/api/health`, { method: 'HEAD' });
}, []);
```

**2. Retry Logic**
```typescript
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 10000,
});
```

**3. État de Connexion**
```typescript
const [connectionStatus, setConnectionStatus] = useState<
  'connecting' | 'connected' | 'disconnected' | 'error'
>('connecting');

socket.on('connect', () => setConnectionStatus('connected'));
socket.on('disconnect', () => setConnectionStatus('disconnected'));
socket.on('connect_error', () => setConnectionStatus('error'));
```

### Monitoring

**Logs Backend** : Dashboard Render → Logs
**Logs Frontend** : Console navigateur (F12)
**Métriques** : `https://blindtest-backend-cfbp.onrender.com/api/metrics`

---

## 📞 Support

### Si le problème persiste :

1. **Vérifier** :
   - [ ] Backend réveillé (/api/health charge)
   - [ ] CLIENT_URL correcte sur Render
   - [ ] NEXT_PUBLIC_SOCKET_URL correcte sur Vercel
   - [ ] Credentials Spotify valides

2. **Logs** :
   - Consulter logs Render (Dashboard → Service → Logs)
   - Console navigateur (F12)

3. **Redéployer** :
   - Backend : Dashboard Render → Manual Deploy
   - Frontend : Dashboard Vercel → Redeploy

---

**Dernière mise à jour** : 17/11/2025
**Version Backend** : 2.0.0
**Render URL** : https://blindtest-backend-cfbp.onrender.com
