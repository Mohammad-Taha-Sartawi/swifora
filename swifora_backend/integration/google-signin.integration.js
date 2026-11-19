// Sign in with Google: existing accounts sign in (and get linked), a new
// customer goes straight in (phone and place come with the first order), a
// new driver completes the details for admin review; role and token checks. Real MongoDB (in-memory); Google's signature check is
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
const Order = require('../src/models/Order');

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
  app.use('/api/orders', require('../src/routes/orders'));
});

after(async () => {
  setGoogleTokenVerifierForTests(null);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

let clientIp = 0;
beforeEach(async () => {
  clientIp += 1;
  await Promise.all([User.deleteMany({}), PendingProvider.deleteMany({}), Order.deleteMany({})]);
});

const from = () => `203.0.113.${clientIp}`;
const google = (body) => request(app).post('/api/auth/google').set('X-Forwarded-For', from()).send(body);
const complete = (body) => request(app).post('/api/auth/google/complete').set('X-Forwarded-For', from()).send(body);

test('a new customer is signed in right after agreeing, with no form', async () => {
  const idToken = googleToken({ sub: 'g-cust-1', email: 'New.Customer@Example.test', name: 'New Customer' });
  const first = await google({ idToken, role: 'customer' }).expect(200);
  assert.equal(first.body.needsProfile, true);
  assert.deepEqual(first.body.profile, { fullName: 'New Customer', email: 'new.customer@example.test', role: 'customer' });
  assert.equal(await User.countDocuments(), 0);

  // The agreement is still required.
  const noTerms = await complete({ registrationToken: first.body.registrationToken }).expect(400);
  assert.equal(noTerms.body.code, 'TERMS_REQUIRED');

  // Only the token, the name from Google and the agreement.
  const done = await complete({
    registrationToken: first.body.registrationToken,
    fullName: 'New Customer',
    privacyPolicy: true,
  }).expect(201);
  assert.ok(done.body.token);
  assert.equal(done.body.user.role, 'customer');
  assert.equal(done.body.user.phone, '');
  const saved = await User.findOne({ email: 'new.customer@example.test' }).select('+password').lean();
  assert.equal(saved.googleId, 'g-cust-1');
  assert.ok(saved.publicId);
  assert.deepEqual(saved.phoneNumbers, []);
  assert.equal(saved.governorate, '');
  assert.equal(saved.area, '');
  // No usable password: password sign-in is not possible.
  assert.equal(await bcrypt.compare('', saved.password), false);

  // Next time: straight in.
  const again = await google({ idToken, role: 'customer' }).expect(200);
  assert.ok(again.body.token);
  assert.equal(again.body.user.email, 'new.customer@example.test');
});

test('a customer who does send details must send right ones', async () => {
  const idToken = googleToken({ sub: 'g-cust-2', email: 'second@example.test', name: 'Second Customer' });
  const { registrationToken } = (await google({ idToken, role: 'customer' }).expect(200)).body;

  const badPhone = await complete({ registrationToken, phone: '12', privacyPolicy: true }).expect(400);
  assert.deepEqual(badPhone.body.fields, ['phone']);
  const halfPlace = await complete({ registrationToken, governorate: 'Ramallah', privacyPolicy: true }).expect(400);
  assert.deepEqual(halfPlace.body.fields, ['area']);
  const wrongCity = await complete({ registrationToken, governorate: 'Salfit', area: 'Al-Bireh', privacyPolicy: true }).expect(400);
  assert.deepEqual(wrongCity.body.fields, ['area']);

  const done = await complete({
    registrationToken, phone: '059 123 4567', governorate: 'Ramallah', area: 'Al-Bireh', privacyPolicy: true,
  }).expect(201);
  assert.equal(done.body.user.phone, '0591234567');
  assert.equal(done.body.user.area, 'Al-Bireh');
});

test('a Google name that is not usable falls back to the email name', async () => {
  const idToken = googleToken({ sub: 'g-cust-3', email: 'sami.k@example.test', name: 'x' });
  const { registrationToken } = (await google({ idToken, role: 'customer' }).expect(200)).body;
  const done = await complete({ registrationToken, fullName: ' ', privacyPolicy: true }).expect(201);
  assert.equal(done.body.user.fullName, 'sami.k');
});

test('the first order asks for the place and saves it with the phone on the account', async () => {
  const idToken = googleToken({ sub: 'g-cust-4', email: 'orders@example.test', name: 'Order Customer' });
  const { registrationToken } = (await google({ idToken, role: 'customer' }).expect(200)).body;
  const { token } = (await complete({ registrationToken, privacyPolicy: true }).expect(201)).body;
  const order = (body) => request(app).post('/api/orders')
    .set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', from())
    .send({ type: 'product', description: 'Bread', location: 'Main street', phone: '0591234567', ...body });

  // No place on the account and none sent: refused, nothing stored.
  const noPlace = await order({}).expect(400);
  assert.equal(noPlace.body.code, 'LOCATION_REQUIRED');
  // A city from another governorate: refused.
  const wrong = await order({ governorate: 'Salfit', area: 'Al-Bireh' }).expect(400);
  assert.equal(wrong.body.code, 'LOCATION_REQUIRED');
  assert.equal(await Order.countDocuments(), 0);

  const first = await order({ governorate: 'رام الله والبيرة', area: 'Al-Bireh' }).expect(201);
  assert.equal(first.body.area, 'Al-Bireh');
  assert.equal(first.body.governorate, 'رام الله والبيرة');
  const saved = await User.findOne({ email: 'orders@example.test' }).lean();
  assert.equal(saved.governorate, 'رام الله والبيرة');
  assert.equal(saved.area, 'Al-Bireh');
  assert.deepEqual(saved.phoneNumbers.map((p) => [p.number, p.primary]), [['0591234567', true]]);

  // Later orders use the saved place; another number does not replace the account's.
  const second = await order({ phone: '0567654321', governorate: 'Salfit', area: 'Salfit' }).expect(201);
  assert.equal(second.body.area, 'Al-Bireh');
  const after = await User.findOne({ email: 'orders@example.test' }).lean();
  assert.equal(after.area, 'Al-Bireh');
  assert.deepEqual(after.phoneNumbers.map((p) => p.number), ['0591234567']);
});

test('an older account with an area and no governorate orders as before', async () => {
  await User.create({
    fullName: 'Old Customer', email: 'old@example.test', password: await bcrypt.hash('Cedar!River2026#Strong', 4),
    role: 'customer', status: 'active', area: 'Al-Bireh', publicId: '90001',
    phoneNumbers: [{ number: '0599123456', primary: true }],
  });
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-For', from())
    .send({ email: 'old@example.test', password: 'Cedar!River2026#Strong', role: 'customer' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const res = await request(app).post('/api/orders')
    .set('Authorization', `Bearer ${login.body.token}`).set('X-Forwarded-For', from())
    .send({ type: 'goods', description: 'Box', location: 'Street', phone: '0599123456' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.area, 'Al-Bireh');
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
