// Sign in with Google: existing accounts sign in (and get linked), new
// people complete their details first (drivers go to admin review), role
// and token checks. Real MongoDB (in-memory); Google's signature check is
// replaced by a stand-in that accepts our fake tokens.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'stars-integration-jwt-secret-2026-01-a';
process.env.SESSION_SECRET = 'stars-integration-session-secret-2026-02-b';
process.env.PASSWORD_RECOVERY_SECRET = 'stars-integration-recovery-secret-2026-03-c';
process.env.GOOGLE_OAUTH_CLIENT_IDS = 'web-client.apps.googleusercontent.com';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const { setGoogleTokenVerifierForTests } = require('../src/services/googleSignIn');
const authRoutes = require('../src/routes/auth');
const User = require('../src/models/User');
const PendingProvider = require('../src/models/PendingProvider');

let mongoServer;
let app;

// "Tokens" are JSON of the Google claims; the stand-in only checks the
// audience the route asks for, like Google's library would.
function googleToken(claims) {
  return `fake.${Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: 'web-client.apps.googleusercontent.com',
    email_verified: true,
    ...claims,
  })).toString('base64url')}.signature`;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_google_signin'));
  await User.syncIndexes();
  setGoogleTokenVerifierForTests(async (idToken, audience) => {
    const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
    if (!audience.includes(claims.aud)) throw new Error('wrong audience');
    return claims;
  });
  app = express();
  // Each test acts from its own address, so rate limits do not carry over.
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use('/api/auth', authRoutes);
});

