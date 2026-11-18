// Wrong-kind input reaching the server: names, request bodies that are not
// JSON objects, and search text that must not become a regular expression.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { personName, clientRequestError, MAX_PERSON_NAME } = require('../src/security/requestInput');
const { escapeRegex } = require('../src/services/accountSearch');

const source = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('a name is text of 2-80 characters; anything else is refused', () => {
  assert.equal(MAX_PERSON_NAME, 80);
  assert.equal(personName('  محمد   علي \n\n'), 'محمد علي');
  assert.equal(personName('Ahmad\tSalem'), 'Ahmad Salem');
  assert.equal(personName('أحمد\u0000سالم'), 'أحمد سالم');
  assert.equal(personName('x'.repeat(80)), 'x'.repeat(80));
  for (const bad of [undefined, null, '', '   ', 'a', 'x'.repeat(81), 5, true, [], ['Ahmad'], { $ne: null }, { a: 1 }]) {
    assert.equal(personName(bad), null, JSON.stringify(bad));
  }
});

test('a request body that is not a JSON object is a 400, not a server error', () => {
  const parseError = Object.assign(new SyntaxError('Unexpected token'), {
    status: 400, expose: true, type: 'entity.parse.failed',
  });
  assert.deepEqual(clientRequestError(parseError), {
    status: 400,
    body: { error: 'Request body must be a JSON object', code: 'INVALID_REQUEST_BODY' },
  });

  const tooLarge = Object.assign(new Error('too large'), { status: 413, expose: true, type: 'entity.too.large' });
  assert.equal(clientRequestError(tooLarge).status, 413);
  assert.equal(clientRequestError(tooLarge).body.code, 'BODY_TOO_LARGE');

  // Real server errors stay server errors.
  assert.equal(clientRequestError(new Error('boom')), null);
  assert.equal(clientRequestError(Object.assign(new Error('db'), { status: 500, expose: false })), null);
  assert.equal(clientRequestError(null), null);

  assert.match(source('src/index.js'), /const clientError = clientRequestError\(err\);/);
});

test('admin order search text is matched literally', () => {
  const pattern = new RegExp(escapeRegex('(a+)+$'), 'i');
  assert.ok(pattern.test('order (a+)+$ text'));
  assert.ok(!pattern.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!'));
  assert.doesNotThrow(() => new RegExp(escapeRegex('('), 'i'));

  const route = source('src/routes/adminOrders.js');
  assert.match(route, /\$regex: escapeRegex\(q\)/);
  assert.doesNotMatch(route, /\$regex: text\b/);
});

test('drivers join only their registered area room, never one the client names', () => {
  const index = source('src/index.js');
  assert.doesNotMatch(index, /handshake\.query\??\.area/);
  assert.match(index, /if \(area\) \{\s*socket\.join\(`area:\$\{area\}`\);/);
});

test('every JWT verification is pinned to HS256', () => {
  for (const file of ['src/middleware/auth.js', 'src/socket/authenticateSocket.js', 'src/routes/auth.js']) {
    const text = source(file);
    const verifies = text.match(/jwt\.verify\([^;]*;/g) || [];
    assert.ok(verifies.length >= 1, file);
    for (const call of verifies) {
      assert.match(call, /algorithms: \['HS256'\]/, `${file}: ${call}`);
    }
  }
});

test('app passwords are hashed with bcrypt cost 12', () => {
  const { PASSWORD_HASH_ROUNDS } = require('../src/security/passwordPolicy');
  assert.equal(PASSWORD_HASH_ROUNDS, 12);
  for (const file of ['src/routes/auth.js', 'src/routes/users.js', 'src/routes/passwordRecovery.js', 'src/routes/adminUsers.js', 'src/routes/adminDrivers.js']) {
    const text = source(file);
    assert.doesNotMatch(text, /bcrypt\.hash\([^)]*,\s*10\s*,?\s*\)/, file);
  }
});

test('order and offer notifications are kept 30 days (no shorter hard-coded life)', () => {
  for (const file of ['src/routes/orders.js', 'src/routes/offers.js', 'src/routes/adminReports.js']) {
    const text = source(file);
    assert.doesNotMatch(text, /expireAt: new Date\(Date\.now\(\) \+ \d+ \* 24 \* 60 \* 60 \* 1000\)/, file);
    assert.match(text, /expireAt: notificationExpiry\(\)/, file);
  }
});
