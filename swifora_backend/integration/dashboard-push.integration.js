// Everything the dashboard sends to the apps also arrives as a push, so it
// reaches phones whose app is closed or in the background: broadcast
// messages, support replies, account freeze/activation, and orders the
// dashboard sends out again or cancels. Real HTTP and MongoDB (in-memory
// replica set, for the order transactions); Firebase is a recording stand-in.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-push';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-push';

// The admin session and CSRF checks have their own tests; here they let the
// stand-in admin through so the support-reply route can be called directly.
function stubModule(relativePath, exports) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}
stubModule('../src/middleware/requireAdminSession', (req, res, next) => next());
stubModule('../src/security/adminCsrf', { adminCsrfProtection: (req, res, next) => next() });

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Order = require('../src/models/Order');
const PushToken = require('../src/models/PushToken');
const Notification = require('../src/models/Notification');
const push = require('../src/services/pushNotifications');

let replSet;
let app;
const pushes = [];
const emitted = [];

// Socket.IO stand-in: records events, has no connected sockets.
const room = (name) => ({
  emit: (event, payload) => emitted.push({ room: name, event, payload }),
  except: () => room(name),
});
const io = {
  to: room,
  in: () => ({ disconnectSockets() {}, fetchSockets: async () => [] }),
};

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(replSet.getUri('swifora_dashboard_push'));
  await Promise.all([User.init(), Order.init(), PushToken.init(), Notification.init()]);

  push.setMessagingClientForTesting({
    sendEachForMulticast: async (message) => {
      pushes.push(message);
      return { responses: message.tokens.map(() => ({ success: true })) };
    },
  });

  app = express();
  app.use(express.json());
  app.set('io', io);
  app.use((req, res, next) => {
    req.session = { admin: { id: new mongoose.Types.ObjectId().toString(), role: 'admin' } };
    next();
  });
  app.use('/admin/broadcast', require('../src/routes/adminBroadcast'));
  app.use('/admin/chat', require('../src/routes/adminChat'));
  app.use('/admin/drivers', require('../src/routes/adminDrivers'));
  app.use('/admin/users', require('../src/routes/adminUsers'));
  app.use('/admin/orders', require('../src/routes/adminOrders'));
  app.use('/api/chat', require('../src/routes/chat'));
});

after(async () => {
  push.setMessagingClientForTesting(null);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

let driver;
let customer;
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Order.deleteMany({}), PushToken.deleteMany({}), Notification.deleteMany({}),
  ]);
  pushes.length = 0;
  emitted.length = 0;
  driver = await User.create({
    fullName: 'Driver One', email: 'driver@gmail.com', password: 'x', role: 'provider',
    status: 'active', isAvailable: true, area: 'Al-Bireh', publicId: '11111',
    phoneNumbers: [{ number: '0599123456', primary: true }],
  });
  customer = await User.create({
    fullName: 'Customer One', email: 'customer@gmail.com', password: 'x', role: 'customer',
    status: 'active', area: 'Al-Bireh', publicId: '22222',
    phoneNumbers: [{ number: '0527123456', primary: true }],
  });
  await PushToken.create([
    { userId: driver._id, token: 'driver-phone', platform: 'android' },
    { userId: customer._id, token: 'customer-phone', platform: 'android' },
  ]);
});