after(async () => {
  setGoogleTokenVerifierForTests(null);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

let clientIp = 0;
beforeEach(async () => {
  clientIp += 1;
  await Promise.all([User.deleteMany({}), PendingProvider.deleteMany({})]);
});

const from = () => `203.0.113.${clientIp}`;
const google = (body) => request(app).post('/api/auth/google').set('X-Forwarded-For', from()).send(body);
const complete = (body) => request(app).post('/api/auth/google/complete').set('X-Forwarded-For', from()).send(body);

test('a new customer completes the details, then is signed in', async () => {
  const idToken = googleToken({ sub: 'g-cust-1', email: 'New.Customer@Example.test', name: 'New Customer' });
  const first = await google({ idToken, role: 'customer' }).expect(200);
  assert.equal(first.body.needsProfile, true);
  assert.deepEqual(first.body.profile, { fullName: 'New Customer', email: 'new.customer@example.test', role: 'customer' });
  assert.equal(await User.countDocuments(), 0);

  // Missing details and missing agreement are refused.
  const incomplete = await complete({ registrationToken: first.body.registrationToken, phone: '12' }).expect(400);
  assert.equal(incomplete.body.code, 'PROFILE_INCOMPLETE');
  assert.deepEqual(incomplete.body.fields.sort(), ['area', 'governorate', 'phone']);
  const noTerms = await complete({
    registrationToken: first.body.registrationToken, phone: '0591234567', governorate: 'Ramallah', area: 'Al-Bireh',
  }).expect(400);
  assert.equal(noTerms.body.code, 'TERMS_REQUIRED');

  const done = await complete({
    registrationToken: first.body.registrationToken,
    fullName: 'New Customer',
    phone: '059 123 4567',
    governorate: 'Ramallah',
    area: 'Al-Bireh',
    privacyPolicy: true,
  }).expect(201);
  assert.ok(done.body.token);
  assert.equal(done.body.user.role, 'customer');
  assert.equal(done.body.user.phone, '0591234567');
  const saved = await User.findOne({ email: 'new.customer@example.test' }).select('+password').lean();
  assert.equal(saved.googleId, 'g-cust-1');
  assert.ok(saved.publicId);
  // No usable password: password sign-in is not possible.
  assert.equal(await bcrypt.compare('', saved.password), false);

  // Next time: straight in.
  const again = await google({ idToken, role: 'customer' }).expect(200);
  assert.ok(again.body.token);
  assert.equal(again.body.user.email, 'new.customer@example.test');
});

test('a new driver gives phone, governorate, city and services, then waits for review', async () => {
  const idToken = googleToken({ sub: 'g-drv-1', email: 'driver@example.test', name: 'Driver One' });
  const first = await google({ idToken, role: 'provider' }).expect(200);
  assert.equal(first.body.needsProfile, true);

  const noServices = await complete({
    registrationToken: first.body.registrationToken, phone: '0591234567', governorate: 'Salfit', area: 'Salfit', privacyPolicy: true,
  }).expect(400);
  assert.deepEqual(noServices.body.fields, ['serviceTypes']);

  const done = await complete({
    registrationToken: first.body.registrationToken,
    phone: '0591234567',
    governorate: 'Salfit',
    area: 'Salfit',
    serviceTypes: ['product', 'goods', 'bogus'],
    privacyPolicy: true,
  }).expect(201);
  assert.equal(done.body.pending, true);
  assert.equal(done.body.token, undefined);
  const pending = await PendingProvider.findOne({ email: 'driver@example.test' }).lean();
  assert.equal(pending.googleId, 'g-drv-1');
  assert.deepEqual(pending.serviceTypes, ['product', 'goods']);
  assert.equal(pending.governorate, 'Salfit');
  assert.equal(await User.countDocuments(), 0);

  // Signing in again before approval: "under review".
  const waiting = await google({ idToken, role: 'provider' }).expect(200);
  assert.equal(waiting.body.pending, true);
  assert.equal(waiting.body.code, 'ACCOUNT_PENDING_APPROVAL');
});

test('an existing email account signs in with Google and gets linked', async () => {
  await User.create({
    fullName: 'Existing',
    email: 'existing@example.test',
    password: await bcrypt.hash('Cedar!River2026#Strong', 4),
    role: 'customer',
    phoneNumbers: [{ number: '0590000001', primary: true }],
  });
  const res = await google({
    idToken: googleToken({ sub: 'g-existing', email: 'existing@example.test' }),
    role: 'customer',
  }).expect(200);
  assert.ok(res.body.token);
  assert.equal((await User.findOne({ email: 'existing@example.test' }).lean()).googleId, 'g-existing');

  // The wrong role is refused with a clear message.
  const asDriver = await google({
    idToken: googleToken({ sub: 'g-existing', email: 'existing@example.test' }),
    role: 'provider',
  }).expect(400);
  assert.equal(asDriver.body.code, 'ROLE_MISMATCH');

  // Another Google account with the same email cannot take it over.
  const other = await google({
    idToken: googleToken({ sub: 'g-someone-else', email: 'existing@example.test' }),
    role: 'customer',
  }).expect(409);
  assert.equal(other.body.code, 'GOOGLE_ACCOUNT_MISMATCH');
});

test('unverified emails, wrong audiences and forged registrations are refused', async () => {
  const unverified = await google({
    idToken: googleToken({ sub: 'g-x', email: 'x@example.test', email_verified: false }),
    role: 'customer',
  }).expect(401);
  assert.equal(unverified.body.code, 'GOOGLE_TOKEN_INVALID');

  await google({
    idToken: googleToken({ sub: 'g-y', email: 'y@example.test', aud: 'someone-else' }),
    role: 'customer',
  }).expect(401);


  // A registration token signed with another secret, or a normal session
  // token, cannot create accounts.
  const forged = jwt.sign({ purpose: 'google-registration', sub: 's', email: 'f@example.test', role: 'customer' }, 'not-the-secret');
  await complete({ registrationToken: forged, phone: '0591234567', governorate: 'G', area: 'A', privacyPolicy: true }).expect(401);
  const sessionLike = jwt.sign({ id: 'x', role: 'customer' }, process.env.JWT_SECRET);
  await complete({ registrationToken: sessionLike, phone: '0591234567', governorate: 'G', area: 'A', privacyPolicy: true }).expect(401);
  assert.equal(await User.countDocuments(), 0);
});

test('not configured: Google sign-in says so', async () => {
  const saved = process.env.GOOGLE_OAUTH_CLIENT_IDS;
  process.env.GOOGLE_OAUTH_CLIENT_IDS = '';
  try {
    const res = await google({ idToken: googleToken({ sub: 'g', email: 'g@example.test' }), role: 'customer' }).expect(503);
    assert.equal(res.body.code, 'GOOGLE_NOT_CONFIGURED');
  } finally {
    process.env.GOOGLE_OAUTH_CLIENT_IDS = saved;
  }
});

test('repeated failed Google sign-ins are rate limited', async () => {
  let limited = false;
  for (let i = 0; i < 30 && !limited; i += 1) {
    const res = await google({ idToken: 'short', role: 'customer' });
    assert.ok([401, 429].includes(res.status), String(res.status));
    limited = res.status === 429;
  }
  assert.equal(limited, true);
});
