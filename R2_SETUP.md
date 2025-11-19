# Configuration Cloudflare R2 - Musiques Personnalisées

Ce guide explique comment configurer Cloudflare R2 pour héberger vos propres fichiers MP3 et créer des playlists personnalisées.

## 📋 Table des matières

1. [Pourquoi R2?](#pourquoi-r2)
2. [Configuration Cloudflare](#configuration-cloudflare)
3. [Variables d'environnement](#variables-denvironnement)
4. [Upload de musiques](#upload-de-musiques)
5. [Création de playlists](#création-de-playlists)
6. [Utilisation dans le jeu](#utilisation-dans-le-jeu)

---

## 🎯 Pourquoi R2?

**Avantages:**
- ✅ **100% gratuit** jusqu'à 10GB de stockage
- ✅ **10 millions de lectures/mois** gratuites
- ✅ **0€ de bande passante** (même si très utilisé)
- ✅ **CDN mondial** ultra rapide (Cloudflare)
- ✅ **Contrôle total** sur vos musiques
- ✅ **Pas de limitations API** (contrairement à Spotify/Deezer)

**Capacité réelle:**
- 10GB = environ **2000-2500 chansons MP3** (moyenne 4MB/chanson)
- Ou **500-700 chansons haute qualité** (moyenne 15MB)

---

## 🛠️ Configuration Cloudflare

### Étape 1: Créer un compte Cloudflare (gratuit)

1. Allez sur https://dash.cloudflare.com/sign-up
2. Créez un compte gratuit (pas de carte bancaire requise)
3. Vérifiez votre email

### Étape 2: Activer R2

1. Connectez-vous au dashboard Cloudflare
2. Dans le menu de gauche, cliquez sur **R2**
3. Cliquez sur **Get Started** (ou **Enable R2**)
4. Acceptez les conditions

### Étape 3: Créer un bucket

1. Cliquez sur **Create bucket**
2. Nom du bucket: `blindtest-music` (ou autre nom)
3. Région: **Automatic** (recommandé)
4. Cliquez sur **Create bucket**

### Étape 4: Générer les clés API

1. Dans la section **R2**, cliquez sur **Manage R2 API Tokens**
2. Cliquez sur **Create API Token**
3. Donnez un nom: `blindtest-api`
4. Permissions:
   - ✅ **Object Read & Write**
   - Scope: `blindtest-music` (votre bucket)
5. Cliquez sur **Create API Token**
6. **IMPORTANT**: Copiez immédiatement:
   - `Access Key ID`
   - `Secret Access Key`
   - Ces clés ne seront plus affichées!

### Étape 5: Récupérer l'Account ID

1. Dans le dashboard Cloudflare
2. En haut à droite, vous verrez votre **Account ID**
3. Copiez-le (format: `1a2b3c4d5e6f7g8h9i0j`)

### Étape 6 (Optionnel): Configurer un domaine public

Pour des URLs publiques (sans signed URLs):

1. Dans votre bucket `blindtest-music`
2. Cliquez sur **Settings**
3. Section **Public Access**
4. Cliquez sur **Allow Access**
5. Activez **R2.dev subdomain**
6. Notez le domaine généré: `blindtest-music.r2.dev`

---

## 🔑 Variables d'environnement

Ajoutez ces variables à votre fichier `.env` ou dans Render:

```bash
# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id_here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key_here
CLOUDFLARE_R2_BUCKET_NAME=blindtest-music

# Optionnel: Domaine public R2 (si configuré à l'étape 6)
CLOUDFLARE_R2_PUBLIC_DOMAIN=blindtest-music.r2.dev
```

### Configuration sur Render.com

1. Allez dans votre service backend sur Render
2. **Environment** → **Environment Variables**
3. Ajoutez chaque variable:
   - Key: `CLOUDFLARE_ACCOUNT_ID`
   - Value: votre Account ID
   - Cliquez sur **Add**
4. Répétez pour toutes les variables
5. **Save Changes** → Render redéploiera automatiquement

---

## 📤 Upload de musiques

### Méthode 1: Via l'API (Upload unique)

```bash
curl -X POST http://localhost:10000/api/music/upload \
  -F "file=@/path/to/song.mp3" \
  -F "title=Titre personnalisé" \
  -F "artist=Artiste personnalisé"
```

**Réponse:**
```json
{
  "success": true,
  "track": {
    "id": "abc123...",
    "title": "Titre personnalisé",
    "artist": "Artiste personnalisé",
    "duration": 180,
    "url": "https://blindtest-music.r2.dev/tracks/abc123.mp3"
  }
}
```

### Méthode 2: Upload en masse (Script)

Pour uploader toute une compilation:

```bash
# Depuis le dossier du projet
node scripts/upload-compilation.js /path/to/music "Top Hits 2024" "Mes meilleurs morceaux"
```

**Exemple:**
```bash
# Structure de votre dossier musique:
/home/user/musique/compilation1/
  ├── song1.mp3
  ├── song2.mp3
  └── song3.mp3

# Commande:
API_URL=https://blindtest-backend.onrender.com/api \
  node scripts/upload-compilation.js \
  /home/user/musique/compilation1 \
  "Compilation 1" \
  "Ma première compilation"
```

**Le script va:**
1. Scanner tous les MP3 du dossier
2. Extraire automatiquement les métadonnées (titre, artiste, durée)
3. Uploader chaque fichier vers R2
4. Créer une playlist avec tous les morceaux
5. Afficher l'ID de la playlist à utiliser dans le jeu

**Output:**
```
🎵 Blindtest Music Upload Script
=================================
📁 Music directory: /home/user/musique/compilation1
🎼 Playlist name: Compilation 1
🌐 API URL: https://blindtest-backend.onrender.com/api

📂 Found 25 MP3 files

[1/25] Uploading song1.mp3... ✅ OK (Blinding Lights - The Weeknd)
[2/25] Uploading song2.mp3... ✅ OK (Levitating - Dua Lipa)
...
[25/25] Uploading song25.mp3... ✅ OK (Stay - The Kid LAROI)

=================================
✅ Uploaded: 25/25
❌ Failed: 0

📋 Creating playlist "Compilation 1"...

✅ Playlist created successfully!

=================================
PLAYLIST DETAILS
=================================
ID: f3a2c1b4d5e6f7g8h9i0j1k2l3m4n5o6p
Name: Compilation 1
Tracks: 25

🎮 Use this ID in your game:
   f3a2c1b4d5e6f7g8h9i0j1k2l3m4n5o6p
```

### Méthode 3: Via interface web (TODO)

Une interface d'upload sera ajoutée prochainement.

---

## 🎼 Création de playlists

### API Endpoint

```bash
POST /api/music/playlist
Content-Type: application/json

{
  "name": "Ma Playlist",
  "description": "Description optionnelle",
  "tracks": [
    {
      "id": "track1_id",
      "title": "Song 1",
      "artist": "Artist 1",
      "url": "https://...",
      "duration": 180
    },
    {
      "id": "track2_id",
      "title": "Song 2",
      "artist": "Artist 2",
      "url": "https://...",
      "duration": 200
    }
  ]
}
```

### Lister les playlists

```bash
GET /api/music/playlists
```

**Réponse:**
```json
{
  "success": true,
  "count": 3,
  "playlists": [
    {
      "id": "abc123...",
      "name": "Compilation 1",
      "description": "Ma première compilation",
      "totalTracks": 25,
      "createdAt": "2025-11-19T12:00:00.000Z"
    }
  ]
}
```

---

## 🎮 Utilisation dans le jeu

### 1. Frontend - Sélection de playlist

Le frontend peut lister les playlists custom:

```javascript
// Récupérer les playlists R2
const response = await fetch('https://backend-url/api/music/playlists');
const data = await response.json();

// Afficher dans une liste déroulante
data.playlists.forEach(playlist => {
  console.log(`${playlist.name} (${playlist.totalTracks} tracks)`);
  console.log(`ID: ${playlist.id}`);
});
```

### 2. Backend - Chargement automatique

Le backend détecte automatiquement le type de playlist:

```javascript
// ID Spotify (22 caractères alphanumériques):
// 37i9dQZF1DXcBWIGoYBM5M → Charge depuis Spotify

// ID R2 (32 caractères hexadécimaux):
// f3a2c1b4d5e6f7g8h9i0j1k2l3m4n5o6p → Charge depuis R2
```

Aucun changement dans ton code frontend! Il suffit de passer l'ID de playlist:

```javascript
socket.emit('load_playlist', {
  roomCode: 'ABC123',
  playlistId: 'f3a2c1b4d5e6f7g8h9i0j1k2l3m4n5o6p' // ID R2
});
```

---

## 📊 Vérifier la configuration

```bash
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

Si `configured: false`, vérifiez vos variables d'environnement.

---

## 🎵 Format des fichiers audio

**Formats supportés:**
- ✅ MP3 (recommandé)
- ✅ WAV
- ✅ FLAC
- ✅ M4A
- ✅ OGG

**Recommandations:**
- **Bitrate**: 128-320 kbps (MP3)
- **Taille max**: 50MB par fichier
- **Métadonnées**: Utilisez des fichiers avec tags ID3 (titre, artiste) pour extraction automatique

---

## 🔧 Dépannage

### Erreur: "R2 configuration missing"

→ Vérifiez que toutes les variables d'environnement sont définies:
```bash
echo $CLOUDFLARE_ACCOUNT_ID
echo $CLOUDFLARE_R2_ACCESS_KEY_ID
echo $CLOUDFLARE_R2_SECRET_ACCESS_KEY
echo $CLOUDFLARE_R2_BUCKET_NAME
```

### Erreur: "Upload failed: Access denied"

→ Vérifiez les permissions de votre API token:
1. Dashboard Cloudflare → R2 → API Tokens
2. Vérifiez que le token a les permissions **Object Read & Write**
3. Vérifiez que le bucket name est correct

### Upload très lent

→ Utilisez un domaine public R2:
1. Activez `R2.dev subdomain` dans les settings du bucket
2. Ajoutez `CLOUDFLARE_R2_PUBLIC_DOMAIN=votre-bucket.r2.dev` dans `.env`

---

## 📈 Limites gratuites Cloudflare R2

| Ressource | Limite Gratuite |
|-----------|----------------|
| Stockage | 10 GB |
| Opérations Class A (write) | 1 million/mois |
| Opérations Class B (read) | 10 millions/mois |
| Bande passante sortante | 0€ (gratuit illimité!) |

**Note**: Ces limites sont **largement suffisantes** pour un blindtest avec plusieurs centaines de parties par mois.

---

## 🚀 Prochaines étapes

1. ✅ Upload tes compilations MP3
2. ✅ Crée des playlists thématiques
3. ✅ Utilise les IDs de playlist dans ton jeu
4. 🎮 Profite de ton blindtest avec tes musiques perso!

---

## 📞 Support

En cas de problème:
1. Vérifiez la configuration avec `GET /api/music/status`
2. Consultez les logs backend (Render)
3. Vérifiez les permissions dans le dashboard Cloudflare

---

**Fait avec ❤️ pour un blindtest musical sans limites!** 🎵
