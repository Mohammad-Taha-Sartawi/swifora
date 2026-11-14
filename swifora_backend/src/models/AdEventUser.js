const mongoose = require('mongoose');

// One row per user, ad, day and event type: counts each user once in the
// daily "viewers" / "tappers" figures. Rows expire after 120 days.
const adEventUserSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, required: true },
    day: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['impression', 'tap'], required: true },
    expireAt: { type: Date, required: true },
  },
  { versionKey: false },
);

adEventUserSchema.index(
  { adId: 1, day: 1, userId: 1, type: 1 },
  { unique: true },
);
adEventUserSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdEventUser', adEventUserSchema);
