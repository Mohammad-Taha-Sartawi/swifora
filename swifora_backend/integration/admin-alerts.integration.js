// Dashboard alerts on the admins' devices (Web Push): a browser subscribes
// for the signed-in admin, and a new support message, driver sign-up,
// report or deletion request sends it a notification that carries only the
// kind of item. Inactive admins and devices from before "sign out
// everywhere" get nothing; subscriptions the browser dropped are removed.
// The push service is a recording stand-in.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-alerts';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-alerts';
process.env.PASSWORD_RECOVERY_SECRET = 'swifora-integration-recovery-secret-2026-11-alerts';
process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'BTestPublicKeyForIntegrationOnly_abcdefghijklmnopqrstuvwxyz0123456789';
process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'test-private-key-integration-only';

const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const Admin = require('../src/models/Admin');
const User = require('../src/models/User');
const AdminPushSubscription = require('../src/models/AdminPushSubscription');
const alerts = require('../src/services/adminAlerts');

const PASSWORD = 'Cedar!River2026#Strong';
const P256DH = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const AUTH = 'tBHItJI5svbpez7KI4CCXg';
let mongoServer;
let app;
let ip = 0;
const from = () => { ip += 1; return `198.51.100.${ip}`; };
const pushes = [];
let failWith = null;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '8.2.6', downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries') },
  });
  await mongoose.connect(mongoServer.getUri('swifora_admin_alerts'));
  await Promise.all([Admin.init(), User.init(), AdminPushSubscription.init()]);
  app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/users', require('../src/routes/users'));
  app.use('/api/chat', require('../src/routes/chat'));
  app.use('/api/reports', require('../src/routes/reports'));
  // The admin session and CSRF checks have their own tests; here a header
  // names the signed-in admin.
  app.use('/admin/push', async (req, res, next) => {
    const admin = await Admin.findById(req.get('x-test-admin')).lean();
    if (!admin) return res.status(401).end();
    req.adminUser = { id: String(admin._id), sessionVersion: admin.sessionVersion || 0 };
    return next();
  }, require('../src/routes/adminPush'));

  alerts.setSenderForTesting(async (subscription, payload, options) => {
    if (failWith) throw failWith;
    pushes.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload), options });
  });
});

after(async () => {
  alerts.resetForTesting();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  pushes.length = 0;
  failWith = null;
  alerts.resetForTesting();
  alerts.setSenderForTesting(async (subscription, payload, options) => {
    if (failWith) throw failWith;
    pushes.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload), options });
  });
  await Promise.all([Admin.deleteMany({}), User.deleteMany({}), AdminPushSubscription.deleteMany({})]);
  await mongoose.connection.collection('pendingproviders').deleteMany({});
});

let adminNo = 0;
async function admin(extra = {}) {
  adminNo += 1;
  return Admin.create({
    fullName: `Admin ${adminNo}`,
    email: `admin${adminNo}@example.test`,
    password: 'x',
    ...extra,
  });
}

const endpoint = (name) => `https://fcm.googleapis.com/fcm/send/${name}`;
const subscribe = (who, name) => request(app).post('/admin/push/subscriptions')
  .set('x-test-admin', String(who._id))
  .send({ endpoint: endpoint(name), keys: { p256dh: P256DH, auth: AUTH } });

