// Account deletion requests sent from the apps, reviewed in the dashboard.
//
// Each request shows what the admins check before approving: for a driver
// the platform commission still unpaid, for a customer the orders not
// finished yet (and for both, orders being delivered right now, which
// block the deletion). Approving deletes the account for good
// (accountDeletion.js); a request the user withdrew stays listed as
// cancelled.
const express = require('express');
const { sendInternalServerFailure } = require('../security/errorResponse');
const { rejectInvalidObjectIdParams } = require('../middleware/objectIdParams');
const AccountDeletionRequest = require('../models/AccountDeletionRequest');
const User = require('../models/User');
const Order = require('../models/Order');
const { splitCommission } = require('../services/commissionLedger');
const {
  permanentlyDeleteAccount,
  AccountDeletionBlockedError,
} = require('../services/accountDeletion');

const router = express.Router();
rejectInvalidObjectIdParams(router, ['id']);

const LIST_LIMIT = 200;

/** What the admins need to decide on [request]'s account. */
async function accountCheck(request) {
  const user = await User.findOne({ _id: request.userId, deleted: { $ne: true } }).lean();
  if (!user) return { accountExists: false };

  const own = request.role === 'provider' ? { providerId: user._id } : { customerId: user._id };
  const [openOrders, inProgressOrders] = await Promise.all([
    Order.countDocuments({ ...own, status: { $in: ['pending', 'offered'] } }),
    Order.countDocuments({ ...own, status: { $in: ['accepted', 'fulfilling'] } }),
  ]);
  const check = { accountExists: true, openOrders, inProgressOrders };
  if (request.role === 'provider') {
    const orders = await Order.find({
      providerId: user._id,
      status: { $in: ['accepted', 'fulfilling', 'completed'] },
    }).select('platformCommission acceptedAt completedAt createdAt').lean();
    check.unpaidCommission = splitCommission(orders, user).unpaid;
  }
  return check;
}

router.get('/', async (req, res) => {
  try {
    const requests = await AccountDeletionRequest.find()
      .sort({ requestedAt: -1 })
      .limit(LIST_LIMIT)
      .lean();
    // Open requests first, newest first within each group.
    requests.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
    const rows = await Promise.all(requests.map(async (request) => ({
      id: request._id.toString(),
      role: request.role,
      fullName: request.fullName,
      email: request.email,
      publicId: request.publicId,
      status: request.status,
      requestedAt: request.requestedAt,
      cancelledAt: request.cancelledAt,
      approvedAt: request.approvedAt,
      ...(request.status === 'pending' ? await accountCheck(request) : {}),
    })));
    res.json({ success: true, requests: rows });
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const request = await AccountDeletionRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (request.status === 'cancelled') {
      return res.json({ success: false, code: 'REQUEST_CANCELLED', message: 'ألغى صاحب الحساب هذا الطلب.' });
    }
    if (request.status !== 'pending') {
      return res.json({ success: false, code: 'REQUEST_CLOSED', message: 'تمت الموافقة على هذا الطلب من قبل.' });
    }

    const user = await User.findOne({ _id: request.userId, deleted: { $ne: true } });
    if (user) {
      // Throws while an order is being delivered (handled below).
      await permanentlyDeleteAccount(user, { io: req.app.get('io') });
    }

    // Only if the user did not withdraw it meanwhile.
    const updated = await AccountDeletionRequest.findOneAndUpdate(
      { _id: request._id, status: 'pending' },
      { $set: { status: 'approved', approvedAt: new Date(), approvedBy: req.adminUser?.id || null } },
      { new: true },
    );
    if (!updated && user) {
      // Withdrawn at the same moment, but the account is already gone.
      await AccountDeletionRequest.updateOne(
        { _id: request._id },
        { $set: { status: 'approved', approvedAt: new Date(), approvedBy: req.adminUser?.id || null } },
      );
    }
    res.json({
      success: true,
      message: `تم حذف حساب ${request.fullName || ''} نهائياً`.replace(/\s+/g, ' ').trim(),
    });
  } catch (err) {
    if (err instanceof AccountDeletionBlockedError) {
      return res.json({ success: false, code: err.code, message: err.message });
    }
    sendInternalServerFailure(res);
  }
});

module.exports = router;