/** Pushes sent to [token], waiting briefly (they are sent after the reply). */
async function pushesTo(token, { count = 1, ms = 3000 } = {}) {
  const started = Date.now();
  let hits = [];
  while (Date.now() - started < ms) {
    hits = pushes.filter((message) => message.tokens.includes(token));
    if (hits.length >= count) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  return hits;
}

test('a broadcast message reaches the closed apps of its audience only', async () => {
  const res = await request(app).post('/admin/broadcast/drivers')
    .send({ title: 'تنبيه للسائقين', body: 'تحديث جديد للتطبيق' }).expect(200);
  assert.equal(res.body.success, true);

  const [message] = await pushesTo('driver-phone');
  assert.ok(message, 'the driver gets a push');
  assert.deepEqual(message.notification, { title: 'تنبيه للسائقين', body: 'تحديث جديد للتطبيق' });
  assert.equal(message.data.type, 'broadcast');
  assert.equal(message.android.priority, 'high');
  assert.equal((await pushesTo('customer-phone', { ms: 300 })).length, 0, 'customers are not in a driver broadcast');
});

test('a broadcast to more than 500 phones is sent in batches', async () => {
  const extra = [];
  for (let i = 0; i < 520; i += 1) {
    extra.push({ userId: customer._id, token: `customer-extra-${i}`, platform: 'android' });
  }
  await PushToken.insertMany(extra);
  await request(app).post('/admin/broadcast/users')
    .send({ title: 'عرض', body: 'خصم اليوم' }).expect(200);

  await pushesTo('customer-extra-519');
  const sizes = pushes.map((message) => message.tokens.length);
  assert.deepEqual(sizes.sort((a, b) => b - a), [500, 21]);
});

test('a support reply from either dashboard screen reaches the closed app', async () => {
  await request(app).post(`/admin/chat/send/driver/${driver._id}`)
    .send({ text: 'أهلاً، تم حل المشكلة' }).expect(200);
  const [fromChatPage] = await pushesTo('driver-phone');
  assert.equal(fromChatPage.notification.title, 'رد من فريق الدعم');
  assert.equal(fromChatPage.notification.body, 'أهلاً، تم حل المشكلة');
  assert.equal(fromChatPage.data.type, 'support_reply');

  await request(app).post(`/api/chat/admin/reply/${customer._id}`)
    .send({ text: 'x'.repeat(400) }).expect(201);
  const [fromSupportPage] = await pushesTo('customer-phone');
  assert.equal(fromSupportPage.data.type, 'support_reply');
  assert.ok(fromSupportPage.notification.body.length <= 180, 'long replies are shortened for the tray');
});

test('freezing and re-activating an account reaches the phone', async () => {
  await request(app).put(`/admin/drivers/${driver._id}/status`).send({ status: 'blocked' }).expect(200);
  const [frozen] = await pushesTo('driver-phone');
  assert.equal(frozen.notification.title, 'تم تجميد حسابك');

  await request(app).put(`/admin/users/${customer._id}/status`).send({ status: 'blocked' }).expect(200);
  await request(app).put(`/admin/users/${customer._id}/status`).send({ status: 'active' }).expect(200);
  const customerPushes = await pushesTo('customer-phone', { count: 2 });
  assert.deepEqual(customerPushes.map((message) => message.notification.title), ['تم تجميد حسابك', 'تم تفعيل حسابك']);
});

test('an order sent out again from the dashboard reaches the drivers like a new one', async () => {
  const order = await Order.create({
    customerId: customer._id, type: 'goods', description: 'كرتونة ماء', phone: '0527123456',
    area: 'Al-Bireh', status: 'pending',
  });
  await request(app).post(`/admin/orders/${order._id}/resend`).expect(200);

  const [message] = await pushesTo('driver-phone');
  assert.ok(message, 'the driver gets a push');
  assert.equal(message.notification.title, 'طلب جديد');
  assert.deepEqual(message.data, { type: 'new_order', orderId: order._id.toString() });
  const live = emitted.find((item) => item.event === 'new_order');
  assert.ok(live, 'open apps get the live event too');
  assert.equal(live.payload.phoneMasked, '0527123***', 'the full customer number is never broadcast');
});

test('cancelling an order from the dashboard tells the customer and the driver', async () => {
  const order = await Order.create({
    customerId: customer._id, providerId: driver._id, type: 'goods', description: 'كرتونة ماء',
    phone: '0527123456', area: 'Al-Bireh', status: 'accepted',
  });
  await request(app).post(`/admin/orders/${order._id}/cancel`).expect(200);

  const [toCustomer] = await pushesTo('customer-phone');
  const [toDriver] = await pushesTo('driver-phone');
  assert.equal(toCustomer.notification.title, 'تم إلغاء طلبك');
  assert.match(toCustomer.notification.body, /كرتونة ماء/);
  assert.deepEqual(toCustomer.data, { type: 'order_cancelled', orderId: order._id.toString() });
  assert.equal(toDriver.notification.title, 'تم إلغاء طلب');
  // Also in each app's notifications list.
  assert.equal(await Notification.countDocuments({ orderId: order._id, type: 'order_cancelled' }), 2);
});

test('a cancelled order without a driver only tells the customer', async () => {
  const order = await Order.create({
    customerId: customer._id, type: 'goods', description: 'خبز', phone: '0527123456',
    area: 'Al-Bireh', status: 'pending',
  });
  await request(app).post(`/admin/orders/${order._id}/cancel`).expect(200);
  const [toCustomer] = await pushesTo('customer-phone');
  assert.equal(toCustomer.notification.body, 'ألغت إدارة سويفورا طلبك «خبز». للاستفسار تواصل مع الدعم.');
  assert.equal((await pushesTo('driver-phone', { ms: 300 })).length, 0);
});
