// The dashboard shows dates as numbers: DD/MM/YYYY (+ HH:mm where the time
// matters), never month names or locale-dependent digits.
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
const { formatDisplayDate, formatDisplayDateTime } = new Function(
  [
    extract('toDisplayDateValue'),
    extract('formatDisplayDate'),
    extract('formatDisplayDateTime'),
    'return { formatDisplayDate, formatDisplayDateTime };',
  ].join('\n'),
)();

test('dates are DD/MM/YYYY', () => {
  assert.equal(formatDisplayDate('2026-11-05'), '05/11/2026');
  assert.equal(formatDisplayDate(new Date(2026, 0, 9, 23, 59)), '09/01/2026');
  const iso = new Date(2026, 10, 16, 8, 4).toISOString();
  assert.equal(formatDisplayDate(iso), '16/11/2026');
});

test('date and time are DD/MM/YYYY HH:mm', () => {
  assert.equal(
    formatDisplayDateTime(new Date(2026, 10, 16, 8, 4)),
    '16/11/2026 08:04',
  );
});

test('empty and non-date values are left alone', () => {
  assert.equal(formatDisplayDate(''), '');
  assert.equal(formatDisplayDate(null), '');
  assert.equal(formatDisplayDate('غير محدد'), 'غير محدد');
  assert.equal(formatDisplayDateTime(undefined), '');
});

test('no locale date formatting is left in the dashboard script', () => {
  assert.doesNotMatch(source, /toLocaleDateString\(/);
  assert.doesNotMatch(source, /new Date\([^)]*\)\.toLocaleString\(/);
  assert.doesNotMatch(source, /dateStyle:/);
});
