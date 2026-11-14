const mongoose = require('mongoose');

const commissionSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    default: 'platform',
  },
  type: {
    type: String,
    enum: ['fixed', 'percent'],
    default: 'fixed',
  },
  value: {
    type: Number,
    default: 1,
    min: 0,
  },
  // Show the "commission due" card (with "pay now") on the driver's home
  // screen in the app. On by default.
  showDriverCommissionCard: {
    type: Boolean,
    default: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('CommissionSetting', commissionSettingSchema);