async function waitForPushes(count) {
  for (let i = 0; i < 100 && pushes.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  // Give a wrong extra push the chance to show up too.
  await new Promise((resolve) => setTimeout(resolve, 60));
  return pushes;
}

async function customer(email = 'c1@example.test') {
  const user = await User.create({
    fullName: 'Customer One',
    email,
    password: await bcrypt.hash(PASSWORD, 4),
    role: 'customer',
    status: 'active',
    area: 'Al-Bireh',
    governorate: 'رام الله والبيرة',
    publicId: String(80000 + Math.floor(Math.random() * 9999)),
    phoneNumbers: [{ number: '0599123456', primary: true }],
  });
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-For', from())
    .send({ email, password: PASSWORD, role: 'customer' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { user, as: (req) => req.set('Authorization', `Bearer ${login.body.token}`).set('X-Forwarded-For', from()) };
}

test('a browser subscribes, re-subscribes and unsubscribes for its admin', async () => {
  const a = await admin();
  const b = await admin();

  const config = await request(app).get('/admin/push/config').set('x-test-admin', String(a._id)).expect(200);
  assert.equal(config.body.enabled, true);
  assert.equal(config.body.publicKey, process.env.WEB_PUSH_VAPID_PUBLIC_KEY);

  await subscribe(a, 'device-1').expect(201);
  await subscribe(a, 'device-1').expect(200);
  assert.equal(await AdminPushSubscription.countDocuments(), 1);

  // Another admin cannot remove it.
  await request(app).delete('/admin/push/subscriptions').set('x-test-admin', String(b._id))
    .send({ endpoint: endpoint('device-1') }).expect(200);
  assert.equal(await AdminPushSubscription.countDocuments(), 1);

  await request(app).delete('/admin/push/subscriptions').set('x-test-admin', String(a._id))
    .send({ endpoint: endpoint('device-1') }).expect(200);
  assert.equal(await AdminPushSubscription.countDocuments(), 0);
});

test('only real push services are accepted as the address to send to', async () => {
  const a = await admin();
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://127.0.0.1/push',
    'https://internal.example.test/push',
    'https://fcm.googleapis.com.evil.test/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
  ]) {
    const res = await request(app).post('/admin/push/subscriptions').set('x-test-admin', String(a._id))
      .send({ endpoint: bad, keys: { p256dh: P256DH, auth: AUTH } });
    assert.equal(res.status, 400, bad);
    assert.equal(res.body.code, 'INVALID_SUBSCRIPTION');
  }
  const noKeys = await request(app).post('/admin/push/subscriptions').set('x-test-admin', String(a._id))
    .send({ endpoint: endpoint('k'), keys: { p256dh: 'short', auth: AUTH } });
  assert.equal(noKeys.status, 400);
  for (const good of [
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QABC',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) {
    const res = await request(app).post('/admin/push/subscriptions').set('x-test-admin', String(a._id))
      .send({ endpoint: good, keys: { p256dh: P256DH, auth: AUTH } });
    assert.equal(res.status, 201, good);
  }
});

test('a support message alerts active admins only, without its text', async () => {
  const active = await admin();
  const inactive = await admin({ status: 'inactive' });
  const signedOutEverywhere = await admin();
  await subscribe(active, 'active-phone').expect(201);
  await subscribe(inactive, 'inactive-phone').expect(201);
  await subscribe(signedOutEverywhere, 'old-laptop').expect(201);
  await Admin.updateOne({ _id: signedOutEverywhere._id }, { $inc: { sessionVersion: 1 } });

  const { as } = await customer();
  await as(request(app).post('/api/chat/send')).send({ text: 'My order 0599123456 is late' }).expect(201);

  const sent = await waitForPushes(1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].endpoint, endpoint('active-phone'));
  assert.equal(sent[0].payload.kind, 'support');
  assert.equal(sent[0].payload.page, 'support-chat');
  assert.equal(sent[0].payload.tag, 'swifora-admin-support');
  assert.doesNotMatch(JSON.stringify(sent[0].payload), /0599123456|late|Customer One/);
  assert.equal(sent[0].options.urgency, 'high');

  // A second message right away does not ring again.
  await as(request(app).post('/api/chat/send')).send({ text: 'Hello?' }).expect(201);
  assert.equal((await waitForPushes(2)).length, 1);
});

test('a guest contact, a driver sign-up, a report and a deletion request each alert', async () => {
  const a = await admin();
  await subscribe(a, 'laptop').expect(201);

  await request(app).post('/api/chat/contact').set('X-Forwarded-For', from())
    .send({ name: 'Guest', email: 'guest@example.test', text: 'I cannot sign in' }).expect(201);
  await request(app).post('/api/auth/register').set('X-Forwarded-For', from()).send({
    fullName: 'Waiting Driver',
    email: 'waiting@example.test',
    phone: '0599111222',
    password: PASSWORD,
    role: 'provider',
    area: 'Al-Bireh',
    governorate: 'رام الله والبيرة',
    serviceTypes: ['product'],
  }).expect(201);

  const { as } = await customer();
  const driver = await User.create({
    fullName: 'Driver One',
    email: 'd1@example.test',
    password: 'x',
    role: 'provider',
    status: 'active',
    publicId: '71234',
    serviceTypes: ['product'],
  });
  await as(request(app).post('/api/reports')).send({
    reportType: 'driver', reportedPublicId: driver.publicId, content: 'Rude on the phone',
  }).expect(201);
  await as(request(app).post('/api/users/deletion-request')).expect(201);
  // Sending the deletion request again is not new.
  await as(request(app).post('/api/users/deletion-request')).expect(200);

  const sent = await waitForPushes(4);
  assert.deepEqual(
    sent.map((p) => p.payload.kind).sort(),
    ['deletion-request', 'driver-report', 'pending-driver', 'support'],
  );
});

test('a subscription the browser dropped is removed', async () => {
  const a = await admin();
  await subscribe(a, 'gone').expect(201);
  failWith = Object.assign(new Error('Gone'), { statusCode: 410 });
  const result = await alerts.notifyAdmins('pending-driver');
  assert.equal(result.removed, 1);
  assert.equal(await AdminPushSubscription.countDocuments(), 0);
});

test('"try the alert" reaches only the admin who pressed it', async () => {
  const a = await admin();
  const b = await admin();
  await subscribe(a, 'a-phone').expect(201);
  await subscribe(b, 'b-phone').expect(201);

  const res = await request(app).post('/admin/push/test').set('x-test-admin', String(a._id)).expect(200);
  assert.equal(res.body.sent, 1);
  assert.deepEqual(pushes.map((p) => p.endpoint), [endpoint('a-phone')]);
  assert.equal(pushes[0].payload.kind, 'test');

  // Pressing again at once is held back.
  const again = await request(app).post('/admin/push/test').set('x-test-admin', String(a._id)).expect(200);
  assert.equal(again.body.throttled, true);
});
