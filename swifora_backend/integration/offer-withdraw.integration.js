// A driver takes back a price offer before the customer answers: the offer
// is gone from the driver's "offered" list, the order is back in their open
// orders (they may offer again), and without other offers the order is
// "pending" again for the customer, who is told at once. Real HTTP, real
// lifecycle service, in-memory MongoDB replica set (transactions).
const { after, afterEach, before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-withdraw';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-withdraw';
process.env.PASSWORD_RECOVERY_SECRET = 'swifora-integration-recovery-secret-2026-11-withdraw';

const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Offer = require('../src/models/Offer');
const lifecycle = require('../src/services/orderLifecycle');

const PASSWORD = 'Cedar!River2026#Strong';
const AREA = 'Al-Bireh';
const GOVERNORATE = 'رام الله والبيرة';
let replSet;
let app;
let ip = 0;
const from = () => { ip += 1; return `198.51.100.${ip}`; };
const emitted = [];

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: '8.2.6', downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries') },
  });
  await mongoose.connect(replSet.getUri('swifora_offer_withdraw'));
  await Promise.all([User.createIndexes(), Order.createIndexes(), Offer.createIndexes()]);
  app = express();
  app.set('trust proxy', 'loopback');
  app.set('io', {
    to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }),
    in: () => ({ disconnectSockets: () => {} }),
  });
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/provider', require('../src/routes/provider'));
});

afterEach(async () => {
  emitted.length = 0;
  await Promise.all([User.deleteMany({}), Order.deleteMany({}), Offer.deleteMany({})]);
  await mongoose.connection.collection('rejectedorders').deleteMany({});
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

let n = 0;
async function account(role) {
  n += 1;
  const email = `${role}${n}@example.test`;
  const user = await User.create({
    fullName: `${role} ${n}`,
    email,
    password: await bcrypt.hash(PASSWORD, 4),
    role,
    status: 'active',
    area: AREA,
    governorate: GOVERNORATE,
    publicId: String(70000 + n),
    phoneNumbers: [{ number: `05991000${String(n).padStart(2, '0')}`, primary: true }],
    ...(role === 'provider' ? { serviceTypes: ['product'], isAvailable: true } : {}),
  });
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-For', from())
    .send({ email, password: PASSWORD, role });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const as = (req) => req.set('Authorization', `Bearer ${login.body.token}`).set('X-Forwarded-For', from());
  return { id: user._id, as };
}

async function newOrder(customerId) {
  const created = await Order.create({
    customerId,
    type: 'product',
    description: 'Bread from the bakery',
    phone: '0590000011',
    location: 'Main street',
    area: AREA,
    governorate: GOVERNORATE,
    status: 'pending',
  });
  return created._id;
}

const offerOn = (driver, orderId, price = 15) =>
  lifecycle.submitOffer({ orderId, providerId: driver.id, price, estimatedTime: 20 });
const ids = (res) => res.body.map((o) => String(o._id));

test('withdrawing puts the order back in the driver\'s open orders and makes it pending', async () => {
  const customer = await account('customer');
  const driver = await account('provider');
  const orderId = await newOrder(customer.id);

  await offerOn(driver, orderId);
  assert.equal((await Order.findById(orderId).lean()).status, 'offered');
  assert.deepEqual(ids(await driver.as(request(app).get('/api/provider/offered-orders')).expect(200)), [String(orderId)]);
  assert.deepEqual(ids(await driver.as(request(app).get('/api/provider/pending-orders')).expect(200)), []);

  const res = await driver.as(request(app).post(`/api/provider/orders/${orderId}/withdraw-offer`)).expect(200);
  assert.equal(res.body.orderStatus, 'pending');

  assert.equal((await Order.findById(orderId).lean()).status, 'pending');
  assert.equal(await Offer.countDocuments({ orderId }), 0);
  assert.deepEqual(ids(await driver.as(request(app).get('/api/provider/offered-orders')).expect(200)), []);
  assert.deepEqual(ids(await driver.as(request(app).get('/api/provider/pending-orders')).expect(200)), [String(orderId)]);

  // The customer hears about it at once.
  const event = emitted.find((e) => e.event === 'offer_withdrawn');
  assert.equal(event.room, `user:${customer.id}`);
  assert.equal(String(event.data.orderId), String(orderId));
  assert.equal(event.data.orderStatus, 'pending');

  // The driver may send a new offer.
  await offerOn(driver, orderId, 12);
  const again = await Offer.findOne({ orderId }).lean();
  assert.equal(again.price, 12);
  assert.equal((await Order.findById(orderId).lean()).status, 'offered');
});

test('another driver\'s offer stays, and the order stays "offered"', async () => {
  const customer = await account('customer');
  const first = await account('provider');
  const second = await account('provider');
  const orderId = await newOrder(customer.id);
  await offerOn(first, orderId, 15);
  await offerOn(second, orderId, 18);

  const res = await first.as(request(app).post(`/api/provider/orders/${orderId}/withdraw-offer`)).expect(200);
  assert.equal(res.body.orderStatus, 'offered');
  assert.equal((await Order.findById(orderId).lean()).status, 'offered');
  const left = await Offer.find({ orderId }).lean();
  assert.deepEqual(left.map((o) => String(o.providerId)), [String(second.id)]);
});

test('an accepted offer, or one that does not exist, cannot be withdrawn', async () => {
  const customer = await account('customer');
  const driver = await account('provider');
  const other = await account('provider');
  const orderId = await newOrder(customer.id);

  const none = await other.as(request(app).post(`/api/provider/orders/${orderId}/withdraw-offer`)).expect(409);
  assert.equal(none.body.code, 'OFFER_NOT_AVAILABLE');

  const { offer } = await offerOn(driver, orderId);
  await lifecycle.acceptOffer({ offerId: offer._id, customerId: customer.id, commissionConfig: { mode: 'percentage', value: 0 } });
  const taken = await driver.as(request(app).post(`/api/provider/orders/${orderId}/withdraw-offer`)).expect(409);
  assert.equal(taken.body.code, 'OFFER_NOT_AVAILABLE');
  assert.equal((await Order.findById(orderId).lean()).status, 'accepted');

  await driver.as(request(app).post('/api/provider/orders/not-an-id/withdraw-offer')).expect(404);
  assert.equal(emitted.filter((e) => e.event === 'offer_withdrawn').length, 0);
});
