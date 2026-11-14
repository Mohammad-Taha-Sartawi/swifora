// Ad views and taps reported by the mobile apps, kept as daily totals.
const mongoose = require('mongoose');
const Ad = require('../models/Ad');
const AdStat = require('../models/AdStat');
const AdEventUser = require('../models/AdEventUser');
const { reportTimeZone } = require('./commissionReport');

const AD_EVENT_TYPES = Object.freeze(['impression', 'tap']);
const MAX_EVENTS_PER_REQUEST = 20;
const UNIQUE_ROW_TTL_MS = 120 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day ("YYYY-MM-DD") of [date] in the report time zone. */
function adDayKey(date = new Date(), timeZone = reportTimeZone()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** First day key of a range of [days] days ending today (1 = today). */
function firstDayOfRange(days, now = new Date()) {
  const span = Math.max(1, Math.min(366, Math.floor(Number(days) || 1)));
  return adDayKey(new Date(now.getTime() - (span - 1) * DAY_MS));
}

class AdEventError extends Error {}

/**
 * Validates a batch from the app: [{ adId, type: 'impression' | 'tap' }].
 * Unknown types or malformed ids reject the whole batch.
 */
function normalizeAdEvents(rawEvents) {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    throw new AdEventError('events must be a non-empty list');
  }
  if (rawEvents.length > MAX_EVENTS_PER_REQUEST) {
    throw new AdEventError(
      `at most ${MAX_EVENTS_PER_REQUEST} events per request`,
    );
  }
  return rawEvents.map((event) => {
    const adId = typeof event?.adId === 'string' ? event.adId : '';
    const type = typeof event?.type === 'string' ? event.type : '';
    if (!mongoose.isValidObjectId(adId) || !AD_EVENT_TYPES.includes(type)) {
      throw new AdEventError('invalid event');
    }
    return { adId, type };
  });
}

/**
 * Records views/taps by [userId]. Events for ads that no longer exist are
 * ignored. Returns the number of events counted.
 */
