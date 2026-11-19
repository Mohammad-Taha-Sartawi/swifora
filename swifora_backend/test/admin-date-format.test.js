// The dashboard shows dates as numbers: DD/MM/YYYY, and times in Palestine
// time, whatever the clock of the computer showing them. Each admin picks
// 12-hour times with AM/PM (the default) or 24-hour times. Never month
// names or locale-dependent digits.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'public', 'js', 'main.js'),
  'utf8',
);

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`could not read ${name}`);
}

// eslint-disable-next-line no-new-func
const dates = new Function(
  [
    "const PALESTINE_TIME_ZONE = 'Asia/Hebron';",
    "let adminTimeFormat = '12h';",
    'let palestineFormatter = null;',
    extract('toDisplayDateValue'),
    extract('palestineParts'),
    extract('isCalendarDate'),
    extract('formatDisplayDate'),
    extract('formatDisplayTime'),
    extract('formatDisplayDateTime'),
    'return { formatDisplayDate, formatDisplayTime, formatDisplayDateTime, use: (f) => { adminTimeFormat = f; } };',
  ].join('\n'),
)();

test.afterEach(() => dates.use('12h'));

test('the dashboard uses Palestine time and the admin\'s own choice', () => {
  assert.match(source, /const PALESTINE_TIME_ZONE = 'Asia\/Hebron';/);
  assert.match(source, /<meta name="admin-time-format"|meta\[name="admin-time-format"\]/);
});

test('dates are DD/MM/YYYY, in Palestine', () => {
  assert.equal(dates.formatDisplayDate('2026-11-05'), '05/11/2026');
  assert.equal(dates.formatDisplayDate('2026-11-19T20:30:00Z'), '19/11/2026');
  // 22:30 UTC is already the next day in Palestine (UTC+2 in winter).
  assert.equal(dates.formatDisplayDate('2026-11-19T22:30:00Z'), '20/11/2026');
  // Summer time: UTC+3.
  assert.equal(dates.formatDisplayDate('2026-07-01T21:15:00Z'), '02/07/2026');
});

// 12-hour times start with a left-to-right mark (U+200E) so they read
// "10:30 PM", not "PM 10:30", inside Arabic text.
test('12-hour times carry AM or PM', () => {
  assert.equal(dates.formatDisplayTime('2026-11-19T20:30:00Z'), '\u200E10:30 PM');
  assert.equal(dates.formatDisplayTime('2026-11-19T10:05:00Z'), '\u200E12:05 PM');
  assert.equal(dates.formatDisplayTime('2026-11-19T07:09:00Z'), '\u200E9:09 AM');
  assert.equal(dates.formatDisplayTime('2026-07-01T21:15:00Z'), '\u200E12:15 AM');
  assert.equal(
    dates.formatDisplayDateTime('2026-11-19T20:30:00Z'),
    '19/11/2026 \u200E10:30 PM',
  );
});

test('24-hour times when the admin chose them', () => {
  dates.use('24h');
  assert.equal(dates.formatDisplayTime('2026-11-19T20:30:00Z'), '22:30');
  assert.equal(dates.formatDisplayTime('2026-11-19T07:09:00Z'), '09:09');
  assert.equal(dates.formatDisplayTime('2026-07-01T21:15:00Z'), '00:15');
  assert.equal(
    dates.formatDisplayDateTime('2026-11-19T20:30:00Z'),
    '19/11/2026 22:30',
  );
});

test('empty, date-only and non-date values are left alone', () => {
  assert.equal(dates.formatDisplayDate(''), '');
  assert.equal(dates.formatDisplayDate(null), '');
  assert.equal(dates.formatDisplayDate('غير محدد'), 'غير محدد');
  assert.equal(dates.formatDisplayDateTime(undefined), '');
  // A calendar day has no time of day.
  assert.equal(dates.formatDisplayTime('2026-11-19'), '');
  assert.equal(dates.formatDisplayDateTime('2026-11-19'), '19/11/2026');
});

test('no locale date or time formatting is left in the dashboard script', () => {
  assert.doesNotMatch(source, /toLocaleDateString\(/);
  assert.doesNotMatch(source, /toLocaleTimeString\(/);
  assert.doesNotMatch(source, /new Date\([^)]*\)\.toLocaleString\(/);
  assert.doesNotMatch(source, /dateStyle:/);
});
