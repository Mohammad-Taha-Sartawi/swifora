const mongoose = require('mongoose');

/**
 * A browser (computer or phone) where an admin turned on dashboard alerts.
 * The server sends it a Web Push message when something new needs the
 * admins (adminAlerts.js), even while the dashboard is closed.
 *
 * `sessionVersion` is the admin's at the time: signing out everywhere or
 * changing the password raises it, which stops alerts to older devices.
 */
const adminPushSubscriptionSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  endpoint: { type: String, required: true, unique: true, maxlength: 2048 },
  keys: {
    p256dh: { type: String, required: true, maxlength: 256 },
    auth: { type: String, required: true, maxlength: 128 },
  },
  sessionVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastSentAt: { type: Date, default: null },
});

module.exports = mongoose.model('AdminPushSubscription', adminPushSubscriptionSchema);
