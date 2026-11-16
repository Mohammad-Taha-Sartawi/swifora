// Phone and email rules for new accounts (see services/phoneNumbers.js and
// services/emailCheck.js); the app's lib/services/validators.dart mirrors
// them.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePhoneNumber,
  isValidPhoneNumber,
  primaryPhoneOf,
} = require('../src/services/phoneNumbers');
const {
  isCompleteEmail,
  suggestedEmailDomain,
  emailDomainStatus,
  newAccountEmailProblem,
  setEmailDomainLookupForTests,
} = require('../src/services/emailCheck');

const valid = (typed) => isValidPhoneNumber(normalizePhoneNumber(typed));

test('mobile numbers used in Palestine are accepted, in any common writing', () => {
  for (const typed of [
    '0599123456', '0568123456', '0527123456', '059 912 3456', '059-912-3456',
    '(059) 912.3456', '+970599123456', '+972 52 712 3456', '00970599123456',
    '٠٥٩٩١٢٣٤٥٦', '۰۵۶۸۱۲۳۴۵۶', '‎0599123456‏',
  ]) {
    assert.equal(valid(typed), true, typed);
  }
  assert.equal(normalizePhoneNumber('٠٥٩٩ ١٢٣ ٤٥٦'), '0599123456');
  assert.equal(normalizePhoneNumber('00970 59 912 3456'), '+970599123456');
});

test('other numbers are refused', () => {
  for (const typed of [
    '', '0599', '059912345', '05991234567', '599123456', '0499123456',
    '0222981234', '+12025550143', '+970 0599123456', '+971599123456',
    '0590000000', '0599999999', '+970590000000', '05991234ab', null, undefined, 599123456,
  ]) {
    assert.equal(valid(typed), false, String(typed));
  }
});

test('the current number of an account is found for older accounts too', () => {
  assert.equal(primaryPhoneOf({ phoneNumbers: [{ number: 'b' }, { number: 'a', primary: true }] }), 'a');
  assert.equal(primaryPhoneOf({ phoneNumbers: [{ number: 'b' }] }), 'b');
  assert.equal(primaryPhoneOf({ phone: '123' }), '123');
  assert.equal(primaryPhoneOf(null), '');
});

test('complete emails only', () => {
  for (const email of ['name@gmail.com', 'first.last+tag@mail.co.uk', 'a_b-c@sub.domain.ps', ' Name@Gmail.COM ']) {
    assert.equal(isCompleteEmail(email), true, email);
  }
  for (const email of [
    '', 'name', 'name@', '@gmail.com', 'name@gmail', 'name@.com', '.name@gmail.com',
    'name.@gmail.com', 'na..me@gmail.com', 'name@gmail..com', 'name@-gmail.com',
    'name@gmail-.com', 'name@gmail.c', 'name@gmail.123', 'name gmail.com',
    `${'a'.repeat(65)}@gmail.com`, null,
  ]) {
    assert.equal(isCompleteEmail(email), false, String(email));
  }
});

test('misspelled providers are recognised', () => {
  assert.equal(suggestedEmailDomain('a@gmail.con'), 'gmail.com');
  assert.equal(suggestedEmailDomain('a@GMIAL.com'), 'gmail.com');
  assert.equal(suggestedEmailDomain('a@hotmial.com'), 'hotmail.com');
  assert.equal(suggestedEmailDomain('a@gmail.com'), null);
});

test('domain check: missing refuses, unknown or slow accepts, results are cached', async (t) => {
  t.after(() => setEmailDomainLookupForTests(null));
  const asked = [];
  setEmailDomainLookupForTests(async (domain) => {
    asked.push(domain);
    if (domain === 'hangs.ps') return new Promise(() => {});
    if (domain === 'throws.ps') throw new Error('resolver down');
    return { 'real.ps': 'ok', 'gone.ps': 'missing' }[domain] || 'unknown';
  });
  assert.equal(await emailDomainStatus('real.ps'), 'ok');
  assert.equal(await emailDomainStatus('real.ps'), 'ok');
  assert.equal(await emailDomainStatus('gone.ps'), 'missing');
  assert.equal(await emailDomainStatus('throws.ps'), 'unknown');
  assert.deepEqual(asked, ['real.ps', 'gone.ps', 'throws.ps']);

  assert.equal(await newAccountEmailProblem('a@real.ps'), null);
  assert.equal((await newAccountEmailProblem('a@gone.ps')).code, 'EMAIL_DOMAIN_NOT_FOUND');
  assert.equal((await newAccountEmailProblem('a@gmail.con')).code, 'EMAIL_DOMAIN_TYPO');
  assert.equal((await newAccountEmailProblem('a@real')).code, 'EMAIL_INVALID');

  const started = Date.now();
  assert.equal(await newAccountEmailProblem('a@hangs.ps'), null);
  assert.ok(Date.now() - started < 6000);
});

test('domain check can be turned off (tests with example addresses)', async (t) => {
  const saved = process.env.EMAIL_DOMAIN_CHECK;
  t.after(() => {
    if (saved === undefined) delete process.env.EMAIL_DOMAIN_CHECK;
    else process.env.EMAIL_DOMAIN_CHECK = saved;
  });
  process.env.EMAIL_DOMAIN_CHECK = 'off';
  assert.equal(await emailDomainStatus('anything.invalid'), 'ok');
});
