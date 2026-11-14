// Creates dashboard administrators in the separate "admins" collection.
// Used by `npm run admin:bootstrap` (first admin) and `npm run admin:create`
// (any further admin).
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const {
  isValidAdminPassword,
  MIN_ADMIN_PASSWORD_LENGTH,
} = require('../security/passwordPolicy');

class AdminCreationError extends Error {}

/**
 * The new admin's password: ADMIN_PASSWORD, or - when ADMIN_PASSWORD_FILE
 * is set instead - a random one written to that file (owner-only), so the
 * password is never typed on a command line or printed.
 */
function resolveAdminPassword(env = process.env) {
  if (env.ADMIN_PASSWORD) return env.ADMIN_PASSWORD;
  const file = (env.ADMIN_PASSWORD_FILE || '').trim();
  if (!file) {
    throw new AdminCreationError('Set ADMIN_PASSWORD or ADMIN_PASSWORD_FILE');
  }
  if (fs.existsSync(file)) {
    throw new AdminCreationError(`${file} already exists; refusing to overwrite it`);
  }
  const password = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(file, password, { mode: 0o600, flag: 'wx' });
  return password;
}

/**
 * `password` may be a function; it is called only after the email and name
 * pass every check, so a refused request leaves no password file behind.
 */
async function createAdmin({
  email,
  fullName,
  password: passwordOrResolver,
  AdminModel = Admin,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const name = String(fullName || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AdminCreationError('ADMIN_EMAIL is not a valid email address');
  }
  if (name.length < 2) {
    throw new AdminCreationError('ADMIN_FULL_NAME is required');
  }
  if (await AdminModel.exists({ email: normalizedEmail })) {
    throw new AdminCreationError('An administrator with this email already exists');
  }
  const password = typeof passwordOrResolver === 'function'
    ? passwordOrResolver()
    : passwordOrResolver;
  if (!isValidAdminPassword(password)) {
    throw new AdminCreationError(
      `The password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters and must not be an obvious placeholder`,
    );
  }

  return AdminModel.create({
    fullName: name,
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    status: 'active',
  });
}

module.exports = {
  AdminCreationError,
  createAdmin,
  resolveAdminPassword,
};
