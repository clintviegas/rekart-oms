const { Customer } = require('../models');

async function upsertCustomerFromOrder(tenantId, order) {
  const phone = order.phone;
  if (!phone) return;
  await Customer.findOneAndUpdate(
    { tenantId, phone },
    {
      $set: {
        name: order.customer,
        lastOrderAt: new Date()
      },
      $inc: {
        orderCount: 1,
        totalSpent: Number(order.amount || 0)
      }
    },
    { upsert: true, new: true }
  );
}

module.exports = { upsertCustomerFromOrder };
