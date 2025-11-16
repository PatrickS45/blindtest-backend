# Guide de Configuration Frontend/Backend

## Problème Actuel
Ton frontend sur Vercel essaie de se connecter à `localhost:3001` qui n'existe pas depuis Vercel.

## Solution

### 1. Dans ton code Frontend

Trouve où tu initialises Socket.IO (cherche `io(` ou `socket.io-client`)

**Avant (mauvais) :**
```javascript
const socket = io('http://localhost:3001');
```

**Après (bon) :**
```javascript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);
```

### 2. Sur Vercel (Variables d'environnement)

Dans ton projet Vercel :
1. Va dans Settings → Environment Variables
2. Ajoute cette variable :
   - **Name:** `NEXT_PUBLIC_BACKEND_URL`
   - **Value:** `https://blindtest-backend-cfbp.onrender.com`
   - **Environment:** Production

(Si tu utilises Create React App, utilise `REACT_APP_BACKEND_URL`)
(Si tu utilises Vite, utilise `VITE_BACKEND_URL`)

### 3. Sur Render (Backend)

Dans ton service Render, ajoute ces variables d'environnement :
1. Va dans Environment
2. Ajoute :
   - `SERVER_URL=https://blindtest-backend-cfbp.onrender.com`
   - `CLIENT_URL=https://blindtest-frontend.vercel.app`

### 4. Redéploie

- Redéploie ton frontend sur Vercel (ou attends le prochain déploiement)
- Le backend se redéploiera automatiquement quand tu push les changements

## Test Local (optionnel)

Si tu veux tester en local :
1. Lance le backend : `cd blindtest-backend && npm start`
2. Le backend tournera sur http://localhost:3001
3. Ton frontend local se connectera automatiquement (fallback)

## Fichiers à Chercher dans ton Frontend

- `pages/_app.js` ou `app/layout.js` (Next.js)
- `src/App.js` (Create React App)
- `src/main.jsx` ou `src/App.jsx` (Vite)
- `src/socket.js` ou `src/config/socket.js` (fichier de config)
- Cherche "localhost:3001" dans tous les fichiers

## Vérification

Une fois configuré, ouvre la console de ton navigateur sur Vercel et tu devrais voir :
```
Socket.IO connected to https://blindtest-backend-cfbp.onrender.com
```

Au lieu de :
```
ERR_CONNECTION_REFUSED localhost:3001
```
