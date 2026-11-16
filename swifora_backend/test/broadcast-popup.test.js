// Broadcast messages pop up in the apps: they stay pinned in the
// notifications for 72 hours, and confirming the pop-up records
// acknowledgedAt without deleting the message.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('broadcast messages are pinned for 72 hours', () => {
  const route = read('src/routes/adminBroadcast.js');
  assert.match(route, /const BROADCAST_PIN_MS = 72 \* 60 \* 60 \* 1000;/);
  assert.match(route, /pinned: true,[\s\S]*expireAt: new Date\(Date\.now\(\) \+ BROADCAST_PIN_MS\)/);
  // The reply carries the moment as data; the dashboard formats it.
  assert.match(route, /sentAt: new Date\(\)\.toISOString\(\)/);
});

test('notifications remember when a broadcast pop-up was confirmed', () => {
  const Notification = require('../src/models/Notification');
  const field = Notification.schema.path('acknowledgedAt');
  assert.ok(field, 'acknowledgedAt exists');
  assert.equal(field.instance, 'Date');
  assert.equal(field.defaultValue, null);
});

test('confirming the pop-up only marks it, for the owner\'s broadcasts', () => {
  const route = read('src/routes/notifications.js');
  const ack = route.slice(route.indexOf("router.put('/:id/ack'"));
  const body = ack.slice(0, ack.indexOf('\n});') + 4);
  assert.match(body, /userId: req\.userId, type: 'broadcast'/);
  assert.match(body, /\$set: \{ acknowledgedAt: new Date\(\) \}/);
  assert.doesNotMatch(body, /delete/i);
  // Declared before '/read-all' and after auth + role checks for the router.
  assert.ok(route.indexOf("router.put('/:id/ack'") > route.indexOf('router.use(auth'));
});
