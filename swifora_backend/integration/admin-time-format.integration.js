// Each admin chooses how the dashboard shows times: 12-hour with AM/PM (the
// default) or 24-hour. The choice is saved on the admin's own account and
// does not change other admins.
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-timefmt';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-timefmt';

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const Admin = require('../src/models/Admin');
const { loadAdminById } = require('../src/middleware/requireAdminSession');

let mongoServer;
let app;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '8.2.6', downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries') },
  });
  await mongoose.connect(mongoServer.getUri('swifora_admin_time_format'));
  await Admin.init();
  app = express();
  app.use(express.json());
  // The session and CSRF checks have their own tests; here a header names
  // the signed-in admin, loaded the same way the session check loads it.
  app.use('/admin/api', async (req, res, next) => {
    const admin = await loadAdminById(req.get('x-test-admin'));
    if (!admin) return res.status(401).end();
    req.adminUser = { id: String(admin._id), timeFormat: admin.timeFormat === '24h' ? '24h' : '12h' };
    return next();
  }, require('../src/routes/adminApi'));
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(() => Admin.deleteMany({}));

let n = 0;
const admin = () => {
  n += 1;
  return Admin.create({ fullName: `Admin ${n}`, email: `a${n}@example.test`, password: 'x' });
};
const as = (who, req) => req.set('x-test-admin', String(who._id));

test('12-hour is the default, and an admin can switch to 24-hour and back', async () => {
  const a = await admin();
  const b = await admin();
  assert.equal((await as(a, request(app).get('/admin/api/preferences')).expect(200)).body.timeFormat, '12h');

  const saved = await as(a, request(app).put('/admin/api/preferences')).send({ timeFormat: '24h' }).expect(200);
  assert.deepEqual(saved.body, { success: true, timeFormat: '24h' });
  assert.equal((await as(a, request(app).get('/admin/api/preferences')).expect(200)).body.timeFormat, '24h');
  // Another admin keeps their own choice.
  assert.equal((await as(b, request(app).get('/admin/api/preferences')).expect(200)).body.timeFormat, '12h');

  await as(a, request(app).put('/admin/api/preferences')).send({ timeFormat: '12h' }).expect(200);
  assert.equal((await Admin.findById(a._id).lean()).timeFormat, '12h');
});

test('anything else is refused', async () => {
  const a = await admin();
  for (const timeFormat of ['', '13h', 24, null, ['24h']]) {
    const res = await as(a, request(app).put('/admin/api/preferences')).send({ timeFormat });
    assert.equal(res.status, 400, JSON.stringify(timeFormat));
    assert.equal(res.body.success, false);
  }
  assert.equal((await Admin.findById(a._id).lean()).timeFormat, '12h');
});
