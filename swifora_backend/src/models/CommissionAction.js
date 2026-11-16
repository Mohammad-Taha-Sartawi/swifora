const mongoose = require('mongoose');

// A commission operation done from the dashboard ("paid" or "reset"), kept
// so it can be undone: it remembers the driver's commission state before
// the operation and, for a reset, which orders had their commission
// returned to the driver.
const commissionActionSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: { type: String, enum: ['payment', 'reset'], required: true },
  // Shared by every driver of one "reset all".
  batchId: { type: String, default: null },
  at: { type: Date, required: true },
  amount: { type: Number, default: 0 },
  previous: {
    commissionPaid: { type: Boolean, default: false },
    commissionPaidAt: { type: Date, default: null },
    commissionResetAt: { type: Date, default: null },
    commissionAdjustment: { type: Number, default: 0 },
  },
  // Reset: the commission moved back to the driver, per order.
  orders: [{
    _id: false,
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    amount: { type: Number, default: 0 },
  }],
  // Payment: the payment record it created (removed when undone).
  paymentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  undoneAt: { type: Date, default: null },
  undoneBy: { type: mongoose.Schema.Types.ObjectId, default: null },
});

commissionActionSchema.index({ driverId: 1, at: -1 });
commissionActionSchema.index({ batchId: 1 });

module.exports = mongoose.model('CommissionAction', commissionActionSchema);
