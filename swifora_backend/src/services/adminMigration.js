// Moves administrator accounts out of "users" into their own "admins"
// collection. Runs at server start and from `npm run admin:migrate`.
//
// Each admin keeps its _id (dashboard sessions and the audit log stay
// valid), its email, password hash, session version and two-factor setup.
// The copy is written first; the "users" document is removed only after
// the "admins" document exists. Running it again does nothing.
const User = require('../models/User');
const Admin = require('../models/Admin');

const COPIED_FIELDS = [
  'fullName',
  'email',
  'password',
  'status',
  'deleted',
  'sessionVersion',
  'adminTotpSecret',
  'adminTotpEnabled',
  'adminTotpRecoveryCodeHashes',
  'adminTotpEnabledAt',
  'createdAt',
];

async function migrateAdminsFromUsers({
  UserModel = User,
  AdminModel = Admin,
  log = () => {},
} = {}) {
  // Raw documents: the hidden fields (password, TOTP secret) come along.
  const legacy = await UserModel.collection
    .find({ role: 'admin' })
    .toArray();

  let moved = 0;
  for (const doc of legacy) {
    const copy = { _id: doc._id, role: 'admin' };
    for (const field of COPIED_FIELDS) {
      if (doc[field] !== undefined) copy[field] = doc[field];
    }
    if (!copy.fullName) copy.fullName = doc.name || 'Admin';
    if (copy.status !== 'active') copy.status = 'inactive';

    const existing = await AdminModel.collection.findOne({ _id: doc._id });
    if (!existing) {
      try {
        await AdminModel.collection.insertOne({
          ...copy,
          updatedAt: new Date(),
          lastLoginAt: null,
          __v: 0,
        });
      } catch (error) {
        // Same email already in "admins" under another id: keep the old
        // account where it is rather than lose anything.
        if (error?.code === 11000) {
          log(`Admin ${doc._id} not moved: email already used in admins`);
          continue;
        }
        throw error;
      }
    }
    await UserModel.collection.deleteOne({ _id: doc._id, role: 'admin' });
    moved += 1;
  }

  if (moved > 0) log(`Moved ${moved} admin account(s) to the admins collection`);
  return moved;
}

module.exports = {
  migrateAdminsFromUsers,
};
