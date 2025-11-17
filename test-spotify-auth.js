require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');

console.log('🔍 Test des credentials Spotify\n');

console.log('Credentials chargés:');
console.log('- SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? `✅ (${process.env.SPOTIFY_CLIENT_ID.length} caractères)` : '❌ MANQUANT');
console.log('- SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? `✅ (${process.env.SPOTIFY_CLIENT_SECRET.length} caractères)` : '❌ MANQUANT');
console.log('');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

console.log('Tentative d\'authentification...\n');

spotifyApi.clientCredentialsGrant()
  .then(data => {
    console.log('✅ AUTHENTIFICATION RÉUSSIE!');
    console.log('Token:', data.body['access_token'].substring(0, 20) + '...');
    console.log('Expire dans:', data.body['expires_in'], 'secondes');
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ AUTHENTIFICATION ÉCHOUÉE\n');
    console.log('Erreur:', error.message);
    console.log('Status Code:', error.statusCode);
    if (error.body) {
      console.log('Détails:', JSON.stringify(error.body, null, 2));
    }
    console.log('\n📋 Actions à faire:');
    console.log('1. Vérifiez vos credentials sur https://developer.spotify.com/dashboard');
    console.log('2. Assurez-vous de copier Client ID et Client Secret correctement');
    console.log('3. Pas d\'espaces avant/après dans le .env');
    console.log('4. Format: SPOTIFY_CLIENT_ID=abc123... (sans guillemets)');
    process.exit(1);
  });
