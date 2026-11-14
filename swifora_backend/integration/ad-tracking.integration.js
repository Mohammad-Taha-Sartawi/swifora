// Ad views and taps sent by the apps, and the dashboard tracking figures.
// Real MongoDB (in-memory).
const { after, afterEach, before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const Ad = require('../src/models/Ad');
const AdStat = require('../src/models/AdStat');
const AdEventUser = require('../src/models/AdEventUser');
const {
  AdEventError,
  adDailyReport,
  adDayKey,
  adTrackingReport,
  recordAdEvents,
} = require('../src/services/adTracking');

let mongoServer;
const NOW = new Date('2026-11-14T10:00:00Z');

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: path.join(os.tmpdir(), 'swifora-mongodb-binaries'),
    },
  });
  await mongoose.connect(mongoServer.getUri('swifora_ad_tracking'));
  await Promise.all([AdStat.createIndexes(), AdEventUser.createIndexes()]);
});

afterEach(async () => {
  await Promise.all([
    Ad.deleteMany({}),
    AdStat.deleteMany({}),
    AdEventUser.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function ad(title) {
  return Ad.create({
    title,
    images: ['/uploads/ads/a.png'],
    endsAt: new Date('2026-12-01T00:00:00Z'),
    link: 'app:create_order',
  });
}

const user = () => new mongoose.Types.ObjectId();

test('views and taps are counted per day, users once per day', async () => {
  const a = await ad('A');
  const id = a._id.toString();
  const [u1, u2] = [user(), user()];

  await recordAdEvents({ userId: u1, now: NOW, events: [
    { adId: id, type: 'impression' },
    { adId: id, type: 'impression' },
  ] });
  await recordAdEvents({ userId: u1, now: NOW, events: [{ adId: id, type: 'tap' }] });
  await recordAdEvents({ userId: u2, now: NOW, events: [{ adId: id, type: 'impression' }] });

  const stat = await AdStat.findOne({ adId: a._id }).lean();
  assert.equal(stat.day, adDayKey(NOW));
  assert.equal(stat.impressions, 3);
  assert.equal(stat.viewers, 2);
  assert.equal(stat.taps, 1);
  assert.equal(stat.tappers, 1);

  // Next day the same user counts again as a viewer.
  const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
  await recordAdEvents({ userId: u1, now: tomorrow, events: [{ adId: id, type: 'impression' }] });
  assert.equal(await AdStat.countDocuments({ adId: a._id }), 2);
});

test('events for unknown ads are ignored; malformed batches refused', async () => {
  const counted = await recordAdEvents({
    userId: user(),
    now: NOW,
    events: [{ adId: new mongoose.Types.ObjectId().toString(), type: 'impression' }],
  });
  assert.equal(counted, 0);
  assert.equal(await AdStat.countDocuments(), 0);

  for (const events of [
    [],
    [{ adId: 'nope', type: 'impression' }],
    [{ adId: new mongoose.Types.ObjectId().toString(), type: 'like' }],
    Array.from({ length: 21 }, () => ({ adId: new mongoose.Types.ObjectId().toString(), type: 'tap' })),
    'not a list',
  ]) {
    await assert.rejects(
      recordAdEvents({ userId: user(), now: NOW, events }),
      AdEventError,
    );
  }
});

test('the tracking report sums the period, per ad and per day', async () => {
  const [a, b] = [await ad('A'), await ad('B')];
  const day = (offset) => new Date(NOW.getTime() - offset * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 4; i += 1) {
    await recordAdEvents({ userId: user(), now: day(0), events: [{ adId: a._id.toString(), type: 'impression' }] });
  }
  await recordAdEvents({ userId: user(), now: day(0), events: [{ adId: a._id.toString(), type: 'tap' }] });
  await recordAdEvents({ userId: user(), now: day(3), events: [{ adId: a._id.toString(), type: 'impression' }] });
  await recordAdEvents({ userId: user(), now: day(10), events: [{ adId: b._id.toString(), type: 'impression' }] });

  const week = await adTrackingReport({ days: 7, now: NOW });
  assert.equal(week.totals.impressions, 5, 'the 10-day-old view is outside the week');
  assert.equal(week.totals.taps, 1);
  assert.equal(week.totals.ctr, 20);
  assert.equal(week.ads.length, 2, 'ads without events are listed too');
  assert.equal(week.ads[0].title, 'A');
  assert.equal(week.ads[0].impressions, 5);
  assert.equal(week.ads[1].impressions, 0);
  assert.equal(week.days.length, 2);

  // One person tapping five times still counts once in the rate.
  const fan = user();
  await recordAdEvents({ userId: fan, now: NOW, events: [{ adId: b._id.toString(), type: 'impression' }] });
  for (let i = 0; i < 5; i += 1) {
    await recordAdEvents({ userId: fan, now: NOW, events: [{ adId: b._id.toString(), type: 'tap' }] });
  }
  const withFan = await adTrackingReport({ days: 1, now: NOW });
  const bRow = withFan.ads.find((row) => row.title === 'B');
  assert.equal(bRow.taps, 5);
  assert.equal(bRow.ctr, 100);

  const today = await adTrackingReport({ days: 1, now: NOW });
  assert.equal(today.totals.impressions, 5, 'four for A and the fan view of B');

  // The fan saw two ads today: one person in the totals, not two.
  await recordAdEvents({ userId: fan, now: NOW, events: [{ adId: a._id.toString(), type: 'impression' }] });
  const people = await adTrackingReport({ days: 7, now: NOW });
  assert.equal(people.totals.viewers, 6, '5 viewers of A this week + the fan; the other B view is older');
  assert.equal(people.ads.find((row) => row.title === 'A').viewers, 6);

  const daily = await adDailyReport({ adId: a._id, days: 30, now: NOW });
  assert.deepEqual(daily.map((row) => row.impressions), [1, 5], 'today includes the fan');
});
