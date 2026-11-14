// Adds a dashboard administrator (in the separate "admins" collection).
// usage: ADMIN_EMAIL=... ADMIN_FULL_NAME=... ADMIN_PASSWORD=... npm run admin:create
//    or ADMIN_PASSWORD_FILE=/root/new-admin-password.txt instead of ADMIN_PASSWORD:
//       a random password is written to that file (owner-only) and not printed.
require('dotenv').config();
const mongoose = require('mongoose');
const { requiredValue } = require('../config');
const { migrateAdminsFromUsers } = require('../services/adminMigration');
const { createAdmin, resolveAdminPassword } = require('../services/adminCreation');

async function main() {
  const email = requiredValue('ADMIN_EMAIL');
  const fullName = requiredValue('ADMIN_FULL_NAME');
  await mongoose.connect(requiredValue('MONGODB_URI'));
  await migrateAdminsFromUsers();
  const admin = await createAdmin({ email, fullName, password: () => resolveAdminPassword() });
  console.log(`Administrator created for ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(`Admin creation failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
