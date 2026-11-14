// A driver can send price offers on every order they see, but once one
// customer accepts, the driver takes no other order until that customer
// confirms delivery or 15 minutes have passed since the delivery started.
// Their other offers are withdrawn ("this driver took another order").
// Real MongoDB replica set (in-memory), real lifecycle service.
const { after, afterEach, before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Offer = require('../src/models/Offer');
const lifecycle = require('../src/services/orderLifecycle');

const AREA = 'Al-Bireh';
const GOVERNORATE = 'رام الله والبيرة';
const COMMISSION = { mode: 'percentage', value: 0 };
let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(replSet.getUri('swifora_driver_hold'));
  await Promise.all([User.createIndexes(), Order.createIndexes(), Offer.createIndexes()]);
});

afterEach(async () => {
  await Promise.all([
    User.collection.deleteMany({}),
    Order.collection.deleteMany({}),
    Offer.collection.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

async function account(role, name) {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id,
    fullName: name,
    email: `${name}@example.test`,
    password: 'x',
    role,
    status: 'active',
    deleted: false,
    area: AREA,
    governorate: GOVERNORATE,
    serviceTypes: role === 'provider' ? ['product'] : [],
    isAvailable: true,
    blockedUntil: null,
    offerCooldownUntil: null,
  });
  return _id;
}

async function order(customerId) {
  const created = await Order.create({
    customerId,
    type: 'product',
    description: 'Bread from the bakery',
    phone: '0590000011',
    area: AREA,
    governorate: GOVERNORATE,
    status: 'pending',
  });
  return created._id;
}

// Back to back: there is no waiting time between two offers.
async function offer(providerId, orderId, price = 15) {
  const result = await lifecycle.submitOffer({
    orderId,
    providerId,
    price,
    estimatedTime: 20,
  });
  return result.offer._id;
}

async function blockedUntil(providerId) {
  return (await User.findById(providerId).select('blockedUntil').lean()).blockedUntil;
}

async function conflictCode(promise) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof lifecycle.LifecycleConflict) return error.code;
    throw error;
  }
  return 'NO_CONFLICT';
}

test('a driver offers on every order; the first acceptance holds them', async () => {
  const driver = await account('provider', 'driver');
  const [c1, c2, c3] = await Promise.all([
    account('customer', 'c1'),
    account('customer', 'c2'),
    account('customer', 'c3'),
  ]);
  const [o1, o2, o3] = [await order(c1), await order(c2), await order(c3)];

  // Offers on every open order.
  const f1 = await offer(driver, o1);
  const f2 = await offer(driver, o2);
  const f3 = await offer(driver, o3);

  // Customer 1 accepts first: that is the one that counts.
  const accepted = await lifecycle.acceptOffer({
    offerId: f1,
    customerId: c1,
    commissionConfig: COMMISSION,
  });
  assert.deepEqual(
    accepted.unavailableOffers.map((item) => item.orderId.toString()).sort(),
    [o2.toString(), o3.toString()].sort(),
    'customers 2 and 3 are told this driver took another order',
  );

  // The other offers are withdrawn and can no longer be accepted.
  for (const id of [f2, f3]) {
    const withdrawn = await Offer.findById(id).lean();
    assert.equal(withdrawn.status, 'rejected');
    assert.equal(withdrawn.rejectionReason, 'provider_unavailable');
  }
  assert.equal(
    await conflictCode(lifecycle.acceptOffer({ offerId: f2, customerId: c2, commissionConfig: COMMISSION })),
    'PROVIDER_TAKEN',
  );

  // Held with no 15-minute limit before the delivery starts.
  const hold = await blockedUntil(driver);
  assert.ok(hold.getTime() - Date.now() > 60 * 60 * 1000);

  // No new offer while held.
  const o4 = await order(c2);
  assert.equal(await conflictCode(offer(driver, o4)), 'PROVIDER_BUSY');

  // Customer 2 resends; the order is open to other drivers again.
  await lifecycle.resetOrder({ orderId: o2, customerId: c2 });
  assert.equal((await Order.findById(o2).lean()).status, 'pending');
});

test('a driver can offer on several orders at once, with no waiting', async () => {
  const driver = await account('provider', 'driver');
  const customers = [];
  for (const name of ['c1', 'c2', 'c3']) customers.push(await account('customer', name));
  const orders = [];
  for (const customer of customers) orders.push(await order(customer));

  // Three offers in a row, all live at the same time.
  for (const orderId of orders) assert.ok(await offer(driver, orderId));
  assert.equal(
    await Offer.countDocuments({ providerId: driver, status: 'pending' }),
    3,
  );

  // No order is closed for lack of drivers while the driver is free.
  for (const orderId of orders) {
    assert.equal(await lifecycle.suspendIfUnanswered(await Order.findById(orderId).lean()), null);
  }
});

test('starting the delivery leaves 15 minutes; confirming frees the driver', async () => {
  const driver = await account('provider', 'driver');
  const customer = await account('customer', 'customer');
  const o1 = await order(customer);
  const f1 = await offer(driver, o1);
  await lifecycle.acceptOffer({ offerId: f1, customerId: customer, commissionConfig: COMMISSION });

  const before = Date.now();
  await lifecycle.transitionOrder({ orderId: o1, providerId: driver, from: 'accepted', to: 'fulfilling' });
  const hold = (await blockedUntil(driver)).getTime();
  const fifteen = lifecycle.PROVIDER_ACCEPTANCE_BLOCK_MS;
  assert.ok(hold >= before + fifteen && hold <= Date.now() + fifteen);

  await lifecycle.requestDeliveryConfirmation({ orderId: o1, providerId: driver });
  await lifecycle.confirmDelivery({ orderId: o1, customerId: customer });
  assert.equal(await blockedUntil(driver), null);

  // Free again: can offer on a new order.
  const o2 = await order(customer);
  assert.ok(await offer(driver, o2));
});

test('15 minutes after the start the driver may take a new order', async () => {
  const driver = await account('provider', 'driver');
  const [c1, c2] = [await account('customer', 'c1'), await account('customer', 'c2')];
  const o1 = await order(c1);
  await lifecycle.acceptOffer({ offerId: await offer(driver, o1), customerId: c1, commissionConfig: COMMISSION });
  await lifecycle.transitionOrder({ orderId: o1, providerId: driver, from: 'accepted', to: 'fulfilling' });

  // Simulate the 15 minutes passing.
  const startedLongAgo = new Date(Date.now() - 16 * 60 * 1000);
  await Order.updateOne({ _id: o1 }, { $set: { fulfillingAt: startedLongAgo } });
  await User.updateOne({ _id: driver }, { $set: { blockedUntil: new Date(Date.now() - 60 * 1000) } });

  const o2 = await order(c2);
  await lifecycle.acceptOffer({ offerId: await offer(driver, o2), customerId: c2, commissionConfig: COMMISSION });

  // Customer 1 confirming the old delivery must not free the driver from
  // the new order they just took.
  await lifecycle.requestDeliveryConfirmation({ orderId: o1, providerId: driver });
  await lifecycle.confirmDelivery({ orderId: o1, customerId: c1 });
  const hold = await blockedUntil(driver);
  assert.ok(hold && hold > new Date(), 'still held by the second order');
});
