const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  type: { type: String, enum: ['new_offer', 'offer_accepted', 'offer_not_selected', 'driver_taken', 'order_pending', 'new_order', 'offer_submitted', 'order_completed', 'delivery_confirmation', 'delivery_confirmed', 'delivery_rejected', 'new_rating', 'report_reply', 'broadcast', 'order_cancelled'], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  // When the user confirmed the pop-up of a broadcast message. The message
  // itself stays pinned in the notifications list until it expires.
  acknowledgedAt: { type: Date, default: null },
  // Deleted by the TTL index below. 30 days unless set shorter (pinned
  // messages, account notices): the screen never shows anything older
  // (services/notificationWindow.js), so nothing is kept longer either.
  expireAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);