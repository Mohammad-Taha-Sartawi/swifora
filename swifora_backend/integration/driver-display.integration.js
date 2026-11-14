// The dashboard setting that shows or hides the driver's "commission due"
// card. Real MongoDB (in-memory).
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const CommissionSetting = require('../src/models/CommissionSetting');
const {
  getCommissionConfig,
  getDriverDisplaySettings,
  setDriverCommissionCardVisible,
} = require('../src/services/commissionSettings');
const { planLiveEffects } = require('../src/services/liveUpdates');

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_driver_display'));
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('the card is shown by default, also before any setting exists', async () => {
  assert.deepEqual(await getDriverDisplaySettings(), { showCommissionCard: true });

  // An existing commission setting from before this option also shows it.
  await CommissionSetting.collection.insertOne({ key: 'platform', type: 'percent', value: 10 });
  assert.deepEqual(await getDriverDisplaySettings(), { showCommissionCard: true });
});

test('hiding and showing again keeps the commission rate untouched', async () => {
  assert.deepEqual(await setDriverCommissionCardVisible(false), { showCommissionCard: false });
  assert.deepEqual(await getDriverDisplaySettings(), { showCommissionCard: false });
  assert.deepEqual(await getCommissionConfig(), { type: 'percent', value: 10 });

  assert.deepEqual(await setDriverCommissionCardVisible(true), { showCommissionCard: true });
  assert.equal(await CommissionSetting.countDocuments(), 1);
});

test('drivers\' apps reload when the setting changes; stats carry the flag', () => {
  const { appEvents, adminTopics } = planLiveEffects({
    ns: { coll: 'commissionsettings' },
    operationType: 'update',
    documentKey: { _id: 'x' },
  });
  assert.deepEqual(appEvents, [{ room: 'role:provider', event: 'earnings_changed' }]);
  assert.ok(adminTopics.includes('commissions'));

  const provider = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'provider.js'), 'utf8');
  assert.match(provider, /showCommissionCard: \(await getDriverDisplaySettings\(\)\)\.showCommissionCard/);
  const adminApi = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'adminApi.js'), 'utf8');
  assert.match(adminApi, /router\.put\('\/driver-display-settings'/);
  assert.match(adminApi, /typeof visible !== 'boolean'/);
});
