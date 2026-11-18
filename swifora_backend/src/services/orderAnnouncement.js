const User = require('../models/User');
const { orderResponderFilter } = require('./orderVisibility');
const { arabicAreaName } = require('./locationCatalog');
const { sendPushToUsers } = require('./pushNotifications');

function maskedPhone(phone) {
  const value = String(phone || '');

  return value.length > 3
    ? `${value.slice(0, -3)}***`
    : '***';
}

/**
 * Tells the drivers who can take [order] about it: a live `new_order` event
 * for open apps and a push notification for closed or background ones. Used
 * for a new order and for an order sent out again (by the customer or from
 * the dashboard). The full customer phone is never included.
 */
async function announceOrderToDrivers(io, order) {
  const value = typeof order?.toObject === 'function' ? order.toObject() : order;
  if (!value?._id) return;

  if (io) {
    const payload = {
      _id: value._id,
      type: value.type,
      description: value.description,
      area: value.area,
      governorate: value.governorate,
      governorateLevel: value.governorateLevel,
      location: value.location,
      status: value.status,
      createdAt: value.createdAt,
      phoneMasked: maskedPhone(value.phone),
    };
    const areaRoom = `area:${value.area || ''}`;
    // Governorate-level drivers sit in the governorate room; reach them
    // too, without sending the same-village drivers a duplicate.
    if (value.governorate) {
      const governorateRoom = `governorate:${value.governorate}`;
      io.to(areaRoom).except(governorateRoom).emit('new_order', payload);
      io.to(governorateRoom).emit('new_order', payload);
    } else {
      io.to(areaRoom).emit('new_order', payload);
    }
  }

  const pushAnd = [
    {
      $or: [
        { blockedUntil: null },
        { blockedUntil: { $exists: false } },
        { blockedUntil: { $lte: new Date() } },
      ],
    },
    {
      $or: [
        { serviceTypes: { $exists: false } },
        { serviceTypes: { $size: 0 } },
        { serviceTypes: value.type },
      ],
    },
  ];
  const responderVisibility = orderResponderFilter(value);
  if (responderVisibility) {
    pushAnd.push(responderVisibility);
  }
  const eligibleDrivers = await User.find({
    role: 'provider',
    status: 'active',
    deleted: { $ne: true },
    isAvailable: { $ne: false },
    $and: pushAnd,
  })
    .select('_id')
    .lean();

  await sendPushToUsers(
    eligibleDrivers.map((driver) => driver._id),
    {
      title: 'طلب جديد',
      body: `${value.description || 'طلب جديد'} — ${await arabicAreaName(value.area)}`.trim(),
      data: {
        type: 'new_order',
        orderId: value._id.toString(),
      },
    },
  );
}

module.exports = {
  announceOrderToDrivers,
  maskedPhone,
};
