// Phone numbers on accounts: one shape for the app and the dashboard.
//
// Accepted: mobile numbers used in Palestine, 05X followed by 7 digits
// (Jawwal 059, Ooredoo 056 and the other 05X networks), written locally
// (0599123456) or internationally (+970599123456, +972599123456,
// 00970599123456). Spaces, dashes, dots, brackets and direction marks are
// dropped, Arabic-Indic digits become 0-9, and a leading 00 becomes +.
// Numbers whose last 7 digits are all the same (0590000000) are rejected.

function normalizePhoneNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }
  let number = String(value)
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\s\-().‎‏‪-‮⁦-⁩]/g, '');
  if (number.startsWith('00')) number = `+${number.slice(2)}`;
  return number;
}

const MOBILE_NUMBER = /^(?:0|\+97[02])5\d(\d{7})$/;

function isValidPhoneNumber(value) {
  const match = MOBILE_NUMBER.exec(typeof value === 'string' ? value : '');
  if (!match) return false;
  return !/^(\d)\1{6}$/.test(match[1]);
}

/**
 * Returns a copy of [phoneNumbers] whose primary number is [phone]. Other
 * numbers on the account are kept (a duplicate of the new number is dropped).
 */
function replacePrimaryPhone(phoneNumbers, phone) {
  const others = (phoneNumbers || [])
    .filter((entry) => entry && !entry.primary && entry.number !== phone)
    .map((entry) => ({ number: entry.number, primary: false }));
  return [{ number: phone, primary: true }, ...others];
}

/** The account's main number (older accounts may keep it in `phone`). */
function primaryPhoneOf(user) {
  const numbers = (user && user.phoneNumbers) || [];
  const primary = numbers.find((entry) => entry && entry.primary) || numbers[0];
  return (primary && primary.number) || (user && user.phone) || '';
}

const INVALID_PHONE_MESSAGE =
  'رقم الهاتف غير صحيح. أدخل رقم جوال من 10 أرقام يبدأ بـ 05، مثل 0599123456، أو بالصيغة الدولية ‎+970599123456.';

module.exports = {
  normalizePhoneNumber,
  isValidPhoneNumber,
  replacePrimaryPhone,
  primaryPhoneOf,
  INVALID_PHONE_MESSAGE,
};
