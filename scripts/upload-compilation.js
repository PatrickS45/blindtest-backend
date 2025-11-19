#!/usr/bin/env node
// scripts/upload-compilation.js
// Script pour uploader une compilation de musiques vers R2

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:10000/api';
const MUSIC_DIR = process.argv[2]; // Dossier contenant les MP3
const PLAYLIST_NAME = process.argv[3] || 'Ma Compilation';
const PLAYLIST_DESC = process.argv[4] || '';

if (!MUSIC_DIR) {
  console.error('❌ Usage: node upload-compilation.js <music-directory> [playlist-name] [playlist-description]');
  console.error('');
  console.error('Examples:');
  console.error('  node upload-compilation.js ./music/top-hits "Top Hits 2024"');
  console.error('  node upload-compilation.js /path/to/music "My Playlist" "Description"');
  process.exit(1);
}

if (!fs.existsSync(MUSIC_DIR)) {
  console.error(`❌ Directory not found: ${MUSIC_DIR}`);
  process.exit(1);
}

console.log('🎵 Blindtest Music Upload Script');
console.log('=================================');
console.log(`📁 Music directory: ${MUSIC_DIR}`);
console.log(`🎼 Playlist name: ${PLAYLIST_NAME}`);
console.log(`🌐 API URL: ${API_URL}`);
console.log('');

/**
 * Upload un fichier MP3 vers l'API
 */
async function uploadFile(filePath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await axios.post(`${API_URL}/music/upload`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (response.data.success) {
      return response.data.track;
    } else {
      throw new Error(response.data.error || 'Upload failed');
    }
  } catch (error) {
    throw new Error(`Upload failed: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Crée une playlist avec les tracks uploadés
 */
async function createPlaylist(tracks) {
  try {
    const response = await axios.post(`${API_URL}/music/playlist`, {
      name: PLAYLIST_NAME,
      description: PLAYLIST_DESC,
      tracks: tracks,
    });

    if (response.data.success) {
      return response.data.playlist;
    } else {
      throw new Error(response.data.error || 'Playlist creation failed');
    }
  } catch (error) {
    throw new Error(`Playlist creation failed: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Main
 */
async function main() {
  // Lister tous les fichiers MP3
  const files = fs.readdirSync(MUSIC_DIR)
    .filter(file => file.toLowerCase().endsWith('.mp3'))
    .map(file => path.join(MUSIC_DIR, file));

  if (files.length === 0) {
    console.error('❌ No MP3 files found in directory');
    process.exit(1);
  }

  console.log(`📂 Found ${files.length} MP3 files`);
  console.log('');

  const uploadedTracks = [];
  const errors = [];

  // Upload chaque fichier
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = path.basename(file);
    const progress = `[${i + 1}/${files.length}]`;

    try {
      process.stdout.write(`${progress} Uploading ${filename}... `);

      const track = await uploadFile(file);

      uploadedTracks.push(track);
      console.log(`✅ OK (${track.title} - ${track.artist})`);
    } catch (error) {
      errors.push({ filename, error: error.message });
      console.log(`❌ FAILED (${error.message})`);
    }
  }

  console.log('');
  console.log('=================================');
  console.log(`✅ Uploaded: ${uploadedTracks.length}/${files.length}`);
  console.log(`❌ Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log('');
    console.log('Failed files:');
    errors.forEach(err => {
      console.log(`  - ${err.filename}: ${err.error}`);
    });
  }

  // Créer la playlist si au moins un fichier a été uploadé
  if (uploadedTracks.length > 0) {
    console.log('');
    console.log(`📋 Creating playlist "${PLAYLIST_NAME}"...`);

    try {
      const playlist = await createPlaylist(uploadedTracks);

      console.log('');
      console.log('✅ Playlist created successfully!');
      console.log('');
      console.log('=================================');
      console.log('PLAYLIST DETAILS');
      console.log('=================================');
      console.log(`ID: ${playlist.id}`);
      console.log(`Name: ${playlist.name}`);
      console.log(`Tracks: ${playlist.totalTracks}`);
      console.log('');
      console.log('🎮 Use this ID in your game:');
      console.log(`   ${playlist.id}`);
      console.log('');
    } catch (error) {
      console.error('');
      console.error(`❌ Failed to create playlist: ${error.message}`);
      console.error('');
      console.error('Tracks were uploaded but playlist creation failed.');
      console.error('You can create the playlist manually via the API.');
      process.exit(1);
    }
  } else {
    console.error('');
    console.error('❌ No tracks were uploaded. Playlist not created.');
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('');
  console.error('❌ Script error:', error.message);
  process.exit(1);
});
