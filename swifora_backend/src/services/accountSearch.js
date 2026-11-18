// Finding a driver or customer in the dashboard by what the admin has at
// hand: the ID (publicId, "ID 1234" also works), the email, any of the
// account's phone numbers (written any way: 0599 123 456, +970599123456,
// Arabic digits…) or part of the name.
//
// An exact hit (same ID, same email, same full number) wins; otherwise
// every account matching part of the email, number or name is returned so
// the admin can pick one. The dashboard's main.js (accountSearchText /
// accountMatches) applies the same rules to lists already on screen.
const mongoose = require('mongoose');
const { normalizePhoneNumber, primaryPhoneOf } = require('./phoneNumbers');

const MAX_QUERY_LENGTH = 100;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The part of a number that stays the same however it is written:
 * 0599123456, +970599123456 and +972599123456 all give 599123456.
 */
function phoneCore(value) {
  let digits = normalizePhoneNumber(value).replace(/^\+/, '');
  if (/^97[02]\d{6,}$/.test(digits)) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** Digits that may be stored with spaces, dashes, dots or brackets. */
function storedDigitsPattern(digits) {
  return digits.split('').join('[\\s\\-().]*');
}

function cleanQuery(raw) {
  const text = String(raw ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  // "ID 1234", "id:1234", "#1234" → 1234
  return text.replace(/^(?:id\b[\s:#-]*|#)/i, '').trim() || text;
}

/**
 * MongoDB conditions for [raw]: `exact` (one account expected) and `any`
 * (all partial matches). Null when there is nothing to search for.
 */
function accountSearchConditions(raw) {
  const query = cleanQuery(raw);
  if (!query) return null;

  const exact = [{ publicId: query }];
  const partial = [
    { fullName: { $regex: escapeRegex(query), $options: 'i' } },
    { name: { $regex: escapeRegex(query), $options: 'i' } },
    { email: { $regex: escapeRegex(query.toLowerCase()), $options: 'i' } },
  ];

  if (/^[a-f0-9]{24}$/i.test(query) && mongoose.isValidObjectId(query)) {
    exact.push({ _id: new mongoose.Types.ObjectId(query) });
  }
  if (query.includes('@')) exact.push({ email: query.toLowerCase() });

  const normalized = normalizePhoneNumber(query);
  if (/^\+?\d+$/.test(normalized)) {
    const core = phoneCore(normalized);
    if (core.length >= 4) {
      const digits = storedDigitsPattern(core);
      partial.push(
        { 'phoneNumbers.number': { $regex: digits } },
        { phone: { $regex: digits } },
      );
      if (core.length >= 9) {
        // The whole number, whatever prefix it was saved with.
        const whole = `^(?:\\+?97[02]|0)?[\\s\\-().]*${digits}$`;
        exact.push(
          { 'phoneNumbers.number': { $regex: whole } },
          { phone: { $regex: whole } },
        );
      }
    }
  }

  return { exact: { $or: exact }, any: { $or: [...exact, ...partial] } };
}

/**
 * Accounts of [Model] within [scope] (e.g. { role: 'provider' }) matching
 * [raw]: one exact hit, or up to [limit] partial matches (`more` when there
 * are others).
 */
async function findAccounts(Model, scope, raw, { limit = 20 } = {}) {
  const conditions = accountSearchConditions(raw);
  if (!conditions) return { accounts: [], more: false };

  const exact = await Model.find({ $and: [scope, conditions.exact] }).limit(2).lean();
  if (exact.length === 1) return { accounts: exact, more: false };

  const found = await Model.find({ $and: [scope, conditions.any] })
    .sort({ fullName: 1, _id: 1 })
    .limit(limit + 1)
    .lean();
  return { accounts: found.slice(0, limit), more: found.length > limit };
}

/** What the dashboard shows in a "choose one" list. */
function accountSummary(user) {
  return {
    _id: user._id.toString(),
    fullName: user.fullName || user.name || '',
    publicId: user.publicId || '',
    email: user.email || '',
    phone: primaryPhoneOf(user),
    governorate: user.governorate || '',
    area: user.area || '',
    status: user.status || '',
  };
}

module.exports = {
  escapeRegex,
  phoneCore,
  accountSearchConditions,
  findAccounts,
  accountSummary,
};
