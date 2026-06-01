const config = require('../config');

let oauthClient;

function getClient() {
  if (!config.GOOGLE_CLIENT_ID) return null;
  if (!oauthClient) {
    const { OAuth2Client } = require('google-auth-library');
    oauthClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  }
  return oauthClient;
}

async function verifyGoogleCredential(credential) {
  const client = getClient();
  if (!client) {
    const err = new Error('Google OAuth is not configured');
    err.status = 503;
    throw err;
  }
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: config.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    const err = new Error('Google account has no email');
    err.status = 400;
    throw err;
  }
  return {
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    photo: payload.picture || '',
    googleId: payload.sub
  };
}

module.exports = { verifyGoogleCredential };
