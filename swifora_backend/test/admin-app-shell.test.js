// Dashboard app shell: installable (manifest + icons), cached and compressed
// static files, grouped navigation with addressable pages, phone bottom bar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { computeAssetVersion, staticCacheHeaders } = require('../src/services/staticAssets');

function headersFor(filePath, query = {}) {
  const headers = {};
  const res = { req: { query }, setHeader: (k, v) => { headers[k] = v; } };
  staticCacheHeaders(res, filePath);
  return headers;
}

test('versioned CSS/JS are cached for a year; unversioned ones are revalidated', () => {
  assert.match(headersFor('/x/css/style.css', { v: 'abc' })['Cache-Control'], /max-age=31536000, immutable/);
  assert.equal(headersFor('/x/js/main.js')['Cache-Control'], 'no-cache');
  assert.match(headersFor('/x/icons/icon-192.png')['Cache-Control'], /max-age=86400/);
  assert.match(headersFor('/x/manifest.webmanifest')['Content-Type'], /application\/manifest\+json/);
});

test('the asset version follows the files\' contents', () => {
  const version = computeAssetVersion(path.join(root, 'src', 'public'));
  assert.match(version, /^[0-9a-f]{12}$/);
  assert.equal(computeAssetVersion(path.join(root, 'src', 'public')), version);

  const index = read('src/views/admin/index.ejs');
  const login = read('src/views/admin/login.ejs');
  for (const view of [index, login]) {
    assert.match(view, /\/css\/style\.css\?v=<%= assetVersion %>/);
    assert.match(view, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(view, /<meta name="theme-color"/);
  }
  assert.match(index, /\/js\/main\.js\?v=<%= assetVersion %>/);

  const server = read('src/index.js');
  assert.match(server, /app\.use\(compression\(\)\)/);
  assert.match(server, /app\.locals\.assetVersion = computeAssetVersion\(publicRoot\)/);
});

test('the dashboard can be installed as an app', () => {
  const manifest = JSON.parse(read('src/public/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/admin');
  assert.equal(manifest.dir, 'rtl');
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, 'src', 'public', icon.src)), icon.src);
  }
  assert.ok(fs.existsSync(path.join(root, 'src', 'public', 'icons', 'apple-touch-icon.png')));
});

test('one app bar, grouped menu, phone bottom bar and addressable pages', () => {
  const index = read('src/views/admin/index.ejs');
  const sidebar = read('src/views/admin/partials/sidebar.ejs');
  const main = read('src/public/js/main.js');

  assert.match(index, /<header class="app-topbar">/);
  assert.match(index, /<h1 id="pageTitle">/);
  assert.match(index, /class="skip-link" href="#mainContent"/);
  assert.equal((index.match(/class="live-clock"/g) || []).length, 1, 'a single clock');
  assert.doesNotMatch(index, /class="back-home"/);

  // Every page is in the menu exactly once, grouped under headings.
  const pages = [...index.matchAll(/id="page-([a-z-]+)" class="page-section/g)].map((m) => m[1]);
  const menu = [...sidebar.matchAll(/data-page="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...menu].sort(), [...pages].sort());
  assert.ok((sidebar.match(/class="nav-group-title"/g) || []).length >= 5);

  // Bottom bar destinations exist as pages.
  const bottom = [...index.matchAll(/data-nav-page="([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(bottom.length >= 4);
  for (const page of bottom) assert.ok(pages.includes(page), page);

  // Pages have addresses (#orders) and the back button works.
  assert.match(main, /history\.pushState\(\{ page \}, '', `#\$\{page\}`\)/);
  assert.match(main, /window\.addEventListener\('popstate'/);
  assert.match(main, /setAttribute\('aria-current', 'page'\)/);
});
