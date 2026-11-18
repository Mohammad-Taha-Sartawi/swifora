// Wrong-kind input through the real routes and database: text instead of a
// phone number or a price, operator objects instead of text, too-long text.
// Every case must end in a clear 400 (never a 500, never stored garbage).
// MongoDB is an in-memory replica set (offers use transactions).
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'swifora-integration-jwt-secret-2026-11-input';
process.env.SESSION_SECRET = 'swifora-integration-session-secret-2026-11-input';
process.env.PASSWORD_RECOVERY_SECRET = 'swifora-integration-recovery-secret-2026-11-input';
process.env.EMAIL_DOMAIN_CHECK = 'off';

// Many wrong inputs from one account in a row: rate limits (tested on their
// own elsewhere) are switched off so every case reaches the input checks.
{
  const resolved = require.resolve('express-rate-limit');
  const real = require(resolved);
  const passThrough = () => (req, res, next) => next();
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports: Object.assign(passThrough, real, { rateLimit: passThrough, default: passThrough }),
  };
}

const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');

const User = require('../src/models/User');
const Order = require('../src/models/Order');
const ContactRequest = require('../src/models/ContactRequest');

const PASSWORD = 'Cedar!River2026#Strong';
let replSet;
let app;
let customerToken;
let driverToken;
let requestCount = 0;
const nextAddress = () => {
  requestCount += 1;
  return `198.51.${Math.floor(requestCount / 250)}.${(requestCount % 250) + 1}`;
};
const as = (token) => (req) => req.set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', nextAddress());

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: '8.2.6', downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries') },
  });
  await mongoose.connect(replSet.getUri('swifora_input_validation'));
  await Promise.all([User.init(), Order.init()]);

  app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { admin: { id: new mongoose.Types.ObjectId().toString(), role: 'admin' } };
    next();
  });
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/orders', require('../src/routes/orders'));
  app.use('/api/offers', require('../src/routes/offers'));
  app.use('/api/users', require('../src/routes/users'));
  app.use('/api/chat', require('../src/routes/chat'));
  app.use('/admin/orders', require('../src/routes/adminOrders'));

  const hash = await bcrypt.hash(PASSWORD, 4);
  await User.create([
    { fullName: 'Customer One', email: 'customer@gmail.com', password: hash, role: 'customer', status: 'active',
      area: 'Al-Bireh', publicId: '70001', phoneNumbers: [{ number: '0599123456', primary: true }] },
    { fullName: 'Driver One', email: 'driver@gmail.com', password: hash, role: 'provider', status: 'active',
      area: 'Al-Bireh', publicId: '70002', isAvailable: true, serviceTypes: ['goods'],
      phoneNumbers: [{ number: '0599654321', primary: true }] },
  ]);
  const login = async (email, role) => {
    const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextAddress())
      .send({ email, password: PASSWORD, role });
    assert.equal(res.status, 200, res.body.error);
    return res.body.token;
  };
  customerToken = await login('customer@gmail.com', 'customer');
  driverToken = await login('driver@gmail.com', 'provider');
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

const order = (body) => as(customerToken)(request(app).post('/api/orders')).send({
  type: 'goods', description: 'كرتونة ماء', phone: '0599123456', location: 'Al-Bireh', ...body,
});

test('an order needs a real mobile number, stored in one form', async () => {
  for (const phone of ['abc', '!!!', '0599', '05991234567890', '0599999999', 12345, { $ne: null }, ['0599123456']]) {
    const res = await order({ phone });
    assert.equal(res.status, 400, `${JSON.stringify(phone)} -> ${res.status}`);
    assert.equal(res.body.code, 'INVALID_PHONE', JSON.stringify(phone));
    assert.match(res.body.error, /رقم الهاتف غير صحيح/);
  }
  const ok = await order({ phone: '٠٥٩٩ ١٢٣ ٤٥٦' });
  assert.equal(ok.status, 201, ok.body.error);
  assert.equal((await Order.findById(ok.body._id).lean()).phone, '0599123456');
});

