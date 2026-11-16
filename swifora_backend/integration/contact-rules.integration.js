// Sign-up only with a real mobile number and a complete, real email:
// wrong numbers, incomplete emails, misspelled providers and domains that
// do not receive mail are refused; good ones (also typed with spaces or
// Arabic digits) are stored cleaned. Sign-in is not affected. Real HTTP and
// MongoDB (in-memory); DNS is replaced by a stand-in.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'stars-integration-jwt-secret-2026-01-a';
process.env.SESSION_SECRET = 'stars-integration-session-secret-2026-02-b';
process.env.PASSWORD_RECOVERY_SECRET = 'stars-integration-recovery-secret-2026-03-c';

const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const { setEmailDomainLookupForTests } = require('../src/services/emailCheck');
const authRoutes = require('../src/routes/auth');
const User = require('../src/models/User');
const PendingProvider = require('../src/models/PendingProvider');

const PASSWORD = 'Cedar!River2026#Strong';
const MAIL_DOMAINS = new Set(['gmail.com', 'swifora-mail.ps']);
const lookups = [];

let mongoServer;
let app;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_contact_rules'));
  app = express();
  // Each test acts from its own address, so rate limits do not carry over.
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use('/api/auth', authRoutes);
});

after(async () => {
  setEmailDomainLookupForTests(null);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  lookups.length = 0;
  setEmailDomainLookupForTests(async (domain) => {
    lookups.push(domain);
    if (domain === 'slow-dns.ps') return 'unknown';
    return MAIL_DOMAINS.has(domain) ? 'ok' : 'missing';
  });
  await Promise.all([User.deleteMany({}), PendingProvider.deleteMany({})]);
});

// Sign-up allows 5 attempts per address: every request comes from a new one.
let requestCount = 0;
const nextAddress = () => {
  requestCount += 1;
  return `198.51.${Math.floor(requestCount / 250)}.${(requestCount % 250) + 1}`;
};

const register = (fields) => request(app)
  .post('/api/auth/register')
  .set('X-Forwarded-For', nextAddress())
  .send({
    fullName: 'New Customer',
    email: 'new.customer@gmail.com',
    phone: '0599123456',
    password: PASSWORD,
    role: 'customer',
    area: 'Ramallah',
    privacyPolicy: true,
    ...fields,
  });

test('wrong or missing phone numbers are refused', async () => {
  for (const phone of [
    undefined, '', '12345', '0599', '059912345', '05991234567',
    '0499123456', '0222981234', '+1 202 555 0143', '0590000000',
    'abcdefghij', '+970 499 123 456',
  ]) {
    const res = await register({ phone });
    assert.equal(res.status, 400, `accepted ${phone}`);
    assert.equal(res.body.code, 'INVALID_PHONE', `${phone}: ${res.body.error}`);
  }
  assert.equal(await User.countDocuments(), 0);
});

test('valid numbers are stored cleaned (spaces, Arabic digits, 00)', async () => {
  const cases = [
    ['059 912-3456', '0599123456', 'a1@gmail.com'],
    ['٠٥٦٨١٢٣٤٥٦', '0568123456', 'a2@gmail.com'],
    ['00970 59 912 3457', '+970599123457', 'a3@gmail.com'],
    ['+972 52 712 3456', '+972527123456', 'a4@gmail.com'],
  ];
  for (const [typed, stored, email] of cases) {
    const res = await register({ phone: typed, email });
    assert.equal(res.status, 201, `${typed}: ${res.body.error}`);
    assert.equal(res.body.user.phone, stored);
    const user = await User.findOne({ email }).lean();
    assert.equal(user.phoneNumbers[0].number, stored);
  }
});

test('incomplete emails are refused before any DNS lookup', async () => {
  for (const email of [
    'name', 'name@', 'name@gmail', '@gmail.com', 'name@.com', '.name@gmail.com',
    'name.@gmail.com', 'na..me@gmail.com', 'name@gmail..com', 'name@-gmail.com',
    'name@gmail.c', 'name@gmail.123', 'name gmail.com',
  ]) {
    const res = await register({ email });
    assert.equal(res.status, 400, `accepted ${email}`);
  }
  assert.deepEqual(lookups, []);
  assert.equal(await User.countDocuments(), 0);
});

test('a misspelled provider gets the right address suggested', async () => {
  const res = await register({ email: 'Ahmad@Gmail.con' });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'EMAIL_DOMAIN_TYPO');
  assert.equal(res.body.suggestion, 'ahmad@gmail.com');
  assert.match(res.body.error, /ahmad@gmail\.com/);
});

test('a domain that does not receive mail is refused', async () => {
  const res = await register({ email: 'someone@no-such-domain-xyz.com' });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'EMAIL_DOMAIN_NOT_FOUND');
  assert.deepEqual(lookups, ['no-such-domain-xyz.com']);
  assert.equal(await User.countDocuments(), 0);
});

test('a real domain is accepted, and a DNS outage does not block sign-up', async () => {
  const ok = await register({ email: 'owner@swifora-mail.ps' });
  assert.equal(ok.status, 201, ok.body.error);
  const slow = await register({ email: 'owner@slow-dns.ps', phone: '0599123458' });
  assert.equal(slow.status, 201, slow.body.error);
});

test('drivers follow the same rules', async () => {
  const bad = await register({ role: 'provider', phone: '0590', serviceTypes: ['goods'] });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'INVALID_PHONE');
  const good = await register({
    role: 'provider',
    email: 'driver@gmail.com',
    phone: '0567 123 456',
    serviceTypes: ['goods'],
  });
  assert.equal(good.status, 201, good.body.error);
  const pending = await PendingProvider.findOne({ email: 'driver@gmail.com' }).lean();
  assert.equal(pending.phone, '0567123456');
});

test('sign-in still works for an older account with a non-matching email', async () => {
  await User.create({
    fullName: 'Old Account',
    email: 'old@legacy-domain.test',
    password: await bcrypt.hash(PASSWORD, 4),
    role: 'customer',
    status: 'active',
    phoneNumbers: [{ number: '123456', primary: true }],
  });
  const res = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', nextAddress())
    .send({ email: 'old@legacy-domain.test', password: PASSWORD, role: 'customer' });
  assert.equal(res.status, 200, res.body.error);
  assert.deepEqual(lookups, []);
});
