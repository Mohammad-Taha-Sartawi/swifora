const mongoose = require('mongoose');

/**
 * A customer's or driver's request to delete their account, reviewed in the
 * dashboard. The name, email and public ID are copied so the request still
 * reads correctly after the account itself is deleted.
 *
 * pending   - waiting for the admins (the user can still withdraw it)
 * cancelled - withdrawn by the user
 * approved  - accepted by an admin; the account was deleted
 */
const accountDeletionRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['customer', 'provider'], required: true },
  fullName: { type: String, default: '' },
  email: { type: String, default: '' },
  publicId: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'cancelled', 'approved'],
    default: 'pending',
  },
  requestedAt: { type: Date, default: Date.now },
  cancelledAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
});

// At most one open request per account.
accountDeletionRequestSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
accountDeletionRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('AccountDeletionRequest', accountDeletionRequestSchema);
