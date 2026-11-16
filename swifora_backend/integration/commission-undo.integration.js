// Undo for the dashboard's commission "paid" and "reset" (and "reset all").
// Real MongoDB (in-memory), the real admin commissions router.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Order = require('../src/models/Order');
const CommissionPayment = require('../src/models/CommissionPayment');
const CommissionAction = require('../src/models/CommissionAction');
const adminCommissionRoutes = require('../src/routes/adminCommissions');

let mongoServer;
let app;
const adminId = new mongoose.Types.ObjectId().toString();

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_commission_undo'));
  app = express();
  app.use(express.json());
  // Stand-in for the admin session (the real app checks it before this).
  app.use((req, res, next) => {
    req.session = { admin: { id: adminId, role: 'admin' } };
    next();
  });
  app.use('/admin/commissions', adminCommissionRoutes);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Order.deleteMany({}),
    CommissionPayment.deleteMany({}),
    CommissionAction.deleteMany({}),
  ]);
});

let seq = 0;
async function driverWithOrders(commissions) {
  seq += 1;
  const customer = await User.create({
    fullName: `Customer ${seq}`,
    email: `c${seq}@example.test`,
    password: 'x',
    role: 'customer',
  });
  const driver = await User.create({
    fullName: `Driver ${seq}`,
    email: `d${seq}@example.test`,
    password: 'x',
    role: 'provider',
  });
  const acceptedAt = new Date(Date.now() - 60 * 60 * 1000);
  for (const commission of commissions) {
    await Order.create({
      customerId: customer._id,
      providerId: driver._id,
      type: 'product',
      description: 'test',
      phone: '0590000000',
      status: 'completed',
      price: 50,
      platformCommission: commission,
      providerEarning: 50 - commission,
      acceptedAt,
    });
  }
  return driver;
}

async function rowFor(driverId) {
  const res = await request(app).get('/admin/commissions').expect(200);
  return { row: res.body.driverRows.find((r) => r._id === driverId.toString()), body: res.body };
}

test('"paid" can be undone: the amount is due again and the payment is gone', async () => {
  const driver = await driverWithOrders([2, 3]);
  assert.equal((await rowFor(driver._id)).row.commission, 5);

  const paid = await request(app).put(`/admin/commissions/pay/${driver._id}`).expect(200);
  assert.equal(paid.body.amount, 5);
  assert.equal(paid.body.action.type, 'payment');
  assert.equal(await CommissionPayment.countDocuments({ driverId: driver._id }), 1);
  const after = await rowFor(driver._id);
  assert.equal(after.row.commission, 0);
  assert.equal(after.row.lastAction.id, paid.body.action.id);

  const undo = await request(app).post(`/admin/commissions/undo/${paid.body.action.id}`).expect(200);
  assert.equal(undo.body.type, 'payment');
  assert.equal(undo.body.amount, 5);

  const back = await rowFor(driver._id);
  assert.equal(back.row.commission, 5);
  assert.equal(back.row.lastAction, null);
  assert.equal(await CommissionPayment.countDocuments({ driverId: driver._id }), 0);
  const fresh = await User.findById(driver._id).lean();
  assert.equal(fresh.commissionPaidAt, null);
  assert.equal(fresh.commissionPaid, false);

  // Twice is refused.
  const again = await request(app).post(`/admin/commissions/undo/${paid.body.action.id}`).expect(409);
  assert.equal(again.body.success, false);
});

test('"reset" can be undone: the commission goes back to the platform', async () => {
  const driver = await driverWithOrders([2, 3]);
  const reset = await request(app).put(`/admin/commissions/reset/${driver._id}`).expect(200);
  assert.equal(reset.body.amount, 5);
  assert.equal(reset.body.action.type, 'reset');
  let orders = await Order.find({ providerId: driver._id }).sort({ platformCommission: 1 }).lean();
  assert.deepEqual(orders.map((o) => [o.platformCommission, o.providerEarning]), [[0, 50], [0, 50]]);
  assert.equal((await rowFor(driver._id)).row.commission, 0);

  await request(app).post(`/admin/commissions/undo/${reset.body.action.id}`).expect(200);
  orders = await Order.find({ providerId: driver._id }).sort({ platformCommission: 1 }).lean();
  assert.deepEqual(orders.map((o) => [o.platformCommission, o.providerEarning]), [[2, 48], [3, 47]]);
  assert.ok(orders.every((o) => o.commissionWaivedAt === null));
  const row = (await rowFor(driver._id)).row;
  assert.equal(row.commission, 5);
  assert.equal((await User.findById(driver._id).lean()).commissionResetAt, null);
});

test('only the latest operation can be undone, newest first', async () => {
  const driver = await driverWithOrders([4]);
  const paid = await request(app).put(`/admin/commissions/pay/${driver._id}`).expect(200);
  // A new order after the payment, then a reset.
  await Order.create({
    customerId: (await User.findOne({ role: 'customer' }))._id,
    providerId: driver._id,
    type: 'goods',
    description: 'later',
    phone: '0590000000',
    status: 'completed',
    price: 30,
    platformCommission: 1,
    providerEarning: 29,
    acceptedAt: new Date(Date.now() + 1000),
  });
  const reset = await request(app).put(`/admin/commissions/reset/${driver._id}`).expect(200);
  assert.equal(reset.body.amount, 1);

  // The payment is not the latest any more.
  const blocked = await request(app).post(`/admin/commissions/undo/${paid.body.action.id}`).expect(409);
  assert.match(blocked.body.message, /آخر عملية/);

  await request(app).post(`/admin/commissions/undo/${reset.body.action.id}`).expect(200);
  assert.equal((await rowFor(driver._id)).row.commission, 1);
  await request(app).post(`/admin/commissions/undo/${paid.body.action.id}`).expect(200);
  // Both undone: the first order is due again too.
  assert.equal((await rowFor(driver._id)).row.commission, 5);
});

test('"reset all" can be undone in one step', async () => {
  const a = await driverWithOrders([2]);
  const b = await driverWithOrders([3, 1]);
  await driverWithOrders([]); // nothing to reset: not recorded

  const all = await request(app).put('/admin/commissions/reset-all').expect(200);
  assert.equal(all.body.amount, 6);
  const listed = await rowFor(a._id);
  assert.equal(listed.body.lastResetAll.batchId, all.body.batchId);
  assert.equal(listed.body.lastResetAll.drivers, 2);
  assert.equal(listed.body.lastResetAll.amount, 6);

  const undo = await request(app).post(`/admin/commissions/undo-batch/${all.body.batchId}`).expect(200);
  assert.deepEqual([undo.body.undone, undo.body.skipped, undo.body.amount], [2, 0, 6]);
  assert.equal((await rowFor(a._id)).row.commission, 2);
  const afterAll = await rowFor(b._id);
  assert.equal(afterAll.row.commission, 4);
  assert.equal(afterAll.body.lastResetAll, null);
});

test('unknown or malformed operations are refused', async () => {
  await request(app).post('/admin/commissions/undo/not-an-id').expect(404);
  await request(app).post(`/admin/commissions/undo/${new mongoose.Types.ObjectId()}`).expect(404);
});
