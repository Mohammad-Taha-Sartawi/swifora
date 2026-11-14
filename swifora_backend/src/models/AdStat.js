const mongoose = require('mongoose');

// Daily totals per ad, reported by the mobile apps (POST /api/ads/events).
// `day` is the local date (Asia/Hebron, like the commission report),
// e.g. "2026-11-14".
const adStatSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ad', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    impressions: { type: Number, default: 0, min: 0 },
    taps: { type: Number, default: 0, min: 0 },
    // Distinct users who saw / tapped the ad that day.
    viewers: { type: Number, default: 0, min: 0 },
    tappers: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

adStatSchema.index({ adId: 1, day: 1 }, { unique: true });
adStatSchema.index({ day: 1 });

module.exports = mongoose.model('AdStat', adStatSchema);
