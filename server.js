require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const games = new Map();
const TOTAL_BUZZER_SOUNDS = 23;
const ANSWER_TIMEOUT = 8000; // 8 secondes pour répondre

app.get('/health', (req, res) => {
  res.json({ status: 'ok', games: games.size });
});

io.on('connection', (socket) => {
  console.log('✅ Client connecté:', socket.id);

  // Créer une partie (Hôte/Contrôle MC)
  socket.on('create_game', (callback) => {
    const roomCode = generateRoomCode();
    const game = {
      roomCode,
      hostId: socket.id,
      displayId: null,
      players: [],
      status: 'waiting',
      currentRound: null,
      playlist: null,
      createdAt: Date.now(),
      usedBuzzerSounds: [],
      answerTimer: null, // Timer pour le timeout de réponse
      warningTimer: null // Timer pour le warning à 4s
    };

    games.set(roomCode, game);
    socket.join(roomCode);

    console.log('🎮 Partie créée:', roomCode, 'par hôte:', socket.id);
    callback({ success: true, roomCode });
  });

  // Rejoindre en tant que Display (TV)
  socket.on('join_as_display', ({ roomCode }, callback) => {
    const game = games.get(roomCode);

    if (!game) {
      console.log('❌ Display: Partie introuvable:', roomCode);
      return callback({ success: false, error: 'Partie introuvable' });
    }

    game.displayId = socket.id;
    socket.join(roomCode);

    console.log('📺 Display rejoint la partie:', roomCode);
    callback({ success: true, players: game.players });

    // Envoyer l'état initial au display
    if (game.currentRound) {
      socket.emit('display_track', game.currentRound.track);
    }
  });

  // Rejoindre en tant que joueur
  socket.on('join_game', ({ roomCode, playerName }, callback) => {
    const game = games.get(roomCode);

    if (!game) {
      console.log('❌ Partie introuvable:', roomCode);
      return callback({ success: false, error: 'Partie introuvable' });
    }

    if (game.status !== 'waiting') {
      console.log('❌ Partie déjà commencée');
      return callback({ success: false, error: 'Partie déjà commencée' });
    }

    const buzzerSound = getRandomUnusedBuzzerSound(game.usedBuzzerSounds);
    game.usedBuzzerSounds.push(buzzerSound);

    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      buzzerSound: buzzerSound
    };

    game.players.push(player);
    socket.join(roomCode);

    // Notifier tout le monde (hôte, display, joueurs)
    io.to(roomCode).emit('player_joined', {
      players: game.players
    });

    console.log('👤 ' + playerName + ' a rejoint (buzzer #' + buzzerSound + ')');
    callback({
      success: true,
      players: game.players,
      buzzerSound: buzzerSound
    });
  });

  // Charger playlist
  socket.on('load_playlist', async ({ roomCode, playlistId }, callback) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    try {
      console.log('🎵 Chargement playlist:', playlistId);
      const playlist = await fetchDeezerPlaylist(playlistId);
      game.playlist = playlist;

      console.log('✅ Playlist chargée:', playlist.title);
      callback({ success: true, playlist: { title: playlist.title, trackCount: playlist.tracks.length } });
    } catch (error) {
      console.error('❌ Erreur chargement playlist:', error.message);
      callback({ success: false, error: 'Erreur chargement playlist' });
    }
  });

  // Lancer une manche
  socket.on('start_round', ({ roomCode }, callback) => {
    const game = games.get(roomCode);

    console.log('🚀 Lancement manche pour:', roomCode);

    if (!game || game.hostId !== socket.id) {
      return callback({ success: false, error: 'Non autorisé' });
    }

    if (!game.playlist || game.playlist.tracks.length === 0) {
      return callback({ success: false, error: 'Pas de playlist chargée' });
    }

    const randomIndex = Math.floor(Math.random() * game.playlist.tracks.length);
    const track = game.playlist.tracks[randomIndex];

    game.currentRound = {
      track,
      buzzedPlayer: null,
      startTime: Date.now(),
      audioPaused: false
    };

    game.status = 'playing';

    console.log('🎵 Track:', track.title, '-', track.artist.name);

    // Envoyer l'audio ET les infos du track au contrôle MC (hôte)
    socket.emit('play_track', {
      previewUrl: track.preview,
      duration: 30,
      title: track.title,
      artist: track.artist.name
    });

    // Envoyer les infos du track au display (TV) - SANS titre/artiste
    if (game.displayId) {
      io.to(game.displayId).emit('display_track', {
        // Pas de titre/artiste, juste l'état
      });
    }

    // Notifier tous les joueurs que la manche commence
    io.to(roomCode).emit('round_started');

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

    const buzzData = {
      playerId: player.id,
      playerName: player.name,
      buzzerSound: player.buzzerSound
    };

    // ✅ PAUSE L'AUDIO côté hôte
    io.to(game.hostId).emit('pause_audio');

    // ✅ TIMER DE WARNING À 4 SECONDES
    const warningTimer = setTimeout(() => {
      const currentGame = games.get(roomCode);
      if (currentGame && currentGame.currentRound && currentGame.currentRound.buzzedPlayer === player.id) {
        io.to(roomCode).emit('timeout_warning', { secondsLeft: 4 });
        console.log('⚠️ Warning: 4 secondes restantes pour', player.name);
      }
    }, 4000); // 4 secondes

    // ✅ DÉMARRER LE TIMER DE 8 SECONDES
    // ANNULER le timer précédent s'il existe
    if (game.answerTimer) {
      clearTimeout(game.answerTimer);
    }
    if (game.warningTimer) {
      clearTimeout(game.warningTimer);
    }
    
    game.warningTimer = warningTimer;
    
    game.answerTimer = setTimeout(() => {
      console.log('⏱️ Timeout réponse pour', player.name);
      
      // ✅ VÉRIFIER QUE LE JOUEUR N'A PAS ÉTÉ RÉINITIALISÉ
      const currentGame = games.get(roomCode);
      if (currentGame && currentGame.currentRound && currentGame.currentRound.buzzedPlayer === player.id) {
        // Mauvaise réponse automatique après 8 secondes
        handleTimeoutResponse(currentGame, roomCode, player.id);
      }
    }, ANSWER_TIMEOUT);

    // Envoyer à tout le monde (avec timer de 8s)
    io.to(roomCode).emit('buzz_locked', {
      ...buzzData,
      answerTimeout: ANSWER_TIMEOUT
    });

    console.log('⚡ ' + player.name + ' a buzzé (son #' + player.buzzerSound + ') - 8s pour répondre');
  });

  // Valider réponse
  socket.on('validate_answer', ({ roomCode, isCorrect }) => {
    const game = games.get(roomCode);

    if (!game || game.hostId !== socket.id || !game.currentRound) {
      return;
    }

    // ✅ ANNULER LES TIMERS si l'hôte valide avant le timeout
    if (game.answerTimer) {
      clearTimeout(game.answerTimer);
      game.answerTimer = null;
    }
    if (game.warningTimer) {
      clearTimeout(game.warningTimer);
      game.warningTimer = null;
    }

    const player = game.players.find(p => p.id === game.currentRound.buzzedPlayer);
    if (!player) return;

    // ✅ SI MAUVAISE RÉPONSE : continuer la manche pour les autres
    if (!isCorrect) {
      player.score -= 5;
      game.players.sort((a, b) => b.score - a.score);

      // Réinitialiser le buzzer pour permettre aux autres de jouer
      game.currentRound.buzzedPlayer = null;
      game.status = 'playing';

      // ✅ DÉLAI DE 2 SECONDES avant de relancer l'audio
      setTimeout(() => {
        const currentGame = games.get(roomCode);
        if (currentGame && currentGame.status === 'playing') {
          io.to(game.hostId).emit('resume_audio');
        }
      }, 2000);

      // Notifier tous les joueurs qu'ils peuvent buzzer à nouveau
      io.to(roomCode).emit('wrong_answer_continue', {
        playerName: player.name,
        points: -5,
        message: 'Mauvaise réponse ! Continuez à écouter...'
      });

      console.log('❌ Mauvaise réponse de', player.name, '- Manche continue');
      return;
    }

    // ✅ SI BONNE RÉPONSE : terminer la manche
    handleAnswerValidation(game, roomCode, isCorrect, false);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);

    games.forEach((game, roomCode) => {
      // Si c'est le display qui se déconnecte
      if (game.displayId === socket.id) {
        game.displayId = null;
        console.log('📺 Display déconnecté de', roomCode);
      }

      // Si c'est un joueur
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];

        const soundIndex = game.usedBuzzerSounds.indexOf(player.buzzerSound);
        if (soundIndex > -1) {
          game.usedBuzzerSounds.splice(soundIndex, 1);
        }

        game.players.splice(playerIndex, 1);

        io.to(roomCode).emit('player_left', {
          playerName: player.name,
          players: game.players
        });

        console.log('👋 ' + player.name + ' a quitté');
      }

      // Si c'est l'hôte
      if (game.hostId === socket.id) {
        // Nettoyer le timer si il existe
        if (game.answerTimer) {
          clearTimeout(game.answerTimer);
        }
        if (game.warningTimer) {
          clearTimeout(game.warningTimer);
        }
        
        io.to(roomCode).emit('game_ended', { reason: 'host_disconnected' });
        games.delete(roomCode);
        console.log('🗑️  Partie ' + roomCode + ' supprimée');
      }
    });
  });
});

