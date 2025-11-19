# 🎵 Guide de Gestion des Playlists - BlindTest

Documentation complète pour gérer vos playlists musicales hébergées sur Cloudflare R2.

---

## 📋 Table des matières

1. [Interface Web de Gestion](#interface-web)
2. [Endpoints API](#endpoints-api)
3. [Workflow Complet](#workflow)
4. [Exemples d'Utilisation](#exemples)
5. [Troubleshooting](#troubleshooting)

---

## 🌐 Interface Web de Gestion {#interface-web}

### Accès

L'interface de gestion est accessible directement depuis votre navigateur:

```
https://blindtest-server.onrender.com/playlist-manager.html
```

### Fonctionnalités

L'interface vous permet de:

- ✅ **Voir tous vos dossiers R2** (compilations thématiques)
- ✅ **Créer une playlist** depuis un dossier en 1 clic
- ✅ **Lister toutes vos playlists** créées
- ✅ **Copier l'ID** d'une playlist pour l'utiliser dans le jeu
- ✅ **Voir les détails** d'une playlist (liste des tracks)
- ✅ **Supprimer** une playlist
- ✅ **Statistiques** en temps réel (nombre de dossiers, playlists, tracks)

### Utilisation

1. **Ouvrir l'interface** dans votre navigateur
2. **Cliquer sur un dossier** thématique
3. **Cliquer sur "Créer une playlist"**
4. **Entrer le nom** de la playlist (ou garder le nom du dossier)
5. **Copier l'ID** de la playlist créée
6. **Utiliser cet ID** dans votre jeu BlindTest

---

## 🔌 Endpoints API {#endpoints-api}

### Base URL

```
https://blindtest-server.onrender.com/api/music
```

---

### 📁 Gestion des Dossiers R2

#### Lister tous les dossiers

```http
GET /api/music/folders
```

**Réponse:**
```json
{
  "success": true,
  "count": 3,
  "folders": [
    {
      "name": "Blind Test Disney",
      "path": "Blind Test Disney/"
    },
    {
      "name": "Blind Test Rock 80s",
      "path": "Blind Test Rock 80s/"
    },
    {
      "name": "Blind Test Années 90",
      "path": "Blind Test Années 90/"
    }
  ]
}
```

#### Lister les tracks d'un dossier

```http
GET /api/music/tracks?folder=Blind%20Test%20Disney
```

**Paramètres:**
- `folder` (optionnel) - Nom du dossier à filtrer

**Réponse:**
```json
{
  "success": true,
  "count": 62,
  "folder": "Blind Test Disney",
  "tracks": [
    {
      "id": "hakuna-matata",
      "fileName": "Hakuna Matata.mp3",
      "s3Key": "Blind Test Disney/Hakuna Matata.mp3",
      "url": "https://blindtest-music.r2.dev/..."
    },
    ...
  ]
}
```

---

### 🎼 Gestion des Playlists

#### Créer une playlist depuis un dossier (GET - facile)

```http
GET /api/music/generate-playlist?folder=Blind%20Test%20Disney&name=Disney%20Magic
```

**Paramètres:**
- `folder` (obligatoire) - Nom exact du dossier R2
- `name` (optionnel) - Nom de la playlist (défaut: nom du dossier)
- `desc` (optionnel) - Description de la playlist

**Réponse:**
```json
{
  "success": true,
  "playlist": {
    "id": "ab04c62031e8298ad3e3023858224480",
    "name": "Disney Magic",
    "description": "Playlist auto-générée...",
    "totalTracks": 62
  },
  "message": "✅ Playlist \"Disney Magic\" créée avec 62 tracks!",
  "usage": "Utilise cet ID dans ton jeu: ab04c62031e8298ad3e3023858224480"
}
```

**Utilisation dans le navigateur:**
```
https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Disney&name=Disney%20Magic
```

---

#### Créer une playlist depuis un dossier (POST - avancé)

```http
POST /api/music/playlist/from-folder
Content-Type: application/json

{
  "folderName": "Blind Test Disney",
  "playlistName": "Disney Magic",
  "description": "Les plus grands classiques Disney"
}
```

**Body:**
- `folderName` (obligatoire) - Nom du dossier R2
- `playlistName` (optionnel) - Nom de la playlist
- `description` (optionnel) - Description

**Réponse:** Identique à la version GET

---

#### Lister toutes les playlists

```http
GET /api/music/playlists
```

**Réponse:**
```json
{
  "success": true,
  "count": 2,
  "playlists": [
    {
      "id": "ab04c62031e8298ad3e3023858224480",
      "name": "Disney Magic",
      "description": "Playlist auto-générée...",
      "totalTracks": 62,
      "createdAt": "2025-11-19T15:30:00.000Z"
    },
    {
      "id": "cd12e34f56a7890bc1d2e3f4a5b6c7d8",
      "name": "Rock 80s",
      "description": "Les meilleurs rocks des années 80",
      "totalTracks": 45,
      "createdAt": "2025-11-19T16:00:00.000Z"
    }
  ]
}
```

---

#### Voir les détails d'une playlist

```http
GET /api/music/playlist/ab04c62031e8298ad3e3023858224480
```

**Réponse:**
```json
{
  "success": true,
  "playlist": {
    "id": "ab04c62031e8298ad3e3023858224480",
    "name": "Disney Magic",
    "description": "Playlist auto-générée...",
    "totalTracks": 62,
    "usableTracks": 62,
    "tracks": [
      {
        "id": "hakuna-matata",
        "name": "Hakuna Matata",
        "artists": [{ "name": "Unknown Artist" }],
        "album": { "name": "Blind Test Disney" },
        "preview_url": "https://blindtest-music.r2.dev/...",
        "duration_ms": 180000
      },
      ...
    ],
    "createdAt": "2025-11-19T15:30:00.000Z"
  }
}
```

---

#### Supprimer une playlist

```http
DELETE /api/music/playlist/ab04c62031e8298ad3e3023858224480
```

**Réponse:**
```json
{
  "success": true,
  "message": "Playlist deleted successfully"
}
```

**Note:** Pour supprimer depuis le navigateur, utilisez l'interface web.

---

### ⚙️ Configuration

#### Vérifier le statut R2

```http
GET /api/music/status
```

**Réponse:**
```json
{
  "success": true,
  "configured": true,
  "message": "R2 is properly configured"
}
```

---

## 🔄 Workflow Complet {#workflow}

### Étape 1: Organiser vos fichiers sur R2

1. **Connectez-vous** à Cloudflare Dashboard
2. **Accédez** à R2 → Bucket `blindtest-music`
3. **Créez des dossiers thématiques:**
   ```
   blindtest-music/
   ├── Blind Test Disney/
   │   ├── Le Roi Lion - Hakuna Matata.mp3
   │   ├── La Reine des Neiges - Libérée Délivrée.mp3
   │   └── ...
   ├── Blind Test Rock 80s/
   │   ├── Bon Jovi - Livin On A Prayer.mp3
   │   ├── Queen - We Will Rock You.mp3
   │   └── ...
   └── Blind Test Années 90/
       ├── Backstreet Boys - I Want It That Way.mp3
       └── ...
   ```

4. **Uploadez vos MP3** dans chaque dossier thématique

---

### Étape 2: Créer des playlists

**Option A: Via l'interface web (recommandé)**

1. Ouvrez `https://blindtest-server.onrender.com/playlist-manager.html`
2. Cliquez sur le dossier souhaité
3. Cliquez sur "Créer une playlist"
4. Entrez le nom (ou gardez celui du dossier)
5. Copier l'ID de la playlist créée

**Option B: Via URL directe**

```
https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Disney&name=Disney%20Magic
```

**Option C: Via cURL (terminal)**

```bash
curl "https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Disney&name=Disney%20Magic"
```

---

### Étape 3: Utiliser la playlist dans le jeu

1. **Copiez l'ID** de la playlist (ex: `ab04c62031e8298ad3e3023858224480`)
2. **Dans votre frontend BlindTest**, utilisez cet ID exactement comme un ID Spotify
3. **Le backend détecte automatiquement** qu'il s'agit d'une playlist R2 (32 caractères hexadécimaux)
4. **Les tracks sont chargées** depuis Cloudflare R2

**Exemple dans le frontend:**
```javascript
// Anciennement avec Spotify
const playlistId = "37i9dQZF1DXcBWIGoYBM5M"; // Spotify

// Maintenant avec R2 (fonctionne exactement pareil!)
const playlistId = "ab04c62031e8298ad3e3023858224480"; // R2

// Le code reste identique
socket.emit('load_playlist', { roomCode, playlistId });
```

---

### Étape 4: Gérer vos playlists

**Lister toutes vos playlists:**
```
https://blindtest-server.onrender.com/api/music/playlists
```

**Voir les détails:**
```
https://blindtest-server.onrender.com/api/music/playlist/ab04c62031e8298ad3e3023858224480
```

**Supprimer une playlist:**
- Via l'interface web: Cliquez sur "Supprimer"
- Ou via DELETE request sur `/api/music/playlist/:id`

---

## 💡 Exemples d'Utilisation {#exemples}

### Exemple 1: Créer une compilation Disney

**1. Uploadez vos fichiers sur R2:**
```
blindtest-music/Blind Test Disney/
├── 01 - Le Roi Lion - Hakuna Matata.mp3
├── 02 - Aladdin - Ce rêve bleu.mp3
├── 03 - La Belle et la Bête - Histoire éternelle.mp3
└── ...
```

**2. Créez la playlist:**
```
https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Disney&name=Disney%20Classics
```

**3. Copiez l'ID retourné:**
```json
{
  "playlist": {
    "id": "1a2b3c4d5e6f7890abcdef1234567890"
  }
}
```

**4. Utilisez dans le jeu:**
```javascript
socket.emit('load_playlist', {
  roomCode: 'ABC123',
  playlistId: '1a2b3c4d5e6f7890abcdef1234567890'
});
```

---

### Exemple 2: Gérer plusieurs compilations

**Créer plusieurs playlists thématiques:**

```bash
# Rock 80s
curl "https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Rock%2080s&name=Rock%2080s%20Hits"

# Années 90
curl "https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Ann%C3%A9es%2090&name=Tubes%2090s"

# Rap Français
curl "https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Rap%20FR&name=Rap%20Fran%C3%A7ais"
```

**Lister toutes les playlists:**
```bash
curl "https://blindtest-server.onrender.com/api/music/playlists"
```

**Résultat:**
```json
{
  "success": true,
  "count": 3,
  "playlists": [
    { "id": "...", "name": "Rock 80s Hits", "totalTracks": 45 },
    { "id": "...", "name": "Tubes 90s", "totalTracks": 52 },
    { "id": "...", "name": "Rap Français", "totalTracks": 38 }
  ]
}
```

---

### Exemple 3: Script d'automatisation

**Script Bash pour créer toutes vos playlists:**

```bash
#!/bin/bash

# Liste des dossiers à transformer en playlists
folders=(
  "Blind Test Disney"
  "Blind Test Rock 80s"
  "Blind Test Années 90"
  "Blind Test Rap FR"
  "Blind Test Films"
  "Blind Test Séries TV"
)

# Créer une playlist pour chaque dossier
for folder in "${folders[@]}"; do
  echo "Creating playlist for: $folder"

  # URL encode le nom du dossier
  encoded_folder=$(printf %s "$folder" | jq -sRr @uri)

  # Créer la playlist
  curl "https://blindtest-server.onrender.com/api/music/generate-playlist?folder=$encoded_folder&name=$folder"

  echo ""
  echo "---"
done

# Lister toutes les playlists créées
echo "All playlists:"
curl "https://blindtest-server.onrender.com/api/music/playlists"
```

**Exécuter:**
```bash
chmod +x create-playlists.sh
./create-playlists.sh
```

---

## 🐛 Troubleshooting {#troubleshooting}

### Problème: Playlist non trouvée dans le jeu

**Symptôme:**
```
Error: Playlist not found: ab04c62031e8298ad3e3023858224480
```

**Solution:**
1. Vérifiez que la playlist existe:
   ```
   https://blindtest-server.onrender.com/api/music/playlist/ab04c62031e8298ad3e3023858224480
   ```
2. Si elle n'existe pas, recréez-la depuis l'interface web

**Note:** Les playlists sont stockées **en mémoire** (RAM). Si le serveur redémarre, les playlists sont perdues. Recréez-les simplement via l'interface.

---

### Problème: Aucun dossier affiché

**Symptôme:**
L'interface web affiche "Aucun dossier trouvé sur R2"

**Solution:**
1. Vérifiez les variables d'environnement R2 sur Render:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET_NAME`

2. Vérifiez le statut de la configuration:
   ```
   https://blindtest-server.onrender.com/api/music/status
   ```

3. Vérifiez que des fichiers existent sur R2 (Cloudflare Dashboard)

---

### Problème: Tracks ne jouent pas dans le jeu

**Symptôme:**
La playlist se charge mais les tracks ne jouent pas

**Solution:**

**Option 1: Utiliser un domaine public R2 (recommandé)**

1. Dans Cloudflare R2, activez le domaine public pour votre bucket
2. Ajoutez la variable d'environnement sur Render:
   ```
   CLOUDFLARE_R2_PUBLIC_DOMAIN=blindtest-music.r2.dev
   ```
3. Redémarrez le serveur

**Option 2: Vérifier les URLs signées**

Si vous n'utilisez pas de domaine public, les URLs sont signées et expirent après 1 heure. Assurez-vous que:
- Le jeu commence dans l'heure suivant la création de la playlist
- Les clés R2 ont les bonnes permissions (Read Object)

---

### Problème: "Missing required parameter: folder"

**Symptôme:**
```json
{
  "success": false,
  "error": "Missing required parameter: folder"
}
```

**Solution:**
Assurez-vous de bien passer le paramètre `folder` dans l'URL:
```
✅ Correct:
https://blindtest-server.onrender.com/api/music/generate-playlist?folder=Blind%20Test%20Disney

❌ Incorrect:
https://blindtest-server.onrender.com/api/music/generate-playlist
```

**Note:** N'oubliez pas d'encoder les espaces avec `%20`

---

### Problème: Playlists perdues après redémarrage

**Symptôme:**
Après un redémarrage du serveur Render, toutes les playlists ont disparu

**Explication:**
C'est **normal**! Les playlists sont stockées en mémoire (RAM) dans le code actuel.

**Solutions:**

**Solution immédiate:**
Recréez vos playlists via l'interface web (c'est rapide, 1 clic par dossier)

**Solution à long terme (migration future vers base de données):**
Pour persister les playlists entre les redémarrages, il faudrait:
1. Ajouter MongoDB ou PostgreSQL
2. Stocker les playlists en base de données
3. Les charger au démarrage du serveur

Pour l'instant, recréer les playlists après chaque redémarrage est la solution la plus simple (Render ne redémarre que lors des déploiements).

---

## 📊 Récapitulatif des URLs Importantes

| Action | URL |
|--------|-----|
| **Interface de gestion** | `https://blindtest-server.onrender.com/playlist-manager.html` |
| **Lister les dossiers** | `https://blindtest-server.onrender.com/api/music/folders` |
| **Lister les playlists** | `https://blindtest-server.onrender.com/api/music/playlists` |
| **Créer une playlist** | `https://blindtest-server.onrender.com/api/music/generate-playlist?folder=XXX&name=YYY` |
| **Voir une playlist** | `https://blindtest-server.onrender.com/api/music/playlist/:id` |
| **Vérifier le statut** | `https://blindtest-server.onrender.com/api/music/status` |

---

## 🎯 Workflow Recommandé pour la Production

### Démarrage d'une session de jeu:

1. **Ouvrir l'interface de gestion** sur un deuxième écran/onglet
2. **Recréer les playlists** si nécessaire (après redémarrage serveur)
3. **Copier les IDs** des playlists à utiliser
4. **Lancer le jeu** avec ces IDs

### Organisation des dossiers R2:

```
blindtest-music/
├── Thèmes/
│   ├── Blind Test Disney/
│   ├── Blind Test Marvel/
│   └── Blind Test Séries TV/
├── Genres/
│   ├── Blind Test Rock/
│   ├── Blind Test Rap FR/
│   └── Blind Test Pop/
└── Époques/
    ├── Blind Test Années 80/
    ├── Blind Test Années 90/
    └── Blind Test Années 2000/
```

**Conseil:** Nommez vos dossiers avec le préfixe "Blind Test" pour les identifier facilement!

---

## 🚀 Avantages de cette Solution

✅ **100% gratuit** - 10GB R2 + bande passante illimitée
✅ **Pas de limite de durée** - Fichiers complets (pas de preview 30s)
✅ **Contrôle total** - Vos propres compilations
✅ **Organisation thématique** - Dossiers illimités
✅ **Pas de dépendance externe** - Plus de soucis avec Spotify/Deezer
✅ **URLs permanentes** - Avec domaine public R2
✅ **Interface simple** - Gestion en 1 clic

---

**Documentation créée le:** 2025-11-19
**Version:** 1.0
**Auteur:** BlindTest Backend Team