async function recordAdEvents({ userId, events, now = new Date() }) {
  const normalized = normalizeAdEvents(events);
  const ids = [...new Set(normalized.map((event) => event.adId))];
  const existing = new Set(
    (await Ad.find({ _id: { $in: ids } }).select('_id').lean())
      .map((ad) => ad._id.toString()),
  );

  const day = adDayKey(now);
  const counts = new Map();
  for (const event of normalized) {
    if (!existing.has(event.adId)) continue;
    const key = `${event.adId}|${event.type}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let counted = 0;
  for (const [key, count] of counts) {
    const [adId, type] = key.split('|');
    let firstToday = false;
    try {
      await AdEventUser.create({
        adId,
        day,
        userId,
        type,
        expireAt: new Date(now.getTime() + UNIQUE_ROW_TTL_MS),
      });
      firstToday = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }

    const inc = type === 'tap'
      ? { taps: count, ...(firstToday ? { tappers: 1 } : {}) }
      : { impressions: count, ...(firstToday ? { viewers: 1 } : {}) };
    await AdStat.updateOne({ adId, day }, { $inc: inc }, { upsert: true });
    counted += count;
  }
  return counted;
}

/**
 * Tap rate in percent (one decimal): of the people who saw the ad, how many
 * tapped it. Based on people, not on raw views/taps, so repeated taps by one
 * person can never push it over 100%.
 */
function tapRate(tappers, viewers) {
  if (!(viewers > 0)) return 0;
  return Math.min(100, Math.round((tappers / viewers) * 1000) / 10);
}

/**
 * Dashboard figures for the last [days] days (1 = today): totals, one row
 * per ad (ads without events yet included) and one row per day.
 */
async function adTrackingReport({ days = 7, now = new Date() } = {}) {
  const fromDay = firstDayOfRange(days, now);
  const toDay = adDayKey(now);
  const [stats, ads] = await Promise.all([
    AdStat.find({ day: { $gte: fromDay, $lte: toDay } }).lean(),
    Ad.find({})
      .select('title body images isActive startsAt endsAt audience')
      .lean(),
  ]);

  const perAd = new Map(ads.map((ad) => [ad._id.toString(), {
    _id: ad._id.toString(),
    title: ad.title || '',
    body: ad.body || '',
    image: Array.isArray(ad.images) && ad.images.length > 0 ? ad.images[0] : '',
    isActive: ad.isActive === true,
    startsAt: ad.startsAt || null,
    endsAt: ad.endsAt || null,
    audience: ad.audience || 'all',
    impressions: 0,
    viewers: 0,
    taps: 0,
    tappers: 0,
  }]));
  const perDay = new Map();
  const totals = { impressions: 0, viewers: 0, taps: 0, tappers: 0 };
  const known = new Set(perAd.keys());

  for (const stat of stats) {
    const row = perAd.get(stat.adId.toString());
    if (!row) continue; // the ad was deleted
    for (const field of ['impressions', 'taps']) {
      row[field] += stat[field] || 0;
      totals[field] += stat[field] || 0;
    }
    const dayRow = perDay.get(stat.day)
      || { day: stat.day, impressions: 0, viewers: 0, taps: 0, tappers: 0 };
    dayRow.impressions += stat.impressions || 0;
    dayRow.taps += stat.taps || 0;
    perDay.set(stat.day, dayRow);
  }

  // People are counted once per row, however many ads or days they saw:
  // one customer who saw three ads on two days is one viewer in the totals.
  const range = { day: { $gte: fromDay, $lte: toDay } };
  const liveAds = [...known].map((id) => new mongoose.Types.ObjectId(id));
  const distinctUsers = (groupId) => AdEventUser.aggregate([
    { $match: { ...range, adId: { $in: liveAds } } },
    { $group: { _id: groupId, users: { $addToSet: '$userId' } } },
    { $project: { count: { $size: '$users' } } },
  ]);
  const [byAd, byDay, overall] = await Promise.all([
    distinctUsers({ adId: '$adId', type: '$type' }),
    distinctUsers({ day: '$day', type: '$type' }),
    distinctUsers({ type: '$type' }),
  ]);
  const peopleField = (type) => (type === 'tap' ? 'tappers' : 'viewers');
  for (const { _id: key, count } of byAd) {
    const row = perAd.get(key.adId.toString());
    if (row) row[peopleField(key.type)] = count;
  }
  for (const { _id: key, count } of byDay) {
    const dayRow = perDay.get(key.day);
    if (dayRow) dayRow[peopleField(key.type)] = count;
  }
  for (const { _id: key, count } of overall) {
    totals[peopleField(key.type)] = count;
  }

  const adRows = [...perAd.values()]
    .map((row) => ({ ...row, ctr: tapRate(row.tappers, row.viewers) }))
    .sort((a, b) => b.impressions - a.impressions
      || a.title.localeCompare(b.title));

  return {
    fromDay,
    toDay,
    timeZone: reportTimeZone(),
    totals: { ...totals, ctr: tapRate(totals.tappers, totals.viewers) },
    ads: adRows,
    days: [...perDay.values()]
      .map((row) => ({ ...row, ctr: tapRate(row.tappers, row.viewers) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

/** Day-by-day figures of one ad for the last [days] days. */
async function adDailyReport({ adId, days = 30, now = new Date() }) {
  const rows = await AdStat.find({
    adId,
    day: { $gte: firstDayOfRange(days, now), $lte: adDayKey(now) },
  }).sort({ day: 1 }).lean();
  return rows.map((row) => ({
    day: row.day,
    impressions: row.impressions || 0,
    viewers: row.viewers || 0,
    taps: row.taps || 0,
    tappers: row.tappers || 0,
    ctr: tapRate(row.tappers || 0, row.viewers || 0),
  }));
}

module.exports = {
  AD_EVENT_TYPES,
  MAX_EVENTS_PER_REQUEST,
  AdEventError,
  adDayKey,
  adDailyReport,
  adTrackingReport,
  normalizeAdEvents,
  recordAdEvents,
  tapRate,
};
