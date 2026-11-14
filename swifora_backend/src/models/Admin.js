const mongoose = require('mongoose');

// Dashboard administrators, kept in their own collection ("admins"),
// separate from customers and drivers in "users". User searches, deletes
// and bulk operations on "users" can therefore never reach an admin.
//
// `role`, `status` and `deleted` mirror the old User fields so the session
// checks (services/adminAccounts.js) stay the same.
const adminSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin'], default: 'admin', immutable: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    deleted: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0, min: 0 },
    adminTotpSecret: { type: String, default: '', select: false },
    adminTotpEnabled: { type: Boolean, default: false },
    adminTotpRecoveryCodeHashes: {
      type: [String],
      default: [],
      select: false,
    },
    adminTotpEnabledAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    collection: 'admins',
    timestamps: true,
  },
);

module.exports = mongoose.model('Admin', adminSchema);
