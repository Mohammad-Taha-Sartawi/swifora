// The dashboard must not depend on window.confirm / alert / prompt: browsers
// inside apps (WhatsApp, Telegram...) block them, and a blocked confirm()
// returns false, which silently cancelled "delete driver" in production.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const browser = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'public', 'js', 'main.js'),
  'utf8',
);
const css = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'public', 'css', 'style.css'),
  'utf8',
);
// Code only: drop comments before looking for native dialog calls.
const code = browser
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('no native browser dialogs are used by the dashboard', () => {
  assert.doesNotMatch(code, /(^|[^\w.$])(window\.)?confirm\(/m);
  assert.doesNotMatch(code, /(^|[^\w.$])(window\.)?alert\(/m);
  assert.doesNotMatch(code, /(^|[^\w.$])(window\.)?prompt\(/m);
});

test('deleting a driver or a customer waits for the in-page confirmation', () => {
  for (const name of ['deleteDriver', 'deleteUser']) {
    const start = browser.indexOf(`async function ${name}(id)`);
    assert.ok(start >= 0, name);
    const body = browser.slice(start, browser.indexOf('\n}\n', start));
    assert.match(body, /if \(!await adminConfirm\(PERMANENT_DELETE_WARNING\)\) return;/);
    assert.match(body, /method: 'DELETE'/);
  }
});

test('in-page dialogs are accessible and safe by default', () => {
  assert.match(browser, /function adminDialog\(/);
  assert.match(browser, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(browser, /role', kind === 'alert' \? 'alertdialog' : 'dialog'/);
  // Escape cancels; destructive confirmations start focused on "Cancel".
  assert.match(browser, /event\.key === 'Escape'/);
  assert.match(browser, /\(input \|\| \(danger && cancel\) \|\| ok\)\.focus\(\)/);
  // Built with DOM APIs and classes: no inline handlers or styles (CSP).
  const helper = browser.slice(0, browser.indexOf('function adminConfirm('));
  assert.doesNotMatch(helper, /innerHTML|\.style\.|onclick/);
  assert.match(css, /\.admin-dialog-overlay \{/);
  // Password prompts are masked.
  assert.match(browser, /adminPrompt\('أدخل كلمة المرور الجديدة للسائق:', \{ password: true \}\)/);
});
