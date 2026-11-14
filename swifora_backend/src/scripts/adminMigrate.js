// Moves admin accounts from "users" to "admins" (also done at server start).
// usage: npm run admin:migrate
require('dotenv').config();
const mongoose = require('mongoose');
const { requiredValue } = require('../config');
const { migrateAdminsFromUsers } = require('../services/adminMigration');

async function main() {
  await mongoose.connect(requiredValue('MONGODB_URI'));
  const moved = await migrateAdminsFromUsers({ log: (line) => console.log(line) });
  if (moved === 0) console.log('No admin accounts left in users; nothing to move');
}

main()
  .catch((err) => {
    console.error(`Admin migration failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
