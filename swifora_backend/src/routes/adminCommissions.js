const { sendInternalServerError, sendInternalServerFailure } = require('../security/errorResponse');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const CommissionPayment = require('../models/CommissionPayment');
const { splitCommission, isCommissionDue } = require('../services/commissionLedger');
const { serviceTypesLabel } = require('../services/providerServiceTypes');
const crypto = require('crypto');
const CommissionAction = require('../models/CommissionAction');
const {
  snapshot,
  recordAction,
  actionSummary,
  undoCommissionAction,
  undoResetBatch,
  latestUndoableBatch,
  CommissionUndoError,
} = require('../services/commissionActions');

function adminIdOf(req) {
  return req.session?.admin?.id || null;
}

function primaryPhone(user) {
  const phones = Array.isArray(user.phoneNumbers) ? user.phoneNumbers : [];
  return (
    phones.find((phone) => phone.primary)?.number
    || phones[0]?.number
    || user.phone
    || ''
  );
}

router.get('/', async (req, res) => {
  try {
    const providers = await User.find({
      role: 'provider',
      deleted: { $ne: true },
    }).lean();
    let totalUnpaid = 0, totalPaid = 0, unpaidDrivers = 0, paidDrivers = 0;
    const driverRows = [];
    const lastActions = new Map((await CommissionAction.aggregate([
      { $match: { undoneAt: null } },
      { $sort: { at: -1, _id: -1 } },
      { $group: { _id: '$driverId', action: { $first: '$$ROOT' } } },
    ])).map((row) => [row._id.toString(), actionSummary(row.action)]));

    for (const driver of providers) {
      const orders = await Order.find({
        providerId: driver._id,
        status: { $in: ['accepted', 'fulfilling', 'completed'] },
      }).lean();
      const { unpaid, paid } = splitCommission(orders, driver);
      const totalEarnings = orders.reduce((s, o) => s + (o.providerEarning || 0), 0);
      const paidAt = driver.commissionPaidAt ? new Date(driver.commissionPaidAt) : null;
      const resetAt = driver.commissionResetAt ? new Date(driver.commissionResetAt) : null;
      let paymentStatus = 'unpaid';
      if (unpaid > 0) {
        paymentStatus = 'unpaid';
      } else if (resetAt && (!paidAt || resetAt >= paidAt)) {
        paymentStatus = 'reset';
      } else if (paid > 0 || paidAt) {
        paymentStatus = 'paid';
      }

      if (unpaid > 0) {
        totalUnpaid += unpaid;
        unpaidDrivers++;
      }
      if (paid > 0) {
        totalPaid += paid;
        paidDrivers++;
      }

      driverRows.push({
        lastAction: lastActions.get(driver._id.toString()) || null,
        _id: driver._id.toString(),
        driverId: driver.publicId || driver._id.toString().slice(-8),
        name: driver.fullName || driver.name,
        phone: primaryPhone(driver),
        serviceType: serviceTypesLabel(driver.serviceTypes),
        commission: unpaid,
        paidCommission: paid,
        earnings: totalEarnings,
        paymentStatus
      });
    }

    driverRows.sort((a, b) => b.commission - a.commission);
    res.json({
      totalUnpaid,
      totalPaid,
      unpaidDrivers,
      paidDrivers,
      driverRows,
      lastResetAll: await latestUndoableBatch(),
    });
  } catch (err) {
    sendInternalServerError(res);
  }
});

