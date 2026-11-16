// Dashboard search for drivers and customers: by ID, email, any of their
// phone numbers (however written) or part of the name; one exact hit opens
// the account, several partial hits come back as a list. The commissions
// and areas data carry the email and numbers for the search boxes there.
// Real HTTP and MongoDB (in-memory); the admin session is a stand-in.
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
const adminDriverRoutes = require('../src/routes/adminDrivers');
const adminUserRoutes = require('../src/routes/adminUsers');
const adminCommissionRoutes = require('../src/routes/adminCommissions');
const adminAreaRoutes = require('../src/routes/adminAreas');

let mongoServer;
let app;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_account_search'));
  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { admin: { id: new mongoose.Types.ObjectId().toString(), role: 'admin' } };
    next();
  });
  app.use('/admin/drivers', adminDriverRoutes);
  app.use('/admin/users', adminUserRoutes);
  app.use('/admin/commissions', adminCommissionRoutes);
  app.use('/admin/areas', adminAreaRoutes);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

let ahmad;
let sara;
beforeEach(async () => {
  await User.deleteMany({});
  ahmad = await User.create({
    fullName: 'Ahmad Salem',
    email: 'ahmad.salem@gmail.com',
    password: 'x',
    role: 'provider',
    status: 'active',
    publicId: '48213',
    governorate: 'رام الله والبيرة',
    area: 'Al-Bireh',
    phoneNumbers: [
      { number: '0599123456', primary: true },
      // An older number saved with spaces.
      { number: '056 876 5432', primary: false },
    ],
  });
  await User.create({
    fullName: 'Ahmad Khaled',
    email: 'ahmad.k@hotmail.com',
    password: 'x',
    role: 'provider',
    status: 'active',
    publicId: '48299',
    phoneNumbers: [{ number: '+970599773456', primary: true }],
  });
  sara = await User.create({
    fullName: 'Sara Customer',
    email: 'sara@gmail.com',
    password: 'x',
    role: 'customer',
    status: 'active',
    publicId: '70001',
    governorate: 'رام الله والبيرة',
    area: 'Al-Bireh',
    phoneNumbers: [{ number: '+972527123456', primary: true }],
  });
  // A deleted driver with the same number is never found.
  await User.create({
    fullName: 'Old Driver',
    email: 'old@gmail.com',
    password: 'x',
    role: 'provider',
    deleted: true,
    phoneNumbers: [{ number: '0599123456', primary: true }],
  });
});

const findDriver = (q) => request(app).get('/admin/drivers/search').query({ id: q });
const findUser = (q) => request(app).get('/admin/users/search').query({ id: q });

test('a driver is found by ID, email or any of his numbers, written any way', async () => {
  for (const query of [
    '48213', 'ID 48213', 'ahmad.salem@gmail.com', 'AHMAD.SALEM@GMAIL.COM',
    '0599123456', '+970599123456', '+972 59 912 3456', '٠٥٩٩١٢٣٤٥٦', '0568765432',
    ahmad._id.toString(),
  ]) {
    const res = await findDriver(query).expect(200);
    assert.equal(res.body.error, undefined, `${query}: ${res.body.error}`);
    assert.equal(res.body.matches, undefined, `${query} should be one driver`);
    assert.match(JSON.stringify(res.body), /48213/, query);
  }
});

test('several partial hits come back as a list to choose from', async () => {
  for (const query of ['ahmad', '3456', 'gmail.com', 'hotmail']) {
    const res = await findDriver(query).expect(200);
    if (query === 'hotmail') {
      assert.equal(res.body.matches, undefined);
      assert.match(JSON.stringify(res.body), /48299/);
      continue;
    }
    if (query === 'gmail.com') {
      // Only one active driver uses gmail (the deleted one is excluded).
      assert.equal(res.body.matches, undefined);
      assert.match(JSON.stringify(res.body), /48213/);
      continue;
    }
    assert.ok(Array.isArray(res.body.matches), `${query} should list drivers`);
    assert.deepEqual(res.body.matches.map((m) => m.publicId).sort(), ['48213', '48299']);
    const first = res.body.matches.find((m) => m.publicId === '48213');
    assert.equal(first.email, 'ahmad.salem@gmail.com');
    assert.equal(first.phone, '0599123456');
  }
});

test('drivers and customers stay apart, nothing found is said clearly', async () => {
  // Three digits are too few to search part of a number (and match no ID).
  const short = await findDriver('456').expect(200);
  assert.equal(short.body.error, 'لم يتم العثور على سائق');

  const customerAsDriver = await findDriver('sara@gmail.com').expect(200);
  assert.equal(customerAsDriver.body.error, 'لم يتم العثور على سائق');

  const missing = await findDriver('0591111111').expect(200);
  assert.equal(missing.body.error, 'لم يتم العثور على سائق');

  const empty = await findDriver('   ').expect(200);
  assert.match(empty.body.error, /رقم الهاتف/);

  // Text that looks like a pattern is searched literally.
  const pattern = await findDriver('.*').expect(200);
  assert.equal(pattern.body.error, 'لم يتم العثور على سائق');
});

test('a customer is found by ID, email or number', async () => {
  for (const query of ['70001', 'sara@gmail.com', '0527123456', '+972527123456', 'Sara']) {
    const res = await findUser(query).expect(200);
    assert.equal(res.body.error, undefined, `${query}: ${res.body.error}`);
    assert.equal(res.body.user.publicId, '70001', query);
  }
  const notACustomer = await findUser('48213').expect(200);
  assert.equal(notACustomer.body.error, 'لم يتم العثور على مستخدم');
});

test('commissions and areas carry the email and every number for their search boxes', async () => {
  const commissions = await request(app).get('/admin/commissions').expect(200);
  const row = commissions.body.driverRows.find((r) => r.driverId === '48213');
  assert.equal(row.email, 'ahmad.salem@gmail.com');
  assert.deepEqual(row.phones, ['0599123456', '056 876 5432']);

  const areas = await request(app).get('/admin/areas').expect(200);
  const city = areas.body.stats['رام الله والبيرة'].cities.find((c) => c.name === 'Al-Bireh');
  const driver = city.driverAccounts.find((a) => a.publicId === '48213');
  assert.equal(driver.email, 'ahmad.salem@gmail.com');
  assert.deepEqual(driver.phones, ['0599123456', '056 876 5432']);
  const customer = city.userAccounts.find((a) => a.id === sara._id.toString());
  assert.deepEqual(customer.phones, ['+972527123456']);
});
