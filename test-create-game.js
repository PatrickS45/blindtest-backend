// Test de création de partie via Socket.IO
const io = require('socket.io-client');

console.log('🧪 Test de création de partie\n');

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connecté au backend');
  console.log('   Socket ID:', socket.id);
  
  console.log('\n📤 Envoi de create_game...');
  socket.emit('create_game', { 
    mode: 'accumul_points',
    config: {
      extractDuration: 30,
      timerDuration: 10
    }
  }, (response) => {
    console.log('📥 Réponse reçue:', JSON.stringify(response, null, 2));
    
    if (response.success) {
      console.log('\n✅ PARTIE CRÉÉE AVEC SUCCÈS !');
      console.log('   Room Code:', response.roomCode);
      console.log('   Mode:', response.mode);
    } else {
      console.log('\n❌ ÉCHEC DE CRÉATION');
      console.log('   Erreur:', response.error);
    }
    
    socket.disconnect();
    process.exit(response.success ? 0 : 1);
  });
});

socket.on('connect_error', (error) => {
  console.log('❌ Erreur de connexion:', error.message);
  process.exit(1);
});

socket.on('error', (error) => {
  console.log('❌ Erreur Socket.IO:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏱️  Timeout - Pas de réponse du serveur');
  process.exit(1);
}, 5000);
