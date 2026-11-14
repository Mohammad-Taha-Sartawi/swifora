// Administrators live in their own "admins" collection, separate from
// customers and drivers in "users". Real MongoDB (in-memory).
const { after, afterEach, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const { migrateAdminsFromUsers } = require('../src/services/adminMigration');
const {
  AdminCreationError,
  createAdmin,
  resolveAdminPassword,
} = require('../src/services/adminCreation');
const requireAdminSession = require('../src/middleware/requireAdminSession');
const { adminPasswordMatches } = require('../src/security/adminPassword');

const PASSWORD = 'Cedar!River2026#Strong';
let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_admins'));
  await Promise.all([User.createIndexes(), Admin.createIndexes()]);
});

afterEach(async () => {
  await Promise.all([
    User.collection.deleteMany({}),
    Admin.collection.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function legacyAdminInUsers(overrides = {}) {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id,
    fullName: 'Legacy Admin',
    email: 'legacy.admin@example.test',
    phone: '0599000001',
    password: await bcrypt.hash(PASSWORD, 4),
    role: 'admin',
    status: 'active',
    deleted: false,
    sessionVersion: 3,
    adminTotpSecret: 'encrypted-secret',
    adminTotpEnabled: true,
    adminTotpRecoveryCodeHashes: ['h1', 'h2'],
    adminTotpEnabledAt: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
  return _id;
}

test('an admin left in users moves to admins with its id, password and 2FA', async () => {
  const id = await legacyAdminInUsers();
  await User.collection.insertOne({
    fullName: 'Some Driver',
    email: 'driver@example.test',
    role: 'provider',
    status: 'active',
  });

  assert.equal(await migrateAdminsFromUsers(), 1);

  assert.equal(await User.collection.countDocuments({ role: 'admin' }), 0);
  assert.equal(await User.collection.countDocuments({}), 1, 'drivers stay in users');
  const moved = await Admin.collection.findOne({ _id: id });
  assert.equal(moved.email, 'legacy.admin@example.test');
  assert.equal(moved.sessionVersion, 3);
  assert.equal(moved.adminTotpEnabled, true);
  assert.equal(moved.adminTotpSecret, 'encrypted-secret');
  assert.deepEqual(moved.adminTotpRecoveryCodeHashes, ['h1', 'h2']);
  assert.equal(moved.phone, undefined, 'user-only fields are not copied');
  assert.equal(await adminPasswordMatches(PASSWORD, moved.password), true);

  // The existing dashboard session (same id + version) is still accepted.
  const loaded = await requireAdminSession.loadAdminById(id.toString());
  assert.equal(loaded.email, 'legacy.admin@example.test');
  assert.equal(loaded.sessionVersion, 3);
});

test('running the move again changes nothing', async () => {
  await legacyAdminInUsers();
  assert.equal(await migrateAdminsFromUsers(), 1);
  assert.equal(await migrateAdminsFromUsers(), 0);
  assert.equal(await Admin.collection.countDocuments({}), 1);
});

test('an interrupted move (copy written, user not removed) finishes cleanly', async () => {
  const id = await legacyAdminInUsers();
  const doc = await User.collection.findOne({ _id: id });
  await Admin.collection.insertOne({ ...doc });
  assert.equal(await migrateAdminsFromUsers(), 1);
  assert.equal(await User.collection.countDocuments({}), 0);
  assert.equal(await Admin.collection.countDocuments({}), 1);
});

test('an email clash with an existing admin keeps the old account in users', async () => {
  await createAdmin({
    email: 'legacy.admin@example.test',
    fullName: 'New Admin',
    password: PASSWORD,
  });
  await legacyAdminInUsers();
  const lines = [];
  assert.equal(await migrateAdminsFromUsers({ log: (line) => lines.push(line) }), 0);
  assert.equal(await User.collection.countDocuments({ role: 'admin' }), 1);
  assert.match(lines.join('\n'), /email already used in admins/);
});

test('a blocked legacy admin moves but cannot use the dashboard', async () => {
  const id = await legacyAdminInUsers({ status: 'blocked' });
  await migrateAdminsFromUsers();
  assert.equal((await Admin.collection.findOne({ _id: id })).status, 'inactive');
  assert.equal(await requireAdminSession.loadAdminById(id.toString()), null);
});

test('createAdmin stores the admin in admins only, hashed, and refuses duplicates', async () => {
  const admin = await createAdmin({
    email: '  New.Admin@Example.TEST ',
    fullName: 'New Admin',
    password: PASSWORD,
  });
  assert.equal(admin.email, 'new.admin@example.test');
  assert.equal(await User.collection.countDocuments({}), 0);
  const stored = await Admin.collection.findOne({ _id: admin._id });
  assert.notEqual(stored.password, PASSWORD);
  assert.equal(await adminPasswordMatches(PASSWORD, stored.password), true);

  await assert.rejects(
    createAdmin({ email: 'new.admin@example.test', fullName: 'Again', password: PASSWORD }),
    AdminCreationError,
  );
  await assert.rejects(
    createAdmin({ email: 'other@example.test', fullName: 'Weak', password: 'short' }),
    AdminCreationError,
  );

  // A refused request never generates (or writes) a password.
  let resolverCalls = 0;
  await assert.rejects(
    createAdmin({
      email: 'new.admin@example.test',
      fullName: 'Again',
      password: () => { resolverCalls += 1; return PASSWORD; },
    }),
    AdminCreationError,
  );
  assert.equal(resolverCalls, 0);
});

test('user-side bulk deletes cannot reach an admin', async () => {
  await createAdmin({
    email: 'safe.admin@example.test',
    fullName: 'Safe Admin',
    password: PASSWORD,
  });
  await User.deleteMany({});
  assert.equal(await Admin.countDocuments({}), 1);
});

test('ADMIN_PASSWORD_FILE writes a random password to a new file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swifora-admin-pw-'));
  const file = path.join(dir, 'password.txt');
  try {
    const password = resolveAdminPassword({ ADMIN_PASSWORD_FILE: file });
    assert.equal(fs.readFileSync(file, 'utf8'), password);
    assert.ok(password.length >= 20);
    assert.throws(
      () => resolveAdminPassword({ ADMIN_PASSWORD_FILE: file }),
      /already exists/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
