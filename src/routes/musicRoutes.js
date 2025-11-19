// src/routes/musicRoutes.js
// Routes pour gérer les fichiers musicaux uploadés sur R2

const express = require('express');
const router = express.Router();
const multer = require('multer');
const r2MusicService = require('../services/r2MusicService');
const fs = require('fs');

// Configuration multer pour upload temporaire
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement les fichiers audio
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

/**
 * POST /music/upload
 * Upload un ou plusieurs fichiers MP3
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // Métadonnées custom depuis le body (optionnel)
    const customMetadata = {};
    if (req.body.title) customMetadata.title = req.body.title;
    if (req.body.artist) customMetadata.artist = req.body.artist;
    if (req.body.album) customMetadata.album = req.body.album;

    // Upload vers R2
    const track = await r2MusicService.uploadTrack(req.file, customMetadata);

    // Nettoyer le fichier temporaire
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      track: track,
    });
  } catch (error) {
    console.error('Upload error:', error);

    // Nettoyer le fichier temporaire en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /music/upload-multiple
 * Upload plusieurs fichiers MP3 en une fois
 */
router.post('/upload-multiple', upload.array('files', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    console.log(`📤 Uploading ${req.files.length} files...`);

    const uploadedTracks = [];
    const errors = [];

    // Upload chaque fichier
    for (const file of req.files) {
      try {
        const track = await r2MusicService.uploadTrack(file);
        uploadedTracks.push(track);

        // Nettoyer fichier temporaire
        fs.unlinkSync(file.path);
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message,
        });

        // Nettoyer fichier temporaire
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.json({
      success: true,
      uploaded: uploadedTracks.length,
      failed: errors.length,
      tracks: uploadedTracks,
      errors: errors,
    });
  } catch (error) {
    console.error('Multiple upload error:', error);

    // Nettoyer tous les fichiers temporaires
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /music/tracks
 * Liste tous les tracks uploadés
 */
router.get('/tracks', async (req, res) => {
  try {
    const tracks = await r2MusicService.listTracks();

    res.json({
      success: true,
      count: tracks.length,
      tracks: tracks,
    });
  } catch (error) {
    console.error('List tracks error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /music/track/:id
 * Supprime un track
 */
router.delete('/track/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await r2MusicService.deleteTrack(id);

    res.json({
      success: true,
      message: 'Track deleted successfully',
    });
  } catch (error) {
    console.error('Delete track error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /music/playlist
 * Crée une playlist à partir de tracks uploadés
 * Body: { name, description, trackIds: [] }
 */
router.post('/playlist', async (req, res) => {
  try {
    const { name, description, tracks } = req.body;

    if (!name || !tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: name and tracks array required',
      });
    }

    const playlist = r2MusicService.createPlaylist(name, description, tracks);

    res.json({
      success: true,
      playlist: playlist,
    });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /music/playlists
 * Liste toutes les playlists
 */
router.get('/playlists', (req, res) => {
  try {
    const playlists = r2MusicService.listPlaylists();

    res.json({
      success: true,
      count: playlists.length,
      playlists: playlists,
    });
  } catch (error) {
    console.error('List playlists error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /music/playlist/:id
 * Récupère une playlist par ID
 */
router.get('/playlist/:id', (req, res) => {
  try {
    const { id } = req.params;
    const playlist = r2MusicService.getPlaylist(id);

    res.json({
      success: true,
      playlist: playlist,
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /music/playlist/:id
 * Supprime une playlist
 */
router.delete('/playlist/:id', (req, res) => {
  try {
    const { id } = req.params;
    r2MusicService.deletePlaylist(id);

    res.json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /music/status
 * Vérifie le statut de la configuration R2
 */
router.get('/status', (req, res) => {
  const isConfigured = r2MusicService.isConfigured();

  res.json({
    success: true,
    configured: isConfigured,
    message: isConfigured
      ? 'R2 is properly configured'
      : 'R2 configuration missing (check environment variables)',
  });
});

module.exports = router;
