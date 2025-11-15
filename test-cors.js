// Test CORS Deezer - Vérification si on a besoin du proxy

const axios = require('axios');

async function testDeezerCORS() {
  try {
    console.log('🔍 Récupération d\'une playlist Deezer...');

    // Récupérer une playlist (Top France par exemple)
    const response = await axios.get('https://api.deezer.com/playlist/1963962142', {
      timeout: 10000
    });

    if (!response.data || !response.data.tracks) {
      console.log('❌ Playlist vide');
      return;
    }

    const tracks = response.data.tracks.data.filter(t => t.preview);

    if (tracks.length === 0) {
      console.log('❌ Aucune preview disponible');
      return;
    }

    const track = tracks[0];
    console.log(`\n📀 Track test: ${track.title} - ${track.artist.name}`);
    console.log(`🔗 Preview URL: ${track.preview}\n`);

    // Tester le CORS sur l'URL de preview
    console.log('🧪 Test CORS sur l\'URL de preview...');

    try {
      const previewResponse = await axios.head(track.preview, {
        timeout: 5000
      });

      console.log('✅ Status:', previewResponse.status);
      console.log('📋 Headers CORS:');
      console.log('   - Access-Control-Allow-Origin:',
        previewResponse.headers['access-control-allow-origin'] || '❌ ABSENT');
      console.log('   - Access-Control-Allow-Methods:',
        previewResponse.headers['access-control-allow-methods'] || '❌ ABSENT');

      const hasCORS = !!previewResponse.headers['access-control-allow-origin'];

      console.log('\n' + '='.repeat(60));
      if (hasCORS) {
        console.log('✅ CORS ACTIVÉ - Ton ami a raison !');
        console.log('💡 Tu peux utiliser les URLs directement, sans proxy');
      } else {
        console.log('❌ CORS DÉSACTIVÉ - Le proxy est nécessaire');
        console.log('💡 Il faut garder l\'architecture actuelle avec proxy');
      }
      console.log('='.repeat(60));

    } catch (error) {
      console.log('❌ Erreur lors du test CORS:', error.message);
      console.log('⚠️  Le proxy est probablement nécessaire');
    }

  } catch (error) {
    console.log('❌ Erreur API Deezer:', error.message);
  }
}

testDeezerCORS();
