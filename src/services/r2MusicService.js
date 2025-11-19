// src/services/r2MusicService.js
// Service pour gérer les fichiers musicaux sur Cloudflare R2

const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { parseFile } = require('music-metadata');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class R2MusicService {
  constructor() {
    // Configuration Cloudflare R2
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'blindtest-music';
    this.publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN; // ex: blindtest-music.r2.dev

    // Client S3 configuré pour R2
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    // Stockage en mémoire des playlists (à migrer vers DB plus tard)
    this.playlists = new Map();

    console.log('✅ R2MusicService initialized');
    console.log(`   Bucket: ${this.bucketName}`);
    console.log(`   Public domain: ${this.publicDomain || 'Not configured (using signed URLs)'}`);
  }

  /**
   * Extrait les métadonnées d'un fichier MP3
   * @param {string} filePath - Chemin du fichier MP3
   * @returns {Promise<Object>} Métadonnées (titre, artiste, durée, etc.)
   */
  async extractMetadata(filePath) {
    try {
      const metadata = await parseFile(filePath);

      return {
        title: metadata.common.title || path.basename(filePath, '.mp3'),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        duration: Math.round(metadata.format.duration || 0),
        year: metadata.common.year || null,
        genre: metadata.common.genre?.[0] || null,
      };
    } catch (error) {
      console.error('Failed to extract metadata:', error.message);

      // Fallback: utiliser le nom de fichier
      return {
        title: path.basename(filePath, '.mp3'),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        year: null,
        genre: null,
      };
    }
  }

  /**
   * Upload un fichier MP3 vers R2
   * @param {Object} file - Fichier uploadé (multer file object)
   * @param {Object} customMetadata - Métadonnées personnalisées (optionnel)
   * @returns {Promise<Object>} Informations du track uploadé
   */
  async uploadTrack(file, customMetadata = {}) {
    try {
      console.log('📤 Uploading track to R2:', file.originalname);

      // Extraire métadonnées du fichier
      const autoMetadata = await this.extractMetadata(file.path);

      // Fusionner avec métadonnées custom
      const metadata = {
        ...autoMetadata,
        ...customMetadata,
      };

      // Générer un ID unique pour le track
      const trackId = crypto.randomBytes(16).toString('hex');
      const fileExtension = path.extname(file.originalname);
      const s3Key = `tracks/${trackId}${fileExtension}`;

      // Lire le fichier
      const fileContent = fs.readFileSync(file.path);

      // Upload vers R2
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: file.mimetype || 'audio/mpeg',
        Metadata: {
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          duration: metadata.duration.toString(),
        },
      });

      await this.s3Client.send(command);

      // Générer URL publique
      const publicUrl = this.publicDomain
        ? `https://${this.publicDomain}/${s3Key}`
        : await this.getSignedUrl(s3Key);

      const track = {
        id: trackId,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        duration: metadata.duration,
        year: metadata.year,
        genre: metadata.genre,
        url: publicUrl,
        s3Key: s3Key,
        uploadedAt: new Date().toISOString(),
      };

      console.log('✅ Track uploaded successfully:', track.id);

      return track;
    } catch (error) {
      console.error('❌ Failed to upload track:', error.message);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Génère une URL signée pour accéder à un fichier (si pas de domaine public)
   * @param {string} s3Key - Clé S3 du fichier
   * @param {number} expiresIn - Durée de validité en secondes (défaut: 1h)
   * @returns {Promise<string>} URL signée
   */
  async getSignedUrl(s3Key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Liste tous les tracks disponibles
   * @returns {Promise<Array>} Liste des tracks
   */
  async listTracks() {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'tracks/',
      });

      const response = await this.s3Client.send(command);

      if (!response.Contents) {
        return [];
      }

      const tracks = await Promise.all(
        response.Contents.map(async (item) => {
          const trackId = path.basename(item.Key, path.extname(item.Key));
          const url = this.publicDomain
            ? `https://${this.publicDomain}/${item.Key}`
            : await this.getSignedUrl(item.Key);

          return {
            id: trackId,
            s3Key: item.Key,
            url: url,
            size: item.Size,
            lastModified: item.LastModified,
          };
        })
      );

      return tracks;
    } catch (error) {
      console.error('❌ Failed to list tracks:', error.message);
      throw new Error(`List tracks failed: ${error.message}`);
    }
  }

  /**
   * Supprime un track de R2
   * @param {string} trackId - ID du track
   * @returns {Promise<void>}
   */
  async deleteTrack(trackId) {
    try {
      const s3Key = `tracks/${trackId}.mp3`; // Assuming .mp3 extension

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
      console.log('✅ Track deleted:', trackId);
    } catch (error) {
      console.error('❌ Failed to delete track:', error.message);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Crée une playlist à partir de tracks
   * @param {string} name - Nom de la playlist
   * @param {string} description - Description
   * @param {Array<Object>} tracks - Liste des tracks avec métadonnées
   * @returns {Object} Playlist créée
   */
  createPlaylist(name, description, tracks) {
    const playlistId = crypto.randomBytes(16).toString('hex');

    const playlist = {
      id: playlistId,
      name: name,
      description: description || '',
      tracks: tracks.map(track => ({
        id: track.id,
        name: track.title,
        artists: [{ name: track.artist }],
        album: { name: track.album },
        preview_url: track.url,
        duration_ms: track.duration * 1000,
      })),
      totalTracks: tracks.length,
      usableTracks: tracks.length,
      createdAt: new Date().toISOString(),
    };

    this.playlists.set(playlistId, playlist);
    console.log('✅ Playlist created:', playlistId, `(${tracks.length} tracks)`);

    return playlist;
  }

  /**
   * Récupère une playlist par ID
   * @param {string} playlistId - ID de la playlist
   * @returns {Object} Playlist
   */
  getPlaylist(playlistId) {
    const playlist = this.playlists.get(playlistId);

    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    return playlist;
  }

  /**
   * Liste toutes les playlists disponibles
   * @returns {Array} Liste des playlists
   */
  listPlaylists() {
    return Array.from(this.playlists.values()).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      totalTracks: p.totalTracks,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Supprime une playlist
   * @param {string} playlistId - ID de la playlist
   */
  deletePlaylist(playlistId) {
    const deleted = this.playlists.delete(playlistId);

    if (!deleted) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    console.log('✅ Playlist deleted:', playlistId);
  }

  /**
   * Vérifie la configuration R2
   * @returns {boolean} True si bien configuré
   */
  isConfigured() {
    return !!(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucketName
    );
  }
}

// Instance singleton
const r2MusicService = new R2MusicService();

module.exports = r2MusicService;
