# 🔐 OAuth Spotify Setup Guide

## ✅ Backend Implementation Complete!

L'implémentation OAuth est **100% terminée** côté backend. Voici comment tout configurer.

---

## 📋 **Étape 1 : Configurer l'Application Spotify**

### 1.1 Aller sur le Spotify Dashboard
👉 https://developer.spotify.com/dashboard

### 1.2 Sélectionner Votre Application
Cliquez sur votre application existante (celle avec votre Client ID)

### 1.3 Cliquer sur "Edit Settings"

### 1.4 Ajouter les Redirect URIs
Dans la section **Redirect URIs**, ajoutez :

**Pour le Développement Local** :
```
http://localhost:3001/api/auth/callback
```

**Pour la Production (Render)** :
```
https://blindtest-backend-cfbp.onrender.com/api/auth/callback
```

### 1.5 Sauvegarder
Cliquez sur **"Save"** en bas de la page.

---

## ⚙️ **Étape 2 : Configurer les Variables d'Environnement**

### 2.1 Sur Render.com
1. Allez dans votre service `blindtest-backend`
2. Allez dans **Environment**
3. Ajoutez cette variable :

```
SPOTIFY_REDIRECT_URI=https://blindtest-backend-cfbp.onrender.com/api/auth/callback
```

4. **Sauvegardez** (le service redémarrera automatiquement)

### 2.2 En Local (fichier `.env`)
```bash
SPOTIFY_CLIENT_ID=votre_client_id
SPOTIFY_CLIENT_SECRET=votre_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/auth/callback
CLIENT_URL=http://localhost:3000
```

---

## 🚀 **Étape 3 : Tester l'OAuth**

### 3.1 Vérifier que le Backend est Déployé
Attendez que Render redémarre (1-2 min)

### 3.2 Tester l'URL d'Autorisation
Ouvrez dans votre navigateur :
```
https://blindtest-backend-cfbp.onrender.com/api/auth/spotify
```

Vous devriez voir :
```json
{
  "authUrl": "https://accounts.spotify.com/authorize?...",
  "message": "Redirect user to this URL"
}
```

### 3.3 Tester le Flow Complet
1. Copiez l'URL dans `authUrl`
2. Collez-la dans votre navigateur
3. Connectez-vous avec Spotify
4. Autorisez l'application
5. Vous serez redirigé vers votre frontend

### 3.4 Vérifier le Statut
```
GET https://blindtest-backend-cfbp.onrender.com/api/auth/status
```

**Avant authentification** :
```json
{
  "authenticated": false,
  "expiresAt": null,
  "expiresIn": null
}
```

**Après authentification** :
```json
{
  "authenticated": true,
  "expiresAt": 1700000000000,
  "expiresIn": 3600
}
```

---

## 💻 **Étape 4 : Intégration Frontend**

### 4.1 Créer un Bouton "Se Connecter avec Spotify"

```jsx
// src/components/SpotifyAuth.jsx
import { useState, useEffect } from 'react';

export function SpotifyAuth() {
  const [authStatus, setAuthStatus] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    const res = await fetch('https://blindtest-backend-cfbp.onrender.com/api/auth/status');
    const data = await res.json();
    setAuthStatus(data);
  }

  async function handleConnect() {
    const res = await fetch('https://blindtest-backend-cfbp.onrender.com/api/auth/spotify');
    const data = await res.json();

    // Rediriger vers Spotify OAuth
    window.location.href = data.authUrl;
  }

  return (
    <div>
      {authStatus?.authenticated ? (
        <div>✅ Connecté à Spotify</div>
      ) : (
        <button onClick={handleConnect}>
          🎵 Se connecter avec Spotify
        </button>
      )}
    </div>
  );
}
```

### 4.2 Créer une Page de Callback

```jsx
// src/pages/AuthSuccess.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function AuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    // Attendre 2 secondes puis rediriger
    setTimeout(() => {
      navigate('/');
    }, 2000);
  }, []);

  return (
    <div>
      <h1>✅ Authentification réussie !</h1>
      <p>Vous pouvez maintenant charger toutes les playlists Spotify.</p>
      <p>Redirection automatique...</p>
    </div>
  );
}
```

### 4.3 Ajouter la Route dans le Router

```jsx
// src/App.jsx
import { AuthSuccess } from './pages/AuthSuccess';

<Route path="/auth/success" element={<AuthSuccess />} />
```

---

## 🎯 **Étape 5 : Utilisation**

Une fois l'utilisateur authentifié :

1. **Il peut charger N'IMPORTE QUELLE playlist** :
   ```
   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
   ```

2. **Le backend utilise automatiquement le user token** :
   ```
   Using user token: YES ✅
   Attempt 1: Trying /playlists/{id} endpoint...
   ✅ Success with /playlists/{id}
   ✅ Playlist data obtained!
   Playlist name: Today's Top Hits
   Total tracks: 50
   ```

3. **Pas besoin de modification côté chargement** :
   - L'utilisateur colle l'URL comme avant
   - Ça fonctionne maintenant grâce à OAuth

---

## 🔄 **Refresh Automatique du Token**

Le backend **renouvelle automatiquement** le token :
- Refresh à 90% de la durée de vie (54 min sur 60 min)
- Pas besoin de re-authentification manuelle
- Transparent pour l'utilisateur

---

## 🐛 **Troubleshooting**

### "Redirect URI Mismatch"
➡️ Vérifiez que l'URL dans Spotify Dashboard correspond EXACTEMENT à `SPOTIFY_REDIRECT_URI`

### "Authentication keeps failing"
➡️ Vérifiez les logs Render pour voir l'erreur exacte

### "Playlist still returns 404"
➡️ Vérifiez `/api/auth/status` - si `authenticated: false`, l'utilisateur doit se reconnecter

---

## 📊 **Endpoints Disponibles**

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/spotify` | GET | Obtenir l'URL d'autorisation |
| `/api/auth/callback` | GET | Callback OAuth (ne pas appeler directement) |
| `/api/auth/status` | GET | Vérifier si l'utilisateur est authentifié |
| `/api/auth/logout` | POST | Déconnecter l'utilisateur |

---

## ✅ **Checklist Finale**

- [ ] Redirect URI ajouté dans Spotify Dashboard
- [ ] `SPOTIFY_REDIRECT_URI` configuré sur Render
- [ ] Backend redéployé et démarré
- [ ] Endpoint `/api/auth/spotify` retourne une URL
- [ ] Flow OAuth testé manuellement
- [ ] Frontend intégré avec bouton de connexion
- [ ] Page `/auth/success` créée
- [ ] Test end-to-end : connexion → chargement playlist

---

## 🎉 **Résultat Final**

**Avant OAuth** :
```
❌ GET /playlists/{id} → 404 Resource not found
```

**Après OAuth** :
```
✅ GET /playlists/{id} → 200 OK
{
  "name": "Today's Top Hits",
  "tracks": [...]
}
```

**L'utilisateur peut maintenant charger TOUTES les playlists Spotify !** 🎵