// ✅ FONCTION HELPER POUR GÉRER LES TIMEOUTS
function handleTimeoutResponse(game, roomCode, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return;

  player.score -= 5;
  game.players.sort((a, b) => b.score - a.score);

  // Réinitialiser le buzzer pour permettre aux autres de jouer
  game.currentRound.buzzedPlayer = null;
  game.status = 'playing';

  // Relancer l'audio
  io.to(game.hostId).emit('resume_audio');

  // Notifier tous les joueurs qu'ils peuvent buzzer à nouveau
  io.to(roomCode).emit('timeout_continue', {
    playerName: player.name,
    points: -5,
    message: 'Temps écoulé ! La manche continue...'
  });

  console.log('⏱️ Timeout de', player.name, '(-5 pts) - Manche continue');
}

// ✅ FONCTION HELPER POUR VALIDER UNE RÉPONSE
function handleAnswerValidation(game, roomCode, isCorrect, isTimeout) {
  const player = game.players.find(p => p.id === game.currentRound.buzzedPlayer);
  if (!player) return;

  const basePoints = isCorrect ? 10 : -5;
  const timeBonus = isCorrect ? Math.floor((30000 - (game.currentRound.buzzTime - game.currentRound.startTime)) / 1000) * 0.5 : 0;
  const points = Math.round(basePoints + timeBonus);

  player.score += points;
  game.players.sort((a, b) => b.score - a.score);

  const resultData = {
    playerId: player.id,
    playerName: player.name,
    isCorrect,
    isTimeout, // Indique si c'est un timeout
    points,
    correctAnswer: {
      title: game.currentRound.track.title,
      artist: game.currentRound.track.artist.name
    },
    leaderboard: game.players.map(p => ({
      name: p.name,
      score: p.score
    }))
  };

  // Envoyer le résultat à tout le monde
  io.to(roomCode).emit('round_result', resultData);

  console.log('📊 Résultat:', player.name, isCorrect ? '✅' : '❌', points + 'pts', isTimeout ? '(timeout)' : '');

  game.currentRound = null;
  game.status = 'waiting';
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;

  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (games.has(code));

  return code;
}

