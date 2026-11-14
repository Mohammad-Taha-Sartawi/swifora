// Database changes reach the dashboard and the apps through a real MongoDB
// change stream (in-memory replica set).
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');
const { startLiveUpdates } = require('../src/services/liveUpdates');

let replSet;
let live;
const sent = [];
const io = {
  to: (room) => ({ emit: (event, payload) => sent.push({ room, event, payload }) }),
};

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(replSet.getUri('swifora_live'));
  live = startLiveUpdates({ io, db: mongoose.connection.db, log: { error() {}, warn() {} } });
  await new Promise((r) => setTimeout(r, 500));
});

after(async () => {
  if (live) await live.stop();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

async function waitFor(predicate, ms = 8000) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const hit = sent.find(predicate);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

test('a new order refreshes the dashboard pages', async () => {
  await mongoose.connection.db.collection('orders').insertOne({ status: 'pending' });
  const update = await waitFor((item) => item.event === 'admin_update'
    && item.payload.topics.includes('orders'));
  assert.ok(update, 'admin_update with orders');
  assert.equal(update.room, 'admins');
});

test('an admin editing a driver reaches that driver and the customers', async () => {
  const users = mongoose.connection.db.collection('users');
  const { insertedId } = await users.insertOne({ role: 'provider', isAvailable: true });
  await users.updateOne({ _id: insertedId }, { $set: { isAvailable: false } });

  assert.ok(await waitFor((item) => item.event === 'account_changed'
    && item.room === `user:${insertedId}`));
  assert.ok(await waitFor((item) => item.event === 'drivers_changed'
    && item.room === 'role:customer'));
});

test('a new ad tells the apps to reload their banner', async () => {
  await mongoose.connection.db.collection('ads').insertOne({ title: 'x' });
  assert.ok(await waitFor((item) => item.event === 'ads_changed'
    && item.room === 'role:customer'));
  assert.ok(await waitFor((item) => item.event === 'ads_changed'
    && item.room === 'role:provider'));
});