test('an order with missing, too-long or non-text fields says which one', async () => {
  const cases = [
    [{ description: '' }, 'DESCRIPTION_REQUIRED'],
    [{ description: '   ' }, 'DESCRIPTION_REQUIRED'],
    [{ description: 'x'.repeat(2001) }, 'DESCRIPTION_TOO_LONG'],
    [{ description: { $gt: '' } }, 'DESCRIPTION_REQUIRED'],
    [{ location: 'x'.repeat(501) }, 'LOCATION_TOO_LONG'],
    [{ type: 'weapons' }, 'INVALID_ORDER_INPUT'],
    [{ type: ['goods'] }, 'INVALID_ORDER_INPUT'],
  ];
  for (const [body, code] of cases) {
    const res = await order(body);
    assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 60)} -> ${res.status}`);
    assert.equal(res.body.code, code, JSON.stringify(body).slice(0, 60));
  }
});

test('an offer says whether the price or the time is wrong', async () => {
  const created = await order({});
  const offer = (body) => as(driverToken)(request(app).post('/api/offers'))
    .send({ orderId: created.body._id, price: 15, estimatedTime: 30, ...body });

  for (const price of ['abc', 'NaN', 'Infinity', -5, 0, 1e9, { $gt: 0 }, ['15'], '']) {
    const res = await offer({ price });
    assert.equal(res.status, 400, `price ${JSON.stringify(price)} -> ${res.status}`);
    assert.equal(res.body.code, 'INVALID_OFFER_INPUT', JSON.stringify(price));
    assert.match(res.body.error, /سعراً صحيحاً/);
  }
  for (const estimatedTime of [5000, -1, 'soon', 'NaN', { $lt: 5 }]) {
    const res = await offer({ estimatedTime });
    assert.equal(res.status, 400, `time ${JSON.stringify(estimatedTime)} -> ${res.status}`);
    assert.equal(res.body.code, 'INVALID_ESTIMATED_TIME', JSON.stringify(estimatedTime));
  }
  for (const orderId of ['abc', { $ne: null }, '../../etc/passwd']) {
    const res = await offer({ orderId });
    assert.equal(res.status, 400, `orderId ${JSON.stringify(orderId)} -> ${res.status}`);
  }
  const ok = await offer({ price: '12.5', estimatedTime: '20' });
  assert.equal(ok.status, 201, ok.body.error);
});

test('a name must be text of 2-80 characters, on sign-up and in the profile', async () => {
  for (const fullName of ['x'.repeat(81), 'a', '   ', 12345, { $ne: null }, ['Ali']]) {
    const res = await as(customerToken)(request(app).put('/api/users/profile')).send({ fullName });
    assert.equal(res.status, 400, `${JSON.stringify(fullName).slice(0, 40)} -> ${res.status}`);
    assert.equal(res.body.code, 'INVALID_NAME');
  }
  const ok = await as(customerToken)(request(app).put('/api/users/profile')).send({ fullName: '  علي   أحمد \n' });
  assert.equal(ok.status, 200, ok.body.error);
  assert.equal((await User.findOne({ email: 'customer@gmail.com' }).lean()).fullName, 'علي أحمد');

  const register = await request(app).post('/api/auth/register').set('X-Forwarded-For', nextAddress()).send({
    fullName: 'x'.repeat(500), email: 'new.customer@gmail.com', phone: '0598123456', password: PASSWORD,
    role: 'customer', governorate: 'رام الله والبيرة', area: 'Al-Bireh', privacyPolicy: true,
  });
  assert.equal(register.status, 400);
  assert.equal(register.body.code, 'INVALID_NAME');
  assert.equal(await User.countDocuments({ email: 'new.customer@gmail.com' }), 0);
});

test('a guest support request refuses a phone that is not a number', async () => {
  const contact = (body) => request(app).post('/api/chat/contact').set('X-Forwarded-For', nextAddress())
    .send({ name: 'Guest', text: 'لا أستطيع إنشاء حساب', ...body });

  const bad = await contact({ phone: 'abc' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'CONTACT_PHONE_INVALID');

  const ok = await contact({ phone: '٠٥٩٩١٢٣٤٥٦' });
  assert.equal(ok.status, 201, ok.body.error);
  assert.equal((await ContactRequest.findById(ok.body.contactId).lean()).phone, '0599123456');

  const emailOnly = await contact({ email: 'guest@gmail.com' });
  assert.equal(emailOnly.status, 201, emailOnly.body.error);
});

test('the dashboard order search treats text literally (no regex errors or slow patterns)', async () => {
  for (const q of ['(', '(a+)+$', '.*', '[', 'a'.repeat(5000)]) {
    const started = Date.now();
    const res = await request(app).get('/admin/orders').query({ q });
    assert.equal(res.status, 200, `${q.slice(0, 20)} -> ${res.status}`);
    assert.ok(Date.now() - started < 3000, `${q.slice(0, 20)} took too long`);
  }
  const all = await request(app).get('/admin/orders').query({ q: '.*' });
  assert.equal(all.body.orders?.length ?? all.body.length, 0, '".*" is text, not "match everything"');

  const repeated = await request(app).get('/admin/orders?status=pending&status=completed');
  assert.equal(repeated.status, 200);
});

test('an id in the address that is not a database id is "not found", never a server error', async () => {
  const bad = ['abc', '..', '..%2F..%2Fetc%2Fpasswd', '%7B%22%24ne%22%3A1%7D', 'x'.repeat(300), 'abc%00.png'];
  for (const id of bad) {
    for (const [method, url, token] of [
      ['put', `/api/orders/${id}/complete`, driverToken],
      ['put', `/api/orders/${id}/confirm-delivery`, customerToken],
      ['post', `/api/offers/${id}/accept`, customerToken],
      ['get', `/api/offers/order/${id}`, customerToken],
      ['post', `/admin/orders/${id}/cancel`, null],
    ]) {
      let req = request(app)[method](url);
      if (token) req = as(token)(req);
      const res = await req.send({});
      assert.ok(res.status === 404 || res.status === 400, `${method} ${url.slice(0, 50)} -> ${res.status}`);
    }
  }
});

test('saved items are short text in a bounded list', async () => {
  const save = (item) => as(customerToken)(request(app).post('/api/users/frequent-items')).send({ item });
  for (const item of [['a'], { $ne: null }, 5, '', '   ', 'x'.repeat(101)]) {
    const res = await save(item);
    assert.equal(res.status, 400, `${JSON.stringify(item).slice(0, 30)} -> ${res.status}`);
    assert.equal(res.body.code, 'INVALID_ITEM');
  }
  for (let i = 0; i < 50; i += 1) {
    assert.equal((await save(`item ${i}`)).status, 200);
  }
  const full = await save('one too many');
  assert.equal(full.status, 400);
  assert.equal(full.body.code, 'TOO_MANY_ITEMS');
});
