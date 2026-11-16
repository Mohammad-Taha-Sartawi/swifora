// Privacy policy and terms of use, edited in the dashboard settings: the
// saved text is kept and shown again in the editor; it can be edited or
// cleared and replaced.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('one stored text per document, privacy and terms', () => {
  const LegalDocument = require('../src/models/LegalDocument');
  assert.deepEqual([...LegalDocument.LEGAL_DOCUMENT_KEYS], ['privacy', 'terms']);
  assert.equal(LegalDocument.schema.path('key').options.unique, true);
  assert.equal(LegalDocument.schema.path('content').options.default, '');
  assert.equal(LegalDocument.LEGAL_DOCUMENT_MAX_LENGTH, 50000);
});

test('admin routes read and save the text as written', () => {
  const api = read('src/routes/adminApi.js');
  assert.match(api, /router\.get\('\/legal\/:key'/);
  assert.match(api, /router\.put\('\/legal\/:key'/);
  // Unknown documents are refused; only strings are accepted.
  assert.match(api, /LEGAL_DOCUMENT_KEYS\.includes\(key\)/);
  assert.match(api, /typeof raw !== 'string'/);
  // Kept as written: no trimming, only Windows line breaks unified.
  const put = api.slice(api.indexOf("router.put('/legal/:key'"));
  assert.doesNotMatch(put.slice(0, put.indexOf('\n});')), /\.trim\(\)/);
  assert.match(put, /raw\.replace\(\/\\r\\n\/g, '\\n'\)/);
  // The admin routes sit behind the admin session and CSRF checks.
  assert.match(
    read('src/index.js'),
    /app\.use\('\/admin\/api', requireAdminSession, adminCsrfProtection, adminApiRoutes\)/,
  );
});

test('the settings page has both editors with save and clear', () => {
  const view = read('src/views/admin/index.ejs');
  const settings = view.slice(view.indexOf('id="page-settings"'));
  assert.match(settings, /key: 'privacy'[\s\S]*سياسة الخصوصية/);
  assert.match(settings, /key: 'terms'[\s\S]*شروط الاستخدام/);
  assert.match(settings, /class="legal-form" data-legal-key="<%= doc\.key %>"/);
  assert.match(settings, /data-legal-clear="<%= doc\.key %>"/);
  assert.match(settings, /maxlength="50000"/);

  const main = read('src/public/js/main.js');
  // Opening the settings page loads the saved texts…
  assert.match(main, /if \(page === 'settings'\) \{[\s\S]*?loadLegalDocuments\(\);/);
  // …without replacing edits that were not saved yet.
  assert.match(main, /legalIsDirty\(editor\)\) continue;/);
  // Clearing empties the editor only; the stored text changes on save.
  assert.match(main, /editor\.value = '';/);
});

test('customer rating summaries count positive ratings like drivers', () => {
  const service = read('src/services/customerRatings.js');
  assert.match(service, /positiveCount: \{ \$sum: \{ \$cond: \[\{ \$gte: \['\$rating', 4\] \}, 1, 0\] \} \}/);
  // Customers nobody rated yet still get a summary (count 0).
  assert.match(service, /summaries\.get\(orderCustomerId\(order\)\) \|\| \{ \.\.\.NO_RATINGS \}/);
  // The driver's order details include it too.
  assert.match(read('src/routes/orders.js'), /await attachCustomerRatings\(\[order\]\);/);
});

test('the texts are public and read-only for the apps and the web', () => {
  const index = read('src/index.js');
  assert.match(index, /app\.use\('\/api\/legal', legalRoutes\);/);
  assert.match(index, /app\.get\('\/privacy', legalRoutes\.legalPage\('privacy'\)\);/);
  assert.match(index, /app\.get\('\/terms', legalRoutes\.legalPage\('terms'\)\);/);

  const route = read('src/routes/legal.js');
  // Only reads; nothing can be written through the public routes.
  assert.doesNotMatch(route, /router\.(post|put|patch|delete)\(/);
  assert.match(route, /LEGAL_DOCUMENT_KEYS\.includes\(key\)/);

  // The page shows no scripts, and the text is escaped by EJS (<%= %>).
  const { LEGAL_PAGE_CSP } = require('../src/routes/legal');
  assert.match(LEGAL_PAGE_CSP, /default-src 'none'/);
  assert.doesNotMatch(LEGAL_PAGE_CSP, /script-src/);
  const view = read('src/views/admin/legal.ejs');
  assert.match(view, /<%= line %>/);
  assert.doesNotMatch(view, /<%-/);
  assert.doesNotMatch(view, /<script/);
});

test('the public page renders paragraphs and escapes the text', async () => {
  const ejs = require('ejs');
  const html = await ejs.renderFile(
    path.join(root, 'src', 'views', 'admin', 'legal.ejs'),
    {
      title: 'سياسة الخصوصية',
      paragraphs: [['Line one', '<b>two</b>'], ['Second paragraph']],
      updatedLabel: '16/11/2026',
    },
  );
  assert.match(html, /Line one<br>&lt;b&gt;two&lt;\/b&gt;/);
  assert.match(html, /<p dir="auto">Second paragraph<\/p>/);
  assert.match(html, /آخر تحديث: <span dir="ltr">16\/11\/2026<\/span>/);
});

test('until a text is saved, the shipped text is used everywhere', () => {
  const { DEFAULT_LEGAL_TEXT } = require('../src/services/legalDefaults');
  assert.match(DEFAULT_LEGAL_TEXT.terms, /^الوثيقة الأولى: شروط الخدمة/);
  assert.match(DEFAULT_LEGAL_TEXT.privacy, /^الوثيقة الثانية: سياسة الخصوصية/);

  // Dashboard editor: opens with the shipped text, marked as such.
  const api = read('src/routes/adminApi.js');
  assert.match(api, /if \(!doc\) \{\s*return \{ key, content: DEFAULT_LEGAL_TEXT\[key\], updatedAt: null, isDefault: true \};/);
  // Apps and public pages: same rule; a saved empty text stays empty.
  const route = read('src/routes/legal.js');
  assert.match(route, /content: doc \? doc\.content \|\| '' : DEFAULT_LEGAL_TEXT\[key\]/);
  assert.match(read('src/public/js/main.js'), /هذا هو النص الحالي في التطبيق/);
});
