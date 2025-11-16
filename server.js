// server.js - VERSION FINALE AVEC PROXY CORS + BUGS CORRIGÉS

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const games = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 🧪 PAGE DE TEST CORS
app.get('/test-cors', (req, res) => {
  res.sendFile(__dirname + '/test-cors.html');
});

// 🆕 PROXY AUDIO POUR CONTOURNER CORS
app.get('/proxy-audio', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('URL manquante');
  }

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000, // 30 secondes de timeout
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'audio/mpeg'
      }
    });

    // Transmettre tous les headers importants
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // ✅ Transmettre Content-Length pour que le navigateur sache la taille
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // ✅ Supporter les requêtes de range (seeking)
    if (response.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
    }

    // ✅ Gérer les erreurs de streaming
    response.data.on('error', (err) => {
      console.error('❌ Erreur stream audio:', err.message);
      if (!res.headersSent) {
        res.status(500).send('Erreur streaming');
      }
    });

    // ✅ Pipe le stream avec gestion d'erreur
    response.data.pipe(res).on('error', (err) => {
      console.error('❌ Erreur pipe audio:', err.message);
    });

  } catch (error) {
    console.error('❌ Erreur proxy audio:', error.message);
    if (!res.headersSent) {
      res.status(500).send('Erreur proxy');
    }
  }
});

// 🆕 CORRECTION BUG : selectUniqueTrack ne duplique plus + skip tracks sans preview
function selectUniqueTrack(game) {
  if (!game.playlist || !game.playlist.tracks) {
    return null;
  }

  if (game.playedTracks.size >= game.playlist.tracks.length) {
    console.log('🔄 Réinitialisation');
    game.playedTracks.clear();
  }

  // Créer une liste des index disponibles AVEC preview
  const availableIndexes = [];
  for (let i = 0; i < game.playlist.tracks.length; i++) {
    const track = game.playlist.tracks[i];
    if (!game.playedTracks.has(i) && track.hasPreview) {  // 🆕 Vérifier hasPreview
      availableIndexes.push(i);
    }
  }

  if (availableIndexes.length === 0) {
    console.log('⚠️ Plus de tracks avec preview disponibles');
    return null;
  }

  // Sélectionner un index aléatoire
  const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
  const selectedTrack = game.playlist.tracks[randomIndex];

  // Marquer cet index comme joué
  game.playedTracks.add(randomIndex);

  console.log(`🎵 Track #${randomIndex + 1}: ${selectedTrack.title} - ${selectedTrack.artist.name}`);
  console.log(`   Joués: ${game.playedTracks.size}/${game.playlist.tracks.length} (${availableIndexes.length} restants avec preview)`);

  return selectedTrack;
}

function getPlayerColor(index) {
  const colors = [
    '#FF3366', '#00D9FF', '#FFD700', '#9D4EDD',
    '#06FFA5', '#FF6B6B', '#4ECDC4', '#FFE66D'
  ];
  return colors[index % colors.length];
}

