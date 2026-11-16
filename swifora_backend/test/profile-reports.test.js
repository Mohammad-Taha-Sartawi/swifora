// Profile status in the dashboard: the number of reports filed against a
// driver or a customer, and clearing them from the profile (the reports
// stay in the reports pages).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { reportsAgainstFilter } = require('../src/services/profileReports');

test('reports against a driver: linked by id, or by public ID for old ones', () => {
  const id = new mongoose.Types.ObjectId();
  const filter = reportsAgainstFilter({ _id: id, role: 'provider', publicId: 'DRV-7' });
  assert.deepEqual(filter, {
    $or: [
      { reportedUserId: id },
      { reportedUserId: { $in: [null] }, reportType: 'driver', reportedPublicId: 'DRV-7' },
    ],
  });
});

test('reports against a customer use the customer report type', () => {
  const id = new mongoose.Types.ObjectId();
  const filter = reportsAgainstFilter({ _id: id, role: 'customer', publicId: 'CUS-1' });
  assert.equal(filter.$or[1].reportType, 'user');
  // Without a public ID only directly linked reports count.
  assert.equal(reportsAgainstFilter({ _id: id, role: 'customer' }).$or.length, 1);
});

test('clearing marks reports instead of deleting them', () => {
  const service = read('src/services/profileReports.js');
  assert.match(service, /Report\.updateMany\(/);
  assert.doesNotMatch(service, /deleteMany|deleteOne|findOneAndDelete/);
  assert.match(service, /\$set: \{ clearedFromProfileAt: new Date\(\), clearedBy: adminId \|\| null \}/);

  const Report = require('../src/models/Report');
  assert.equal(Report.schema.path('clearedFromProfileAt').instance, 'Date');
  assert.equal(Report.schema.path('clearedFromProfileAt').defaultValue, null);
});

test('driver and customer details carry the profile status, with a clear action', () => {
  for (const [file, role] of [
    ['src/routes/adminDrivers.js', 'provider'],
    ['src/routes/adminUsers.js', 'customer'],
  ]) {
    const source = read(file);
    assert.match(source, /profileStatus: await profileReportStatus\(/, file);
    assert.match(source, /router\.post\('\/:id\/profile-reports\/clear'/, file);
    // Only the right kind of account can be cleared through each route.
    assert.match(source, new RegExp(`role: '${role}',\\s*deleted: \\{ \\$ne: true \\},\\s*\\}\\)\\.select\\('_id role publicId'\\)`), file);
  }
  // The admin routers sit behind the admin session and CSRF checks.
  const index = read('src/index.js');
  assert.match(index, /app\.use\('\/admin\/drivers', requireAdminSession, adminCsrfProtection/);
  assert.match(index, /app\.use\('\/admin\/users', requireAdminSession, adminCsrfProtection/);
});

test('the dashboard shows the status and asks before clearing', () => {
  const main = read('src/public/js/main.js');
  assert.match(main, /<h5>حالة الملف الشخصي<\/h5>/);
  assert.match(main, /عدد البلاغات ضده/);
  assert.match(main, /\$\{profileStatusSection\(driver\.profileStatus, 'driver', driver\._id\)\}/);
  assert.match(main, /\$\{profileStatusSection\(user\.profileStatus, 'user', user\._id\)\}/);
  assert.match(main, /data-admin-action="clearProfileReports"/);
  assert.match(main, /const adminActionHandlers = Object\.freeze\(\{[\s\S]*?clearProfileReports,/);
  // Confirmation first; destructive, so it starts on "Cancel".
  assert.match(main, /async function clearProfileReports\(role, id\) \{[\s\S]*?await adminConfirm\(/);
  assert.match(main, /const danger = \/[^/]*مسح[^/]*\//);
});
