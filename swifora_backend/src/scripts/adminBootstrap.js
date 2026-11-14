// First dashboard administrator (only when there is none yet).
// usage: ADMIN_EMAIL=... ADMIN_FULL_NAME=... ADMIN_PASSWORD=... npm run admin:bootstrap
//    or ADMIN_PASSWORD_FILE=/root/new-admin-password.txt instead of ADMIN_PASSWORD
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const { requiredValue } = require('../config');
const { migrateAdminsFromUsers } = require('../services/adminMigration');
const { createAdmin, resolveAdminPassword } = require('../services/adminCreation');

async function bootstrapAdmin() {
  const email = requiredValue('ADMIN_EMAIL');
  const fullName = requiredValue('ADMIN_FULL_NAME');

  await mongoose.connect(requiredValue('MONGODB_URI'));
  // Admins left in "users" by older versions count as existing admins.
  await migrateAdminsFromUsers();
  if (await Admin.exists({})) {
    throw new Error('An administrator already exists; use npm run admin:create to add another');
  }

  const admin = await createAdmin({ email, fullName, password: () => resolveAdminPassword() });
  console.log(`Administrator created for ${admin.email}`);
}

bootstrapAdmin()
  .catch((err) => {
    console.error(`Admin bootstrap failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