async function resetDriverCommissionById(driverId, { batchId = null, adminId = null } = {}) {
  const driver = await User.findById(driverId);

  if (!driver || driver.role !== 'provider') {
    return { success: false, message: 'السائق غير موجود' };
  }

  const orders = await Order.find({
    providerId: driver._id,
    status: { $in: ['accepted', 'fulfilling', 'completed'] },
    platformCommission: { $gt: 0 },
  }).lean();

  const dueOrders = orders.filter((order) =>
    isCommissionDue(order, driver),
  );
  const adjustmentAmount = Number(driver.commissionAdjustment) || 0;
  const now = new Date();
  const previous = snapshot(driver);

  if (dueOrders.length > 0) {
    // Return the platform commission to the driver: move it from
    // platformCommission into providerEarning, so it is no longer counted as
    // platform revenue or as an outstanding due.
    await Order.bulkWrite(
      dueOrders.map((order) => ({
        updateOne: {
          filter: {
            _id: order._id,
            platformCommission: order.platformCommission,
          },
          update: [
            {
              $set: {
                providerEarning: {
                  $add: ['$providerEarning', '$platformCommission'],
                },
                platformCommission: 0,
                commissionWaivedAt: now,
              },
            },
          ],
        },
      })),
    );
  }

  driver.commissionResetAt = now;
  driver.commissionAdjustment = 0;
  await driver.save();

  const amount = Math.max(
    0,
    dueOrders.reduce(
      (sum, order) => sum + (order.platformCommission || 0),
      0,
    ) + adjustmentAmount,
  );

  // Kept so the reset can be undone (only when it changed something).
  let action = null;
  if (dueOrders.length > 0 || adjustmentAmount !== 0) {
    action = await recordAction({
      driverId: driver._id,
      type: 'reset',
      batchId,
      at: now,
      amount,
      previous,
      orders: dueOrders.map((order) => ({
        orderId: order._id,
        amount: order.platformCommission || 0,
      })),
      createdBy: adminId,
    });
  }

  return {
    success: true,
    driverName: driver.fullName,
    orders: dueOrders.length,
    amount,
    action: actionSummary(action),
  };
}

router.put('/reset-all', async (req, res) => {
  try {
    const providers = await User.find({ role: 'provider' }).select('_id');
    let drivers = 0;
    let orders = 0;
    let amount = 0;
    // One id for the whole "reset all", so it can be undone in one step.
    const batchId = `reset-all-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    for (const provider of providers) {
      const result = await resetDriverCommissionById(provider._id, {
        batchId,
        adminId: adminIdOf(req),
      });
      if (result.success) {
        drivers++;
        orders += result.orders;
        amount += result.amount;
      }
    }

    res.json({ success: true, drivers, orders, amount, batchId });
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

router.put('/reset/:id', async (req, res) => {
  try {
    const result = await resetDriverCommissionById(req.params.id, {
      adminId: adminIdOf(req),
    });
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

router.put('/pay/:id', async (req, res) => {
  try {
    const driver = await User.findById(req.params.id);
    if (!driver || driver.role !== 'provider') return res.json({ success: false, message: 'السائق غير موجود' });

    const orders = await Order.find({
      providerId: driver._id,
      status: { $in: ['accepted', 'fulfilling', 'completed'] },
    }).lean();
    const { unpaid } = splitCommission(orders, driver);
    const previous = snapshot(driver);
    const now = new Date();

    let payment = null;
    if (unpaid > 0) {
      payment = await CommissionPayment.create({
        driverId: driver._id,
        amount: unpaid,
        method: 'manual_admin',
        note: 'تم تأكيد الدفع من لوحة التحكم',
        paidAt: now,
      });
    }

    driver.commissionPaid = true;
    driver.commissionPaidAt = now;
    driver.commissionResetAt = null;
    driver.commissionAdjustment = 0;
    await driver.save();

    // Kept so the payment can be undone.
    const action = payment
      ? await recordAction({
        driverId: driver._id,
        type: 'payment',
        at: now,
        amount: unpaid,
        previous,
        paymentId: payment._id,
        createdBy: adminIdOf(req),
      })
      : null;

    res.json({
      success: true,
      amount: unpaid,
      action: actionSummary(action),
      message: `تم تحديث حالة السائق (${driver.fullName}) إلى مدفوع`,
    });
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

// Undo the driver's latest "paid" or "reset" (newest first).
router.post('/undo/:actionId', async (req, res) => {
  try {
    const result = await undoCommissionAction(req.params.actionId, adminIdOf(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof CommissionUndoError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return sendInternalServerFailure(res);
  }
});

// Undo a "reset all" for every driver it still applies to.
router.post('/undo-batch/:batchId', async (req, res) => {
  try {
    const result = await undoResetBatch(req.params.batchId, adminIdOf(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof CommissionUndoError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return sendInternalServerFailure(res);
  }
});

module.exports = router;
