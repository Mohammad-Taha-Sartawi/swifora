// Average rating drivers gave each customer, for drivers' order lists and
// the dashboard.
const mongoose = require('mongoose');
const CustomerRating = require('../models/CustomerRating');

/**
 * Returns Map<customerId string, { average, count, positiveCount }> for
 * [customerIds] (positiveCount: ratings of 4 or 5 stars).
 * Customers without ratings are absent from the map.
 */
async function customerRatingSummaries(customerIds) {
  const ids = [...new Set((customerIds || [])
    .filter(Boolean)
    .map((id) => id.toString())
    .filter((id) => mongoose.isValidObjectId(id)))]
    .map((id) => new mongoose.Types.ObjectId(id));
  if (ids.length === 0) return new Map();

  const rows = await CustomerRating.aggregate([
    { $match: { customerId: { $in: ids } } },
    {
      $group: {
        _id: '$customerId',
        count: { $sum: 1 },
        stars: { $sum: '$rating' },
        positiveCount: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [
    row._id.toString(),
    {
      average: Math.round((row.stars / row.count) * 10) / 10,
      count: row.count,
      positiveCount: row.positiveCount || 0,
    },
  ]));
}

/** The populated or raw customer id of an order document. */
function orderCustomerId(order) {
  const customer = order?.customerId;
  if (!customer) return null;
  return (customer._id || customer).toString();
}

/** A customer nobody has rated yet. */
const NO_RATINGS = Object.freeze({ average: 0, count: 0, positiveCount: 0 });

/**
 * Adds `customerRating: { average, count, positiveCount }` to each order's
 * populated customer (count 0 for a customer nobody has rated yet), in
 * place. Returns the orders.
 */
async function attachCustomerRatings(orders) {
  const summaries = await customerRatingSummaries(orders.map(orderCustomerId));
  for (const order of orders) {
    const summary = summaries.get(orderCustomerId(order)) || { ...NO_RATINGS };
    if (order.customerId && typeof order.customerId === 'object' && order.customerId._id) {
      order.customerId.rating = summary;
    }
    order.customerRatingSummary = summary;
  }
  return orders;
}

module.exports = {
  customerRatingSummaries,
  attachCustomerRatings,
};
