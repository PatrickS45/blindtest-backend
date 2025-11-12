// server.js - VERSION FINALE CORRIGÉE

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

// 🆕 VRAIE PLAYLIST COMPLÈTE AVEC URLS DE TEST
const getMockPlaylist = () => ({
  id: '1234567',
  title: 'Blind test années 90-2000 ✨',
  tracks: [
    {
      id: 1,
      title: "Don't Stop The Music",
      artist: { name: "Rihanna" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" // URL de test valide
    },
    {
      id: 2,
      title: "Umbrella",
      artist: { name: "Rihanna" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    },
    {
      id: 3,
      title: "Toxic",
      artist: { name: "Britney Spears" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    },
    {
      id: 4,
      title: "Crazy In Love",
      artist: { name: "Beyoncé" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
    },
    {
      id: 5,
      title: "Single Ladies",
      artist: { name: "Beyoncé" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
    },
    {
      id: 6,
      title: "Hips Don't Lie",
      artist: { name: "Shakira" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
    },
    {
      id: 7,
      title: "Poker Face",
      artist: { name: "Lady Gaga" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"
    },
    {
      id: 8,
      title: "Bad Romance",
      artist: { name: "Lady Gaga" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
    },
    {
      id: 9,
      title: "Stronger",
      artist: { name: "Kanye West" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3"
    },
    {
      id: 10,
      title: "Rehab",
      artist: { name: "Amy Winehouse" },
      preview: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"
    }
  ]
});

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

// Fonction helper pour les couleurs
function getPlayerColor(index) {
  const colors = [
    '#FF3366', '#00D9FF', '#FFD700', '#9D4EDD',
    '#06FFA5', '#FF6B6B', '#4ECDC4', '#FFE66D'
  ];
  return colors[index % colors.length];
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

    console.log(`🎮 Partie créée: ${roomCode} par ${socket.id}`);

    callback({ success: true, roomCode });
  });

  // 🆕 Rejoindre une partie (AVEC GESTION DISPLAY)
  socket.on('join_game', ({ roomCode, playerName }, callback) => {
    const game = games.get(roomCode);

    if (!game) {
      return callback({ success: false, error: 'Partie introuvable' });
    }

    // 🆕 Si c'est le Display, juste le connecter sans l'ajouter aux joueurs
    if (playerName && playerName.startsWith('Display-')) {
      socket.join(roomCode);
      console.log(`📺 Display connecté à ${roomCode}`);
      return callback({
        success: true,
        players: game.players
      });
    }

    // Vérifier si le joueur existe déjà (reconnexion)
    const existingPlayer = game.players.find(p => p.name === playerName);

    if (existingPlayer) {
      existingPlayer.id = socket.id;
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

    // 🆕 Utiliser la vraie playlist avec URLs de test
    const mockPlaylist = getMockPlaylist();

    game.playlist = mockPlaylist;
    game.playedTracks.clear();

    console.log(`✅ Playlist chargée: ${mockPlaylist.title} (${mockPlaylist.tracks.length} titres)`);

    callback({
      success: true,
      playlist: {
        title: mockPlaylist.title,
        trackCount: mockPlaylist.tracks.length
      }
    });
  });

  // Lancer une manche
  socket.on('start_round', ({ roomCode }, callback) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    if (!game.playlist) {
      return callback({ success: false, error: 'Pas de playlist chargée' });
    }

    console.log(`🚀 Démarrage manche pour room: ${roomCode}`);

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

    // Broadcaster à TOUTE la room
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

    console.log(`📡 Track diffusé à toute la room ${roomCode}`);

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

    io.to(roomCode).emit('stop_music');

    io.to(roomCode).emit('buzz_locked', {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color
    });

    console.log(`🔔 ${player.name} a buzzé dans ${roomCode}`);
  });

  // Valider une réponse
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

  // Passer au suivant
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
        console.log(`🗑️ Suppression de la partie ${roomCode}`);
        games.delete(roomCode);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur WebSocket sur le port ${PORT}`);
});
