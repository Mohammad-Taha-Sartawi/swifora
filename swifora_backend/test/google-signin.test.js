// Sign in with Google: token checks and what an approved driver keeps.
// (Full flows: integration/google-signin.integration.js.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  configuredClientIds,
  verifyGoogleIdToken,
  setGoogleTokenVerifierForTests,
  GoogleTokenError,
} = require('../src/services/googleSignIn');

const env = { GOOGLE_OAUTH_CLIENT_IDS: ' web-1 , web-2 ,' };
const token = 'x'.repeat(40);

test('client ids come from GOOGLE_OAUTH_CLIENT_IDS', () => {
  assert.deepEqual(configuredClientIds(env), ['web-1', 'web-2']);
  assert.deepEqual(configuredClientIds({}), []);
});

test('only verified Google tokens for our clients are accepted', async (t) => {
  t.after(() => setGoogleTokenVerifierForTests(null));
  const claims = { iss: 'https://accounts.google.com', aud: 'web-2', sub: '123', email: 'a@b.test', email_verified: true, name: ' Ann ' };
  setGoogleTokenVerifierForTests(async () => claims);
  assert.deepEqual(await verifyGoogleIdToken(token, env), { sub: '123', email: 'a@b.test', name: 'Ann' });

  for (const bad of [
    { ...claims, iss: 'https://evil.example' },
    { ...claims, aud: 'someone-else' },
    { ...claims, email_verified: false },
    { ...claims, sub: '' },
  ]) {
    setGoogleTokenVerifierForTests(async () => bad);
    await assert.rejects(verifyGoogleIdToken(token, env), GoogleTokenError);
  }
  // Google's own check failing, a malformed token, or no configuration.
  setGoogleTokenVerifierForTests(async () => { throw new Error('bad signature'); });
  await assert.rejects(verifyGoogleIdToken(token, env), GoogleTokenError);
  await assert.rejects(verifyGoogleIdToken('short', env), GoogleTokenError);
  await assert.rejects(verifyGoogleIdToken(token, {}), GoogleTokenError);
});

test('an approved Google driver keeps the Google link; ids are unique', () => {
  const drivers = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'adminDrivers.js'), 'utf8');
  assert.match(drivers, /\.\.\.\(pending\.googleId \? \{ googleId: pending\.googleId \} : \{\}\)/);
  const User = require('../src/models/User');
  const index = User.schema.indexes().find(([fields]) => fields.googleId === 1);
  assert.ok(index, 'googleId index');
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { googleId: { $type: 'string' } });
});
