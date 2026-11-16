// Emails for new accounts (sign-up, email change, accounts made in the
// dashboard) must be complete and real:
//   1. a complete address: name@domain.tld, no leading/trailing or double
//      dots, domain labels of letters/digits/hyphens, a letter TLD;
//   2. not a common misspelling of a mail provider (gmail.con, gmial.com…);
//   3. a domain that receives mail (DNS MX record, or an address record).
// Sign-in and password recovery keep the looser check, so existing accounts
// are never locked out.
const dns = require('dns').promises;
const { normalizeMobileEmail, isValidMobileEmail } = require('../security/mobileEmail');

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isCompleteEmail(value) {
  const email = normalizeMobileEmail(value);
  if (!isValidMobileEmail(email)) return false;
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length === 0 || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) return false;
  return /^[a-z]{2,24}$/.test(labels[labels.length - 1]);
}

const DOMAIN_TYPOS = {
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.cpm': 'gmail.com',
  'gmail.vom': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'homail.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlook.con': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'icloud.con': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
};

/** The intended domain when [email] uses a known misspelling, else null. */
function suggestedEmailDomain(email) {
  const domain = normalizeMobileEmail(email).split('@')[1] || '';
  return DOMAIN_TYPOS[domain] || null;
}

const LOOKUP_TIMEOUT_MS = 4000;
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map();

const MISSING_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

async function lookupDomain(domain) {
  try {
    const records = await dns.resolveMx(domain);
    // "Null MX" (one record, empty exchange) means: this domain takes no mail.
    if (records.length === 0) return 'missing';
    if (records.every((r) => !r.exchange || r.exchange === '.')) return 'missing';
    return 'ok';
  } catch (err) {
    if (err && err.code === 'ENOTFOUND') return 'missing';
    if (!err || !MISSING_CODES.has(err.code)) return 'unknown';
  }
  // No MX record: mail goes to the domain's own address, if it has one.
  try {
    const addresses = await dns.resolve4(domain);
    return addresses.length > 0 ? 'ok' : 'missing';
  } catch (err) {
    return err && MISSING_CODES.has(err.code) ? 'missing' : 'unknown';
  }
}

let lookupOverride = null;

/** Tests: replace the DNS lookup ((domain) => 'ok'|'missing'|'unknown'). */
function setEmailDomainLookupForTests(fn) {
  lookupOverride = fn;
  cache.clear();
}

function domainCheckEnabled() {
  if (lookupOverride) return true;
  return process.env.EMAIL_DOMAIN_CHECK !== 'off';
}

/**
 * 'ok' when the domain receives mail, 'missing' when DNS says it does not
 * exist or takes no mail, 'unknown' when DNS could not answer in time (the
 * address is then accepted: a slow resolver must not block sign-ups).
 */
async function emailDomainStatus(domain) {
  if (!domainCheckEnabled()) return 'ok';
  const cached = cache.get(domain);
  if (cached && cached.until > Date.now()) return cached.status;
  const lookup = lookupOverride || lookupDomain;
  let timer;
  const status = await Promise.race([
    Promise.resolve().then(() => lookup(domain)).catch(() => 'unknown'),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve('unknown'), LOOKUP_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
  if (status !== 'unknown') {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(domain, { status, until: Date.now() + CACHE_MS });
  }
  return status;
}

const EMAIL_INCOMPLETE_MESSAGE =
  'البريد الإلكتروني غير صحيح. اكتب العنوان كاملاً، مثل name@gmail.com.';
const EMAIL_DOMAIN_MISSING_MESSAGE =
  'نطاق البريد الإلكتروني غير موجود أو لا يستقبل الرسائل. تأكد من كتابة العنوان بشكل صحيح.';

/**
 * Checks an email for a new account. Returns null when it may be used, or
 * { code, error } to send back (codes: EMAIL_INVALID, EMAIL_DOMAIN_TYPO,
 * EMAIL_DOMAIN_NOT_FOUND).
 */
async function newAccountEmailProblem(value) {
  const email = normalizeMobileEmail(value);
  if (!isCompleteEmail(email)) {
    return { code: 'EMAIL_INVALID', error: EMAIL_INCOMPLETE_MESSAGE };
  }
  const suggestion = suggestedEmailDomain(email);
  if (suggestion) {
    return {
      code: 'EMAIL_DOMAIN_TYPO',
      error: `يبدو أن في البريد الإلكتروني خطأً إملائياً. هل تقصد ${email.split('@')[0]}@${suggestion}؟`,
      suggestion: `${email.split('@')[0]}@${suggestion}`,
    };
  }
  const status = await emailDomainStatus(email.split('@')[1]);
  if (status === 'missing') {
    return { code: 'EMAIL_DOMAIN_NOT_FOUND', error: EMAIL_DOMAIN_MISSING_MESSAGE };
  }
  return null;
}

module.exports = {
  isCompleteEmail,
  suggestedEmailDomain,
  emailDomainStatus,
  newAccountEmailProblem,
  setEmailDomainLookupForTests,
  EMAIL_INCOMPLETE_MESSAGE,
};
