// Dashboard wiring for undoing commission "paid", "reset" and "reset all"
// (the behaviour itself is covered by integration/commission-undo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('undo routes sit behind the admin session and CSRF checks', () => {
  const routes = read('src/routes/adminCommissions.js');
  assert.match(routes, /router\.post\('\/undo\/:actionId'/);
  assert.match(routes, /router\.post\('\/undo-batch\/:batchId'/);
  assert.match(
    read('src/index.js'),
    /app\.use\('\/admin\/commissions', requireAdminSession, adminCsrfProtection, adminCommissionRoutes\)/,
  );
  // Paid and reset both record what they changed.
  assert.match(routes, /type: 'payment',[\s\S]*?paymentId: payment\._id/);
  assert.match(routes, /type: 'reset',[\s\S]*?orders: dueOrders\.map/);
});

test('the dashboard offers undo where the operations happen, after asking', () => {
  const main = read('src/public/js/main.js');
  assert.match(main, /const adminActionHandlers = Object\.freeze\(\{[\s\S]*?undoCommissionAction,\s*undoResetAll,/);
  // Driver card, commissions table and the "reset all" bar.
  assert.match(main, /آخر عملية على العمولة[\s\S]*?commissionUndoButton\(driver\.lastCommissionAction, driver\._id\)/);
  assert.match(main, /const undoAction = commissionUndoButton\(driver\.lastAction, driver\._id\);/);
  assert.match(main, /data-admin-action="undoResetAll"/);
  // Always confirmed first.
  assert.match(main, /async function undoCommissionAction\([^)]*\) \{[\s\S]*?if \(!await adminConfirm\(message\)\) return;/);
  assert.match(main, /async function undoResetAll\([^)]*\) \{\s*if \(!await adminConfirm\(/);
});
