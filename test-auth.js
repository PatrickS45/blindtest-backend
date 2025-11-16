// Test simple d'authentification Spotify
require('dotenv').config();
const axios = require('axios');

async function testAuth() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log('📋 Credentials loaded:');
  console.log('Client ID:', clientId);
  console.log('Client Secret:', clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING');

  if (!clientId || !clientSecret) {
    console.error('\n❌ Credentials manquants dans .env!');
    return;
  }

  console.log('\n🔑 Tentative d\'authentification...\n');

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ SUCCÈS! Token obtenu:');
    console.log('Token:', response.data.access_token.substring(0, 30) + '...');
    console.log('Expire dans:', response.data.expires_in, 'secondes');
    console.log('\n🎉 Les credentials Spotify sont VALIDES!\n');

  } catch (error) {
    console.error('❌ ÉCHEC de l\'authentification\n');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data);
      console.error('\n💡 Solutions possibles:');
      console.error('   1. Vérifiez le Client Secret sur le dashboard Spotify');
      console.error('   2. Copiez-collez à nouveau les credentials');
      console.error('   3. Assurez-vous qu\'il n\'y a pas d\'espaces en trop');
    } else {
      console.error('Erreur:', error.message);
    }
  }
}

testAuth();
