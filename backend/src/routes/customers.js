const { Customer, Order } = require('../models');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { customerUpdateSchema, validateBody } = require('../validation/schemas');

function createCustomersRouter() {
  const router = require('express').Router();

  router.get('/', requireAuth, requirePermission('customers:read'), async (req, res, next) => {
    try {
      const customers = await Customer.find({ tenantId: req.tenantId }).sort({ orderCount: -1 }).lean();
      res.json(customers);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:phone/orders', requireAuth, requirePermission('customers:read'), async (req, res, next) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      const orders = await Order.find({ tenantId: req.tenantId, phone }).sort({ createdAt: -1 }).limit(50);
      res.json(
        orders.map(o => ({
          id: o.orderId,
          service: o.service,
          customer: o.customer,
          amount: o.amount,
          status: o.status,
          date: o.date,
          createdAt: o.createdAt
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:phone', requireAuth, requirePermission('customers:write'), validateBody(customerUpdateSchema), async (req, res, next) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      const updated = await Customer.findOneAndUpdate(
        { tenantId: req.tenantId, phone },
        { $set: req.body },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Customer not found' });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createCustomersRouter };
