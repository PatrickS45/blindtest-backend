// server.js - VERSION FINALE AVEC API DEEZER

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

function selectUniqueTrack(game) {
  if (!game.playlist || !game.playlist.tracks) {
    return null;
  }

  if (game.playedTracks.size >= game.playlist.tracks.length) {
    console.log('🔄 Réinitialisation des tracks');
    game.playedTracks.clear();
  }

  const availableTracks = game.playlist.tracks.filter((track, index) =>
    !game.playedTracks.has(index)
  );

  if (availableTracks.length === 0) return null;

  const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  const originalIndex = game.playlist.tracks.findIndex(t => t.id === selectedTrack.id);

  game.playedTracks.add(originalIndex);

  console.log(`🎵 Track: ${selectedTrack.title} - ${selectedTrack.artist.name}`);
  console.log(`   Joués: ${game.playedTracks.size}/${game.playlist.tracks.length}`);

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
        buzzerSound: game.players.indexOf(existingPlayer) + 1
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
      buzzerSound: game.players.length
    });
  });

  // 🆕 CHARGEMENT PLAYLIST DEEZER
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

      const playlist = {
  id: response.data.id,
  title: response.data.title,
  tracks: response.data.tracks.data
    .filter(track => track.preview)  // 🆕 Filtrer les tracks sans preview
    .map(track => ({
      id: track.id,
      title: track.title,
      artist: { name: track.artist.name },
      preview: track.preview
    }))
};

      game.playlist = playlist;
      game.playedTracks.clear();

      console.log(`✅ Playlist: ${playlist.title} (${playlist.tracks.length} titres)`);

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
        error: 'Impossible de charger la playlist. Vérifiez l\'ID.'
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

    io.to(roomCode).emit('play_track', {
      previewUrl: track.preview,
      duration: game.config.extractDuration,
      timerDuration: game.config.timerDuration || 10,
      volume: game.config.musicVolume / 100,
      title: track.title,
      artist: track.artist.name
    });

    io.to(roomCode).emit('round_started', {
      roundNumber: game.playedTracks.size
    });

    console.log(`📡 Track diffusé à ${roomCode}`);

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
});