function getRandomUnusedBuzzerSound(usedSounds) {
  const availableSounds = [];

  for (let i = 1; i <= TOTAL_BUZZER_SOUNDS; i++) {
    if (!usedSounds.includes(i)) {
      availableSounds.push(i);
    }
  }

  if (availableSounds.length === 0) {
    return Math.floor(Math.random() * TOTAL_BUZZER_SOUNDS) + 1;
  }

  const randomIndex = Math.floor(Math.random() * availableSounds.length);
  return availableSounds[randomIndex];
}

async function fetchDeezerPlaylist(playlistId) {
  const response = await axios.get('https://api.deezer.com/playlist/' + playlistId);

  return {
    title: response.data.title,
    tracks: response.data.tracks.data.map(track => ({
      id: track.id,
      title: track.title,
      artist: {
        name: track.artist.name
      },
      preview: track.preview
    }))
  };
}

setInterval(() => {
  const now = Date.now();
  games.forEach((game, roomCode) => {
    if (game.players.length === 0 && now - (game.createdAt || now) > 300000) {
      // Nettoyer le timer si il existe
      if (game.answerTimer) {
        clearTimeout(game.answerTimer);
      }
      if (game.warningTimer) {
        clearTimeout(game.warningTimer);
      }
      games.delete(roomCode);
      console.log('🗑️  Partie ' + roomCode + ' supprimée (inactive)');
    }
  });
}, 300000);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('🎵 Serveur Blind Test démarré sur le port ' + PORT);
  console.log('   ✅ Timer de réponse: 8 secondes');
  console.log('   ✅ Warning à 4 secondes');
  console.log('   ✅ Pause audio sur buzzer');
  console.log('   ✅ Timeout automatique');
  console.log('   Architecture: Display + Contrôle MC + Joueurs');
});
