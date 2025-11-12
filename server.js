// server.js - VERSION CORRIGÉE avec tous les bugs fixes

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Structure pour stocker les parties
const games = new Map();

// Fonction pour générer un code de room
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Fonction pour sélectionner un track NON DÉJÀ JOUÉ
function selectUniqueTrack(game) {
  if (!game.playlist || !game.playlist.tracks) {
    return null;
  }

  // Si tous les tracks ont été joués, réinitialiser
  if (game.playedTracks.size >= game.playlist.tracks.length) {
    console.log('🔄 Tous les tracks ont été joués, réinitialisation');
    game.playedTracks.clear();
  }

  // Filtrer les tracks non joués
  const availableTracks = game.playlist.tracks.filter((track, index) =>
    !game.playedTracks.has(index)
  );

  if (availableTracks.length === 0) {
    return null;
  }

  // Sélectionner au hasard parmi les disponibles
  const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];

  // Trouver l'index original et le marquer comme joué
  const originalIndex = game.playlist.tracks.findIndex(t =>
    t.id === selectedTrack.id
  );

  game.playedTracks.add(originalIndex);

  console.log(`🎵 Track sélectionné: ${selectedTrack.title} - ${selectedTrack.artist.name}`);
  console.log(`   Tracks joués: ${game.playedTracks.size}/${game.playlist.tracks.length}`);

  return selectedTrack;
}

io.on('connection', (socket) => {
  console.log('✅ Client connecté:', socket.id);

  // Créer une partie
  socket.on('create_game', (callback) => {
    const roomCode = generateRoomCode();

    games.set(roomCode, {
      roomCode,
      hostId: socket.id,
      players: [],
      playlist: null,
      currentRound: null,
      status: 'waiting', // waiting, playing, paused
      playedTracks: new Set(), // 🆕 Tracker les tracks déjà joués
      config: {
        extractDuration: 30,
        timerDuration: 10, // 🆕 Durée du timer VISUEL (en secondes)
        musicVolume: 70,
        soundEffectsVolume: 80,
      }
    });

    socket.join(roomCode);

    console.log(`🎮 Partie créée: ${roomCode} par ${socket.id}`);

    callback({ success: true, roomCode });
  });

  // Rejoindre une partie
  socket.on('join_game', ({ roomCode, playerName }, callback) => {
    const game = games.get(roomCode);

    if (!game) {
      return callback({ success: false, error: 'Partie introuvable' });
    }

    // Vérifier si le joueur existe déjà (reconnexion)
    const existingPlayer = game.players.find(p => p.name === playerName);

    if (existingPlayer) {
      existingPlayer.id = socket.id; // Mettre à jour l'ID
      socket.join(roomCode);
      return callback({
        success: true,
        player: existingPlayer,
        players: game.players
      });
    }

    // Créer nouveau joueur
    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      color: getPlayerColor(game.players.length)
    };

    game.players.push(player);
    socket.join(roomCode);

    // Notifier tous les clients
    io.to(roomCode).emit('player_joined', {
      players: game.players
    });

    console.log(`👤 ${playerName} a rejoint la partie ${roomCode}`);
    console.log(`   Joueurs dans la room: ${game.players.length}`);

    callback({ success: true, player, players: game.players });
  });

  // Charger une playlist
  socket.on('load_playlist', ({ roomCode, playlistId }, callback) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    console.log(`🎵 Chargement playlist: ${playlistId}`);

    // Simuler le chargement (en prod, tu appelles l'API Deezer)
    // Pour l'instant, on simule avec des données de test
    const mockPlaylist = {
      id: playlistId,
      title: 'Blind test années 90 2000 ✨ annees 90 2000',
      tracks: [
        { id: 1, title: "Don't Stop The Music", artist: { name: "Rihanna" }, preview: "https://cdns-preview-d.dzcdn.net/stream/c-d..." },
        { id: 2, title: "Umbrella", artist: { name: "Rihanna" }, preview: "https://..." },
        // ... autres tracks
      ]
    };

    game.playlist = mockPlaylist;
    game.playedTracks.clear(); // 🆕 Réinitialiser les tracks joués

    console.log(`✅ Playlist chargée: ${mockPlaylist.title} (${mockPlaylist.tracks.length} titres)`);

    callback({
      success: true,
      playlist: {
        title: mockPlaylist.title,
        trackCount: mockPlaylist.tracks.length
      }
    });
  });

  // 🆕 Lancer une manche (VERSION CORRIGÉE)
  socket.on('start_round', ({ roomCode }, callback) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    if (!game.playlist) {
      return callback({ success: false, error: 'Pas de playlist chargée' });
    }

    console.log(`🚀 Tentative de démarrage manche pour room: ${roomCode}`);

    // 🆕 Sélectionner un track unique (non déjà joué)
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

    // 🆕 CORRECTION #4 : Broadcaster à TOUTE la room (y compris Display)
    io.to(roomCode).emit('play_track', {
      previewUrl: track.preview,
      duration: game.config.extractDuration,
      timerDuration: game.config.timerDuration || 10, // 🆕 Durée du timer VISUEL
      volume: game.config.musicVolume / 100,
      title: track.title,  // Pour le MC
      artist: track.artist.name
    });

    // Notifier le début de manche
    io.to(roomCode).emit('round_started', {
      roundNumber: game.playedTracks.size
    });

    console.log(`📡 Track diffusé à toute la room ${roomCode}`);
    console.log(`   Nombre de clients dans la room: ${io.sockets.adapter.rooms.get(roomCode)?.size || 0}`);

    callback({ success: true });
  });

  // Buzzer
  socket.on('buzz', ({ roomCode }) => {
    const game = games.get(roomCode);

    if (!game || !game.currentRound || game.currentRound.buzzedPlayer) {
      return;
    }

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    game.currentRound.buzzedPlayer = player.id;
    game.currentRound.buzzTime = Date.now();

    // 🆕 CORRECTION #1 : Arrêter la musique quand quelqu'un buzze
    io.to(roomCode).emit('stop_music');

    io.to(roomCode).emit('buzz_locked', {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color
    });

    console.log(`🔔 ${player.name} a buzzé dans ${roomCode}`);
  });

  // Valider une réponse (PAS DE TIMER)
  socket.on('validate_answer', ({ roomCode, isCorrect }) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id || !game.currentRound) {
      return;
    }

    const player = game.players.find(p => p.id === game.currentRound.buzzedPlayer);
    if (!player) return;

    // 🆕 CORRECTION #3 : Pas de timer, juste validation simple
    const points = isCorrect ? 10 : -5;
    player.score += points;

    // Terminer la manche
    const answer = `${game.currentRound.track.title} - ${game.currentRound.track.artist.name}`;

    game.currentRound = null;
    game.status = 'waiting';

    // Envoyer le résultat
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

  // Passer au suivant (timeout ou mauvaise réponse)
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

    console.log(`⏭️ Manche passée dans ${roomCode}`);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);

    // Retirer le joueur de toutes les parties
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

      // Supprimer la partie si l'hôte se déconnecte
      if (game.hostId === socket.id) {
        console.log(`🗑️ Suppression de la partie ${roomCode} (hôte déconnecté)`);
        games.delete(roomCode);
      }
    });
  });
});

// Fonction helper pour les couleurs
function getPlayerColor(index) {
  const colors = [
    '#FF3366', '#00D9FF', '#FFD700', '#9D4EDD',
    '#06FFA5', '#FF6B6B', '#4ECDC4', '#FFE66D'
  ];
  return colors[index % colors.length];
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur WebSocket sur le port ${PORT}`);
});
