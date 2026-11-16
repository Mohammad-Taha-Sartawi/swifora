// Sign in with Google for the mobile apps.
//
// The app gets an ID token from Google (requested for our web OAuth client
// ID) and sends it here. We accept it only when Google's signature checks
// out, it was issued for one of our client IDs (GOOGLE_OAUTH_CLIENT_IDS,
// comma-separated) and the email is verified by Google.
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

function configuredClientIds(env = process.env) {
  return String(env.GOOGLE_OAUTH_CLIENT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isGoogleSignInConfigured(env = process.env) {
  return configuredClientIds(env).length > 0;
}

class GoogleTokenError extends Error {}

let client = null;
let verifierForTests = null;

/** Tests replace Google's check with their own (never in production). */
function setGoogleTokenVerifierForTests(fn) {
  verifierForTests = fn;
}

/**
 * Returns { sub, email, name } for a valid Google ID token, or throws
 * GoogleTokenError.
 */
async function verifyGoogleIdToken(idToken, env = process.env) {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) {
    throw new GoogleTokenError('Invalid Google token');
  }
  const audience = configuredClientIds(env);
  if (audience.length === 0) throw new GoogleTokenError('Google sign-in is not configured');

  let payload;
  try {
    if (verifierForTests) {
      payload = await verifierForTests(idToken, audience);
    } else {
      client = client || new OAuth2Client();
      const ticket = await client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    }
  } catch (_) {
    throw new GoogleTokenError('Invalid Google token');
  }

  if (
    !payload
    || !GOOGLE_ISSUERS.has(payload.iss)
    || !audience.includes(payload.aud)
    || typeof payload.sub !== 'string'
    || !payload.sub
  ) {
    throw new GoogleTokenError('Invalid Google token');
  }
  if (payload.email_verified !== true || typeof payload.email !== 'string') {
    throw new GoogleTokenError('Google email is not verified');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 80) : '',
  };
}

module.exports = {
  configuredClientIds,
  isGoogleSignInConfigured,
  verifyGoogleIdToken,
  setGoogleTokenVerifierForTests,
  GoogleTokenError,
};
