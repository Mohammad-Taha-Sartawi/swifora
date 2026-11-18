// The notifications screen shows the latest 30 notifications from the last
// 30 days; older ones and ones past 30 are hidden, and the unread badge
// counts only what is shown. Notifications are stored in MongoDB.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-notif';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-notif';
process.env.PASSWORD_RECOVERY_SECRET = 'swifora-integration-recovery-secret-2026-11-notif';

const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const {
  NOTIFICATION_LIST_LIMIT,
  NOTIFICATION_MAX_AGE_DAYS,
} = require('../src/services/notificationWindow');

const PASSWORD = 'Cedar!River2026#Strong';
const DAY = 24 * 60 * 60 * 1000;
let mongoServer;
let app;
let user;
let token;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '8.2.6', downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries') },
  });
  await mongoose.connect(mongoServer.getUri('swifora_notification_window'));
  await Promise.all([User.init(), Notification.init()]);
  app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/notifications', require('../src/routes/notifications'));

  user = await User.create({
    fullName: 'Customer One', email: 'customer@gmail.com', password: await bcrypt.hash(PASSWORD, 4),
    role: 'customer', status: 'active', area: 'Al-Bireh', publicId: '80001',
    phoneNumbers: [{ number: '0599123456', primary: true }],
  });
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.7')
    .send({ email: 'customer@gmail.com', password: PASSWORD, role: 'customer' });
  assert.equal(login.status, 200, login.body.error);
  token = login.body.token;
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Notification.deleteMany({});
});

const list = () => request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
const badge = () => request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token}`);

/** One notification [ageMs] old; title records its age for the checks. */
function at(ageMs, extra = {}) {
  return {
    userId: user._id, type: 'new_offer', title: `age ${ageMs}`, body: 'x',
    createdAt: new Date(Date.now() - ageMs), read: false, ...extra,
  };
}

test('the window is 30 days and 30 notifications', () => {
  assert.equal(NOTIFICATION_MAX_AGE_DAYS, 30);
  assert.equal(NOTIFICATION_LIST_LIMIT, 30);
});

test('only the latest 30 of the last 30 days are shown, newest first', async () => {
  const docs = [];
  for (let i = 0; i < 40; i += 1) docs.push(at(i * 60 * 60 * 1000)); // 40 within ~2 days
  for (let i = 0; i < 5; i += 1) docs.push(at((31 + i) * DAY)); // older than 30 days
  await Notification.insertMany(docs);
  assert.equal(await Notification.countDocuments({ userId: user._id }), 45, 'all stay stored in the database');

  const res = await list();
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 30);
  const times = res.body.map((n) => new Date(n.createdAt).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a), 'newest first');
  // The 30 newest: ages 0h..29h; the 10 older recent ones and all old ones are hidden.
  assert.equal(res.body[0].title, 'age 0');
  assert.equal(res.body[29].title, `age ${29 * 60 * 60 * 1000}`);
  assert.ok(times.every((t) => Date.now() - t < 30 * DAY));
});

test('notifications older than 30 days are hidden even when there are few', async () => {
  await Notification.insertMany([
    at(1 * DAY), at(29 * DAY), at(31 * DAY), at(90 * DAY), at(400 * DAY),
  ]);
  const res = await list();
  assert.deepEqual(res.body.map((n) => n.title), [`age ${1 * DAY}`, `age ${29 * DAY}`]);
});

test('the unread badge counts only the notifications that are shown', async () => {
  const docs = [];
  for (let i = 0; i < 30; i += 1) docs.push(at(i * 60 * 1000, { read: i % 2 === 0 })); // 15 unread shown
  for (let i = 0; i < 10; i += 1) docs.push(at(DAY + i * 60 * 1000)); // unread, past the 30 limit
  for (let i = 0; i < 10; i += 1) docs.push(at(45 * DAY)); // unread, older than 30 days
  await Notification.insertMany(docs);

  const shown = (await list()).body;
  assert.equal(shown.length, 30);
  const count = await badge();
  assert.equal(count.status, 200);
  assert.equal(count.body.count, 15);
  assert.equal(count.body.count, shown.filter((n) => !n.read).length);
});

test('a pinned message inside the window stays on top', async () => {
  await Notification.insertMany([
    at(10 * 60 * 1000),
    at(5 * 60 * 1000),
    at(60 * 60 * 1000, { type: 'broadcast', title: 'pinned', pinned: true }),
  ]);
  const res = await list();
  assert.deepEqual(res.body.map((n) => n.title), ['pinned', `age ${5 * 60 * 1000}`, `age ${10 * 60 * 1000}`]);
});

test("another user's notifications are never shown", async () => {
  await Notification.insertMany([
    at(60 * 1000),
    { ...at(60 * 1000), userId: new mongoose.Types.ObjectId(), title: 'someone else' },
  ]);
  const res = await list();
  assert.equal(res.body.length, 1);
  assert.notEqual(res.body[0].title, 'someone else');
});

test('every notification is deleted from the database 30 days after it is created', async () => {
  const { createUserNotification } = require('../src/services/mobileNotifications');
  const daysLeft = (doc) => (new Date(doc.expireAt).getTime() - Date.now()) / DAY;

  const plain = await Notification.create({ userId: user._id, type: 'new_offer', title: 't', body: 'b' });
  assert.ok(Math.abs(daysLeft(plain) - 30) < 0.01, `model default: ${daysLeft(plain)}`);

  const viaService = await createUserNotification({ userId: user._id, type: 'order_pending', title: 't', body: 'b', push: false });
  assert.ok(Math.abs(daysLeft(viaService) - 30) < 0.01, `service default: ${daysLeft(viaService)}`);

  // A deliberately shorter life (pinned broadcast, account notice) is kept.
  const pinned = await createUserNotification({
    userId: user._id, type: 'broadcast', title: 't', body: 'b', pinned: true, push: false,
    expireAt: new Date(Date.now() + 3 * DAY),
  });
  assert.ok(Math.abs(daysLeft(pinned) - 3) < 0.01);

  // MongoDB's TTL index on expireAt does the deleting.
  const ttl = (await Notification.collection.indexes()).find((index) => index.key.expireAt === 1);
  assert.ok(ttl, 'TTL index on expireAt');
  assert.equal(ttl.expireAfterSeconds, 0);
});