io.on('connection', (socket) => {
  console.log('✅ Client connecté:', socket.id);

  socket.on('create_game', (callback) => {
    const roomCode = generateRoomCode();

    games.set(roomCode, {
      roomCode,
      hostId: socket.id,
      players: [],
      playlist: null,
      currentRound: null,
      status: 'waiting',
      playedTracks: new Set(),
      config: {
        extractDuration: 30,
        timerDuration: 10,
        musicVolume: 70,
        soundEffectsVolume: 80,
      }
    });

    socket.join(roomCode);
    console.log(`🎮 Partie créée: ${roomCode}`);
    callback({ success: true, roomCode });
  });

  socket.on('join_game', ({ roomCode, playerName }, callback) => {
    const game = games.get(roomCode);

    if (!game) {
      return callback({ success: false, error: 'Partie introuvable' });
    }

    // Display
    if (playerName && playerName.startsWith('Display-')) {
      socket.join(roomCode);
      console.log(`📺 Display connecté à ${roomCode}`);
      return callback({
        success: true,
        players: game.players
      });
    }

    // Reconnexion
    const existingPlayer = game.players.find(p => p.name === playerName);
    if (existingPlayer) {
      existingPlayer.id = socket.id;
      socket.join(roomCode);
      return callback({
        success: true,
        player: existingPlayer,
        players: game.players,
        buzzerSound: Math.floor(Math.random() * 23) + 1  // 🎲 Aléatoire
      });
    }

    // Nouveau joueur
    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      color: getPlayerColor(game.players.length)
    };

    game.players.push(player);
    socket.join(roomCode);

    io.to(roomCode).emit('player_joined', {
      players: game.players
    });

    console.log(`👤 ${playerName} a rejoint ${roomCode}`);

    callback({
      success: true,
      player,
      players: game.players,
      buzzerSound: Math.floor(Math.random() * 23) + 1  // 🎲 Aléatoire
    });
  });

  // 🆕 CHARGEMENT PLAYLIST DEEZER AVEC LOGS
  socket.on('load_playlist', async ({ roomCode, playlistId }, callback) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    try {
      console.log(`🎵 Chargement playlist Deezer: ${playlistId}`);

      const response = await axios.get(`https://api.deezer.com/playlist/${playlistId}`, {
        timeout: 10000
      });

      if (!response.data || !response.data.tracks) {
        throw new Error('Playlist vide ou invalide');
      }

      const allTracks = response.data.tracks.data;

      // 🆕 Garder TOUS les tracks mais marquer ceux sans preview
      const playlist = {
        id: response.data.id,
        title: response.data.title,
        tracks: allTracks.map(track => ({
          id: track.id,
          title: track.title,
          artist: { name: track.artist.name },
          preview: track.preview || null,
          hasPreview: !!track.preview  // 🆕 Flag pour savoir si preview existe
        }))
      };

      const tracksWithPreview = playlist.tracks.filter(t => t.hasPreview).length;

      console.log(`📊 Tracks total: ${allTracks.length}`);
      console.log(`📊 Tracks avec preview: ${tracksWithPreview}`);
      console.log(`⚠️ Tracks sans preview: ${allTracks.length - tracksWithPreview}`);

      game.playlist = playlist;
      game.playedTracks.clear();

      console.log(`✅ Playlist: ${playlist.title} (${playlist.tracks.length} titres utilisables)`);

      callback({
        success: true,
        playlist: {
          title: playlist.title,
          trackCount: playlist.tracks.length
        }
      });
    } catch (error) {
      console.error('❌ Erreur Deezer:', error.message);
      callback({
        success: false,
        error: 'Impossible de charger la playlist'
      });
    }
  });

  socket.on('start_round', ({ roomCode }, callback) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    if (!game.playlist) {
      return callback({ success: false, error: 'Pas de playlist chargée' });
    }

    const track = selectUniqueTrack(game);

    if (!track) {
      return callback({ success: false, error: 'Aucun track disponible' });
    }

    game.currentRound = {
      track,
      buzzedPlayer: null,
      startTime: Date.now()
    };

    game.status = 'playing';

    // 🆕 TOUJOURS utiliser le proxy pour éviter CORS
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
    const proxiedUrl = `${serverUrl}/proxy-audio?url=${encodeURIComponent(track.preview)}`;

    io.to(roomCode).emit('play_track', {
      previewUrl: proxiedUrl,  // ✅ Toujours via proxy
      duration: game.config.extractDuration,
      timerDuration: game.config.timerDuration || 10,
      volume: game.config.musicVolume / 100,
      title: track.title,
      artist: track.artist.name
    });

    io.to(roomCode).emit('round_started', {
      roundNumber: game.playedTracks.size
    });

    console.log(`📡 Track diffusé via proxy: ${track.title}`);

    callback({ success: true });
  });

  socket.on('buzz', ({ roomCode }) => {
    const game = games.get(roomCode);

    if (!game || !game.currentRound || game.currentRound.buzzedPlayer) {
      return;
    }

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    game.currentRound.buzzedPlayer = player.id;
    game.currentRound.buzzTime = Date.now();

    io.to(roomCode).emit('stop_music');

    io.to(roomCode).emit('buzz_locked', {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color
    });

    console.log(`🔔 ${player.name} a buzzé`);
  });

  socket.on('validate_answer', ({ roomCode, isCorrect }) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id || !game.currentRound) {
      return;
    }

    const player = game.players.find(p => p.id === game.currentRound.buzzedPlayer);
    if (!player) return;

    const points = isCorrect ? 10 : -5;
    player.score += points;

    const answer = `${game.currentRound.track.title} - ${game.currentRound.track.artist.name}`;

    game.currentRound = null;
    game.status = 'waiting';

    io.to(roomCode).emit('round_result', {
      correct: isCorrect,
      player: {
        name: player.name,
        color: player.color
      },
      points,
      answer,
      leaderboard: game.players
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, score: p.score, color: p.color }))
    });

    console.log(`✅ Réponse ${isCorrect ? 'correcte' : 'incorrecte'} de ${player.name}`);
  });

  socket.on('skip_round', ({ roomCode }) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id || !game.currentRound) {
      return;
    }

    const answer = `${game.currentRound.track.title} - ${game.currentRound.track.artist.name}`;

    game.currentRound = null;
    game.status = 'waiting';

    io.to(roomCode).emit('round_skipped', {
      answer,
      leaderboard: game.players
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, score: p.score, color: p.color }))
    });

    console.log(`⏭️ Manche passée`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);

    games.forEach((game, roomCode) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        console.log(`👋 ${player.name} a quitté ${roomCode}`);

        game.players.splice(playerIndex, 1);

        io.to(roomCode).emit('player_left', {
          players: game.players
        });
      }

      if (game.hostId === socket.id) {
        console.log(`🗑️ Suppression ${roomCode}`);
        games.delete(roomCode);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur sur le port ${PORT}`);
  console.log(`🔊 Proxy audio disponible: http://localhost:${PORT}/proxy-audio`);
});
