// Dashboard search: the server's matcher (services/accountSearch.js) and the
// browser's (main.js accountMatches, used on the commissions, support and
// areas pages) follow the same rules: ID, email, any phone number written
// any way, or part of the name.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { phoneCore, accountSearchConditions } = require('../src/services/accountSearch');

const main = fs.readFileSync(path.join(__dirname, '..', 'src/public/js/main.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src/public/css/style.css'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'src/views/admin/index.ejs'), 'utf8');

function browserMatcher() {
  const pick = (name) => {
    const match = main.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(match, `${name} must exist`);
    return match[0];
  };
  const context = {};
  vm.runInNewContext(
    ['toLatinDigits', 'searchPhoneCore', 'cleanAccountQuery', 'accountMatches']
      .map(pick).join('\n') + '\nthis.accountMatches = accountMatches; this.searchPhoneCore = searchPhoneCore;',
    context,
  );
  return context;
}

test('a number gives the same core however it is written', () => {
  const { searchPhoneCore } = browserMatcher();
  for (const written of ['0599123456', '059 912-3456', '+970599123456', '+972 59 912 3456', '00970599123456', '٠٥٩٩١٢٣٤٥٦']) {
    assert.equal(phoneCore(written), '599123456', written);
    assert.equal(searchPhoneCore(written), '599123456', written);
  }
});

test('the browser matcher finds accounts by ID, email, any number or name', () => {
  const { accountMatches } = browserMatcher();
  const driver = {
    name: 'أحمد سالم',
    publicId: '48213',
    email: 'ahmad.salem@gmail.com',
    phones: ['0599123456', '+970568765432'],
  };
  for (const query of [
    '', '48213', 'ID 48213', '#48213', 'ahmad.salem@gmail.com', 'AHMAD.SALEM', 'gmail',
    '0599123456', '+970599123456', '059 912 3456', '٠٥٩٩١٢٣٤٥٦', '3456', '0568765432',
    '+972568765432', 'أحمد', 'سالم',
  ]) {
    assert.equal(accountMatches(driver, query), true, `should match "${query}"`);
  }
  for (const query of ['48214', 'someone@gmail.com', '0599123457', '9999', 'محمد', 'zz']) {
    assert.equal(accountMatches(driver, query), false, `should not match "${query}"`);
  }
  // Missing fields never throw.
  assert.equal(accountMatches({}, '0599'), false);
  assert.equal(accountMatches({ phones: null }, 'x'), false);
});

test('server conditions: exact for whole ID/email/number, partial otherwise', () => {
  assert.equal(accountSearchConditions('   '), null);

  const byId = accountSearchConditions('ID 48213');
  assert.deepEqual(byId.exact.$or[0], { publicId: '48213' });

  const byEmail = accountSearchConditions('Ahmad@Gmail.com');
  assert.ok(byEmail.exact.$or.some((c) => c.email === 'ahmad@gmail.com'));

  const byNumber = accountSearchConditions('+970 599 123 456');
  const whole = byNumber.exact.$or.find((c) => c['phoneNumbers.number']);
  assert.ok(whole, 'a whole number is an exact search');
  const pattern = new RegExp(whole['phoneNumbers.number'].$regex);
  for (const stored of ['0599123456', '+970599123456', '+972599123456', '059 912 3456', '599123456']) {
    assert.match(stored, pattern, stored);
  }
  assert.doesNotMatch('0599123457', pattern);
  assert.doesNotMatch('10599123456', pattern);

  // Part of a number is only a partial search.
  const part = accountSearchConditions('3456');
  assert.ok(!part.exact.$or.some((c) => c['phoneNumbers.number']));
  assert.ok(part.any.$or.some((c) => c['phoneNumbers.number']));

  // Text is matched literally (no regular-expression injection).
  const tricky = accountSearchConditions('a.*(b');
  const name = tricky.any.$or.find((c) => c.fullName);
  assert.equal(name.fullName.$regex, 'a\\.\\*\\(b');
});

test('the dashboard pages have the search boxes and wire them', () => {
  for (const id of ['commissionSearchInput', 'conversationSearchInput', 'areaSearchInput']) {
    assert.match(page, new RegExp(`id="${id}"`));
    assert.match(main, new RegExp(`getElementById\\('${id}'\\)\\?\\.addEventListener\\('input'`));
  }
  assert.match(page, /id="driverSearchInput" placeholder="[^"]*رقم الهاتف[^"]*البريد/);
  assert.match(page, /id="userSearchInput" placeholder="[^"]*رقم الهاتف[^"]*البريد/);
  assert.match(main, /applyCommissionSearch\(\);\r?\n {2}\} catch/);
  assert.match(main, /Array\.isArray\(data\.matches\)/);
  assert.match(css, /\.area-search-hit/);
});
