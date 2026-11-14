const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeAdPayload,
  publicAd,
} = require('../src/services/adPayload');
const Ad = require('../src/models/Ad');

const backendRoot = path.resolve(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(
    path.join(backendRoot, relativePath),
    'utf8',
  );
}

test('ad payload allows optional title and requires some content', () => {
  const valid = normalizeAdPayload({
    title: 'عرض خاص',
    body: 'خصم على التوصيل',
    audience: 'customers',
    isActive: true,
    startsAt: '2026-11-10T10:00:00.000Z',
    endsAt: '2026-11-20T10:00:00.000Z',
    sortOrder: 2,
  }, { imageCount: 1 });

  assert.equal(valid.ok, true);
  assert.equal(valid.value.title, 'عرض خاص');
  assert.equal(valid.value.audience, 'customers');
  assert.equal(valid.value.sortOrder, 2);

  const imageOnly = normalizeAdPayload({
    title: '',
    body: '',
    audience: 'all',
    endsAt: '2026-11-20T10:00:00.000Z',
  }, { imageCount: 1 });

  assert.equal(imageOnly.ok, true);
  assert.equal(imageOnly.value.title, '');
  assert.equal(imageOnly.value.body, '');

  assert.equal(
    normalizeAdPayload({ title: '', body: '' }, { imageCount: 0 }).ok,
    false,
  );
  assert.equal(
    normalizeAdPayload({
      title: 'Ad',
      audience: 'unknown',
    }, { imageCount: 1 }).ok,
    false,
  );
  assert.equal(
    normalizeAdPayload({
      title: 'Ad',
      startsAt: 'not-a-date',
    }, { imageCount: 1 }).ok,
    false,
  );
  assert.equal(
    normalizeAdPayload({
      title: 'Ad',
      startsAt: '2026-11-20T10:00:00.000Z',
      endsAt: '2026-11-10T10:00:00.000Z',
    }, { imageCount: 1 }).ok,
    false,
  );
  assert.equal(
    normalizeAdPayload({
      title: 'Ad',
      sortOrder: -1,
    }, { imageCount: 1 }).ok,
    false,
  );
});

test('the countdown is hidden unless chosen', () => {
  const ends = '2026-11-20T10:00:00.000Z';
  const of = (showCountdown) => normalizeAdPayload(
    { title: 'Ad', endsAt: ends, showCountdown },
    { imageCount: 1 },
  ).value.showCountdown;
  assert.equal(of(undefined), false);
  assert.equal(of('false'), false);
  assert.equal(of('true'), true);
  assert.equal(of(true), true);
  assert.equal(publicAd({ _id: 'x', images: [], showCountdown: true }).showCountdown, true);
  assert.equal(publicAd({ _id: 'x', images: [] }).showCountdown, false);
});

test('every ad needs an expiry date', () => {
  const withoutEnd = normalizeAdPayload({ title: 'Ad' }, { imageCount: 1 });
  assert.equal(withoutEnd.ok, false);
  assert.match(withoutEnd.message, /تاريخ نهاية الإعلان مطلوب/);
});

test('a tap opens nothing, an app screen or an https page', () => {
  const ends = '2026-11-20T10:00:00.000Z';
  const linkOf = (link) => normalizeAdPayload(
    { title: 'Ad', endsAt: ends, link },
    { imageCount: 1 },
  );

  assert.equal(linkOf('').value.link, '');
  assert.equal(linkOf(undefined).value.link, '');
  assert.equal(linkOf('app:create_order').value.link, 'app:create_order');
  assert.equal(linkOf('app:support').value.link, 'app:support');
  assert.equal(
    linkOf('https://swifora.com/offer').value.link,
    'https://swifora.com/offer',
  );

  for (const bad of [
    'app:admin',
    'http://swifora.com',
    'javascript:alert(1)',
    'https://user:pass@swifora.com',
    `https://swifora.com/${'a'.repeat(600)}`,
  ]) {
    assert.equal(linkOf(bad).ok, false, bad);
  }

  assert.equal(
    publicAd({ _id: 'x', link: 'app:my_orders', images: [] }).link,
    'app:my_orders',
  );
});

test('public ad payload exposes images and optional countdown dates', () => {
  const payload = publicAd({
    _id: { toString: () => 'ad-1' },
    title: '',
    body: 'نص',
    images: ['/uploads/ads/a.png', '/uploads/ads/b.png'],
    startsAt: new Date('2026-11-10T10:00:00.000Z'),
    endsAt: new Date('2026-11-20T10:00:00.000Z'),
  });

  assert.equal(payload._id, 'ad-1');
  assert.deepEqual(payload.images, [
    '/uploads/ads/a.png',
    '/uploads/ads/b.png',
  ]);
  assert.ok(payload.startsAt);
  assert.ok(payload.endsAt);
});

test('ad model and routes keep public previews limited to active ads', () => {
  assert.equal(
    Ad.schema.path('title').options.maxlength,
    120,
  );
  assert.equal(
    Ad.schema.path('body').options.maxlength,
    300,
  );
  assert.equal(
    Ad.schema.path('audience').options.enum.includes('providers'),
    true,
  );
  assert.ok(Ad.schema.path('images'));

  const publicRoute = source('src/routes/ads.js');
  const adminRoute = source('src/routes/adminAds.js');
  const index = source('src/index.js');

  assert.match(publicRoute, /isActive: true/);
  assert.match(publicRoute, /audience: \{ \$in: \['all', audience\] \}/);
  assert.match(publicRoute, /startsAt: \{ \$lte: now \}/);
  assert.match(publicRoute, /endsAt: \{ \$gte: now \}/);
  assert.match(publicRoute, /limit\(5\)/);

  assert.match(adminRoute, /normalizeAdPayload/);
  assert.match(adminRoute, /adImageUpload/);
  assert.match(adminRoute, /finalizeAdImageFiles/);
  assert.match(adminRoute, /images/);
  assert.match(adminRoute, /router\.post\('\/'/);
  assert.match(adminRoute, /router\.put\('\/:id'/);
  assert.match(adminRoute, /router\.put\('\/:id\/status'/);
  assert.match(adminRoute, /router\.delete\('\/:id'/);

  assert.match(index, /app\.use\('\/api\/ads', adRoutes\)/);
  assert.match(
    index,
    /app\.use\('\/admin\/ads', requireAdminSession, adminCsrfProtection, adminAdRoutes\)/,
  );
  assert.match(index, /Ad\.createIndexes\(\)/);
});

test('admin dashboard uploads ad images and no longer accepts image URLs', () => {
  const sidebar = source('src/views/admin/partials/sidebar.ejs');
  const page = source('src/views/admin/index.ejs');
  const browser = source('src/public/js/main.js');

  assert.match(sidebar, /data-page="ads"/);
  assert.match(page, /id="page-ads"/);
  assert.match(page, /id="adForm"/);
  assert.match(page, /id="adsList"/);
  assert.match(page, /id="adImages"/);
  assert.match(page, /multiple/);
  assert.doesNotMatch(page, /adImageUrl/);
  assert.match(browser, /loadAds/);
  assert.match(browser, /saveAd/);
  assert.match(browser, /FormData/);
});
