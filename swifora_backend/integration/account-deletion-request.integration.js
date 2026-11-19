// Account deletion requests: the app sends or withdraws one, the dashboard
// lists it with what to check first (a driver's unpaid commission, unfinished
// orders) and approves it, which deletes the account. A withdrawn request
// stays listed as cancelled and can no longer be approved.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-delete';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-delete';
process.env.PASSWORD_RECOVERY_SECRET = 'swifora-integration-recovery-secret-2026-11-delete';

const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Order = require('../src/models/Order');
const AccountDeletionRequest = require('../src/models/AccountDeletionRequest');

const PASSWORD = 'Cedar!River2026#Strong';
let mongoServer;
let app;
let ip = 0;
const from = () => { ip += 1; return `198.51.100.${ip}`; };

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '8.2.6', downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries') },
  });
  await mongoose.connect(mongoServer.getUri('swifora_deletion_requests'));
  await Promise.all([User.init(), Order.init(), AccountDeletionRequest.init()]);
  app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/users', require('../src/routes/users'));
  app.use('/admin/deletion-requests', require('../src/routes/adminDeletionRequests'));
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Order.deleteMany({}), AccountDeletionRequest.deleteMany({})]);
});

async function account(role, email, extra = {}) {
  const user = await User.create({
    fullName: role === 'provider' ? 'Driver One' : 'Customer One',
    email,
    password: await bcrypt.hash(PASSWORD, 4),
    role,
    status: 'active',
    area: 'Al-Bireh',
    governorate: 'رام الله والبيرة',
    publicId: String(80000 + Math.floor(Math.random() * 9999)),
    phoneNumbers: [{ number: '0599123456', primary: true }],
    ...(role === 'provider' ? { serviceTypes: ['product'], commissionPaidAt: null } : {}),
    ...extra,
  });
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-For', from())
    .send({ email, password: PASSWORD, role });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const as = (req) => req.set('Authorization', `Bearer ${login.body.token}`).set('X-Forwarded-For', from());
  return { user, as };
}

const list = async () => (await request(app).get('/admin/deletion-requests').expect(200)).body.requests;

test('a customer sends a request once, and can withdraw it', async () => {
  const { user, as } = await account('customer', 'c1@example.test');

  assert.equal((await as(request(app).get('/api/users/deletion-request')).expect(200)).body.request, null);

  const sent = await as(request(app).post('/api/users/deletion-request')).expect(201);
  assert.equal(sent.body.request.status, 'pending');
  // Sending again changes nothing.
  const again = await as(request(app).post('/api/users/deletion-request')).expect(200);
  assert.equal(again.body.request.id, sent.body.request.id);
  assert.equal(await AccountDeletionRequest.countDocuments(), 1);

  const status = await as(request(app).get('/api/users/deletion-request')).expect(200);
  assert.equal(status.body.request.status, 'pending');

  const [listed] = await list();
  assert.equal(listed.status, 'pending');
  assert.equal(listed.role, 'customer');
  assert.equal(listed.fullName, 'Customer One');
  assert.equal(listed.openOrders, 0);

  await as(request(app).delete('/api/users/deletion-request')).expect(200);
  assert.equal((await as(request(app).get('/api/users/deletion-request')).expect(200)).body.request, null);
  // Nothing left to withdraw.
  const none = await as(request(app).delete('/api/users/deletion-request')).expect(404);
  assert.equal(none.body.code, 'NO_DELETION_REQUEST');

  // The dashboard keeps it, as cancelled, and it cannot be approved.
  const [cancelled] = await list();
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.unpaidCommission, undefined);
  const approve = await request(app).post(`/admin/deletion-requests/${cancelled.id}/approve`).expect(200);
  assert.equal(approve.body.success, false);
  assert.equal(approve.body.code, 'REQUEST_CANCELLED');
  assert.ok(await User.exists({ _id: user._id }));

  // A new request after withdrawing is allowed.
  await as(request(app).post('/api/users/deletion-request')).expect(201);
  assert.equal(await AccountDeletionRequest.countDocuments({ status: 'pending' }), 1);
});

test("a driver's request shows the unpaid commission; approving deletes the account", async () => {
  const { user, as } = await account('provider', 'd1@example.test');
  const customer = new mongoose.Types.ObjectId();
  await Order.create([
    { customerId: customer, providerId: user._id, type: 'product', description: 'a', phone: '0599000000',
      status: 'completed', platformCommission: 4.5, acceptedAt: new Date() },
    { customerId: customer, providerId: user._id, type: 'product', description: 'b', phone: '0599000000',
      status: 'completed', platformCommission: 3, acceptedAt: new Date() },
  ]);
  await as(request(app).post('/api/users/deletion-request')).expect(201);

  const [listed] = await list();
  assert.equal(listed.role, 'provider');
  assert.equal(listed.unpaidCommission, 7.5);
  assert.equal(listed.inProgressOrders, 0);

  const approve = await request(app).post(`/admin/deletion-requests/${listed.id}/approve`).expect(200);
  assert.equal(approve.body.success, true, approve.body.message);
  assert.equal(await User.exists({ _id: user._id }), null);
  const [approved] = await list();
  assert.equal(approved.status, 'approved');
  assert.equal(approved.fullName, 'Driver One');
  // Approving twice does nothing more.
  const twice = await request(app).post(`/admin/deletion-requests/${listed.id}/approve`).expect(200);
  assert.equal(twice.body.code, 'REQUEST_CLOSED');
});

test('an order being delivered blocks the approval until it is finished', async () => {
  const { user, as } = await account('customer', 'c2@example.test');
  const order = await Order.create({
    customerId: user._id, providerId: new mongoose.Types.ObjectId(), type: 'goods', description: 'x',
    phone: '0599000000', status: 'fulfilling',
  });
  await Order.create({ customerId: user._id, type: 'goods', description: 'y', phone: '0599000000', status: 'pending' });
  await as(request(app).post('/api/users/deletion-request')).expect(201);

  const [listed] = await list();
  assert.equal(listed.inProgressOrders, 1);
  assert.equal(listed.openOrders, 1);
  const blocked = await request(app).post(`/admin/deletion-requests/${listed.id}/approve`).expect(200);
  assert.equal(blocked.body.success, false);
  assert.equal(blocked.body.code, 'ACCOUNT_HAS_ACTIVE_ORDERS');
  assert.ok(await User.exists({ _id: user._id }));
  assert.equal((await list())[0].status, 'pending');

  await Order.updateOne({ _id: order._id }, { $set: { status: 'completed' } });
  const ok = await request(app).post(`/admin/deletion-requests/${listed.id}/approve`).expect(200);
  assert.equal(ok.body.success, true, ok.body.message);
  assert.equal(await User.exists({ _id: user._id }), null);
});

test('only the signed-in account is affected, and a wrong id is a 404', async () => {
  const first = await account('customer', 'c3@example.test');
  const second = await account('customer', 'c4@example.test');
  await first.as(request(app).post('/api/users/deletion-request')).expect(201);
  assert.equal((await second.as(request(app).get('/api/users/deletion-request')).expect(200)).body.request, null);
  await second.as(request(app).delete('/api/users/deletion-request')).expect(404);
  assert.equal((await list())[0].status, 'pending');

  await request(app).post('/admin/deletion-requests/not-an-id/approve').expect(404);
  await request(app).get('/api/users/deletion-request').expect(401);
});
