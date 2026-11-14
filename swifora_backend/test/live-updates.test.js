const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  COLLECTION_TOPICS,
  createLiveNotifier,
  planLiveEffects,
} = require('../src/services/liveUpdates');

const change = (coll, operationType = 'insert', extra = {}) => ({
  ns: { coll },
  operationType,
  documentKey: { _id: { toString: () => 'doc-1' } },
  ...extra,
});

test('each collection refreshes the right dashboard pages', () => {
  assert.deepEqual(planLiveEffects(change('orders')).adminTopics, COLLECTION_TOPICS.orders);
  assert.ok(planLiveEffects(change('pendingproviders')).adminTopics.includes('pending-providers'));
  assert.ok(planLiveEffects(change('reports')).adminTopics.includes('driver-reports'));
  assert.ok(planLiveEffects(change('adstats')).adminTopics.includes('ads'));
  assert.deepEqual(planLiveEffects(change('pushtokens')).adminTopics, []);
});

test('ad changes reach customers and drivers', () => {
  const { appEvents } = planLiveEffects(change('ads', 'update'));
  assert.deepEqual(appEvents, [
    { room: 'role:customer', event: 'ads_changed' },
    { room: 'role:provider', event: 'ads_changed' },
  ]);
});

test('user changes: availability for customers, account for the user', () => {
  const availability = planLiveEffects(change('users', 'update', {
    updateDescription: { updatedFields: { isAvailable: false }, removedFields: [] },
  }));
  assert.deepEqual(availability.appEvents, [
    { room: 'role:customer', event: 'drivers_changed' },
    { room: 'user:doc-1', event: 'account_changed' },
  ]);

  const profile = planLiveEffects(change('users', 'update', {
    updateDescription: { updatedFields: { 'phoneNumbers.0': '059' }, removedFields: [] },
  }));
  assert.deepEqual(profile.appEvents, [{ room: 'user:doc-1', event: 'account_changed' }]);

  // Routine writes (session version, location, cooldowns) wake nobody.
  const routine = planLiveEffects(change('users', 'update', {
    updateDescription: {
      updatedFields: { sessionVersion: 3, lastLocation: {}, offerCooldownUntil: null },
      removedFields: [],
    },
  }));
  assert.deepEqual(routine.appEvents, []);
  assert.ok(routine.adminTopics.includes('drivers'), 'the dashboard still refreshes');
});

test('a commission payment refreshes that driver\'s earnings', () => {
  const { appEvents } = planLiveEffects(change('commissionpayments', 'insert', {
    fullDocument: { driverId: { toString: () => 'driver-9' } },
  }));
  assert.deepEqual(appEvents, [{ room: 'user:driver-9', event: 'earnings_changed' }]);
});

test('bursts are merged into one message per room and event', () => {
  const sent = [];
  const timers = [];
  const io = { to: (room) => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) };
  const notifier = createLiveNotifier(io, {
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: () => {},
  });

  notifier.apply(planLiveEffects(change('orders')));
  notifier.apply(planLiveEffects(change('offers')));
  notifier.apply(planLiveEffects(change('ads')));
  notifier.apply(planLiveEffects(change('ads')));
  assert.equal(sent.length, 0, 'nothing before the delay');
  timers.forEach((fire) => fire());

  const admin = sent.filter((item) => item.event === 'admin_update');
  assert.equal(admin.length, 1);
  assert.equal(admin[0].room, 'admins');
  assert.deepEqual(
    admin[0].payload.topics,
    [...new Set([...COLLECTION_TOPICS.orders, ...COLLECTION_TOPICS.offers, ...COLLECTION_TOPICS.ads])].sort(),
  );
  assert.equal(sent.filter((item) => item.event === 'ads_changed').length, 2);
});

test('the server starts live updates and puts sockets in their rooms', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  assert.match(index, /startLiveUpdates\(\{ io, db: mongoose\.connection\.db \}\)/);
  assert.match(index, /socket\.join\('admins'\)/);
  assert.match(index, /socket\.join\(`role:\$\{socket\.userRole\}`\)/);
});
