// Undo for the dashboard's commission operations ("paid" and "reset").
//
// Each operation records the driver's commission state before it. Undo
// restores that state exactly, newest first: only a driver's latest
// operation that is not undone yet can be undone (after undoing it, the
// one before becomes undoable). Orders accepted after the operation are not
// touched.
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const CommissionPayment = require('../models/CommissionPayment');
const CommissionAction = require('../models/CommissionAction');

function snapshot(driver) {
  return {
    commissionPaid: driver.commissionPaid === true,
    commissionPaidAt: driver.commissionPaidAt || null,
    commissionResetAt: driver.commissionResetAt || null,
    commissionAdjustment: Number(driver.commissionAdjustment) || 0,
  };
}

function validId(id) {
  return mongoose.isValidObjectId(id) ? id : null;
}

async function recordAction(fields) {
  return CommissionAction.create({
    ...fields,
    createdBy: validId(fields.createdBy),
  });
}

/** The driver's latest operation that can still be undone, or null. */
async function latestUndoableAction(driverId) {
  if (!mongoose.isValidObjectId(driverId)) return null;
  return CommissionAction.findOne({ driverId, undoneAt: null })
    .sort({ at: -1, _id: -1 })
    .lean();
}

/** Public shape for the dashboard. */
function actionSummary(action) {
  if (!action) return null;
  return {
    id: action._id.toString(),
    type: action.type,
    amount: action.amount || 0,
    at: action.at,
    batchId: action.batchId || null,
    orders: Array.isArray(action.orders) ? action.orders.length : 0,
  };
}

class CommissionUndoError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

/**
 * Undoes [actionId]. Throws CommissionUndoError when it is not the
 * driver's latest operation or was already undone.
 */
async function undoCommissionAction(actionId, adminId) {
  if (!mongoose.isValidObjectId(actionId)) {
    throw new CommissionUndoError('العملية غير موجودة', 404);
  }
  const action = await CommissionAction.findById(actionId).lean();
  if (!action) throw new CommissionUndoError('العملية غير موجودة', 404);
  if (action.undoneAt) throw new CommissionUndoError('تم التراجع عن هذه العملية مسبقاً.');

  const latest = await latestUndoableAction(action.driverId);
  if (!latest || latest._id.toString() !== action._id.toString()) {
    throw new CommissionUndoError('يمكن التراجع عن آخر عملية على عمولة السائق فقط.');
  }

  // Claim it first, so two clicks cannot undo it twice.
  const claimed = await CommissionAction.findOneAndUpdate(
    { _id: action._id, undoneAt: null },
    { $set: { undoneAt: new Date(), undoneBy: validId(adminId) } },
    { new: true },
  ).lean();
  if (!claimed) throw new CommissionUndoError('تم التراجع عن هذه العملية مسبقاً.');

  let ordersRestored = 0;
  if (action.type === 'reset' && action.orders.length > 0) {
    // Give the platform its commission back on exactly those orders.
    const result = await Order.bulkWrite(action.orders.map((entry) => ({
      updateOne: {
        filter: {
          _id: entry.orderId,
          platformCommission: 0,
          commissionWaivedAt: action.at,
        },
        update: [{
          $set: {
            platformCommission: entry.amount,
            providerEarning: { $subtract: ['$providerEarning', entry.amount] },
            commissionWaivedAt: null,
          },
        }],
      },
    })));
    ordersRestored = result.modifiedCount || 0;
  }
  if (action.type === 'payment' && action.paymentId) {
    await CommissionPayment.deleteOne({ _id: action.paymentId });
  }

  await User.updateOne(
    { _id: action.driverId },
    {
      $set: {
        commissionPaid: action.previous?.commissionPaid === true,
        commissionPaidAt: action.previous?.commissionPaidAt || null,
        commissionResetAt: action.previous?.commissionResetAt || null,
        commissionAdjustment: Number(action.previous?.commissionAdjustment) || 0,
      },
    },
  );

  return {
    type: action.type,
    amount: action.amount || 0,
    driverId: action.driverId.toString(),
    ordersRestored,
  };
}

/**
 * Undoes a "reset all": every driver whose latest operation is still the
 * one from [batchId]. Returns how many were undone and skipped.
 */
async function undoResetBatch(batchId, adminId) {
  if (typeof batchId !== 'string' || !batchId) {
    throw new CommissionUndoError('العملية غير موجودة', 404);
  }
  const actions = await CommissionAction.find({ batchId, undoneAt: null }).lean();
  let undone = 0;
  let skipped = 0;
  let amount = 0;
  for (const action of actions) {
    try {
      const result = await undoCommissionAction(action._id, adminId);
      undone += 1;
      amount += result.amount;
    } catch (err) {
      if (!(err instanceof CommissionUndoError)) throw err;
      skipped += 1;
    }
  }
  return { undone, skipped, amount: Math.round(amount * 100) / 100 };
}

/** The latest "reset all" that still has something to undo, or null. */
async function latestUndoableBatch() {
  const latest = await CommissionAction.findOne({ batchId: { $ne: null } })
    .sort({ at: -1 })
    .lean();
  if (!latest) return null;
  const pending = await CommissionAction.find({ batchId: latest.batchId, undoneAt: null })
    .select('driverId amount')
    .lean();
  if (pending.length === 0) return null;
  return {
    batchId: latest.batchId,
    at: latest.at,
    drivers: pending.length,
    amount: Math.round(pending.reduce((sum, a) => sum + (a.amount || 0), 0) * 100) / 100,
  };
}

module.exports = {
  snapshot,
  recordAction,
  latestUndoableAction,
  actionSummary,
  undoCommissionAction,
  undoResetBatch,
  latestUndoableBatch,
  CommissionUndoError,
};
