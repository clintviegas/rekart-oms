const {
  orderFromRow,
  sanitizeItems,
  validateOrderInput,
  deviceSummary,
  makeOrderId,
  todayLabel,
  normalizeLocation,
  parsePagination
} = require('../utils/helpers');
const { Order } = require('../models');
const { logAudit } = require('../services/audit');
const { applyStockDelta, syncStockOnUpdate } = require('../services/inventory');
const { notifyWarehouse } = require('../services/notify');
const { upsertCustomerFromOrder } = require('../services/customers');
const { emitOrderEvent, checkUsageLimit, incrementOrderUsage } = require('../services/events');
const config = require('../config');
const { orderCreateSchema, orderPatchSchema, validateBody, validateQuery, paginationQuerySchema } = require('../validation/schemas');

function toApiOrder(doc) {
  const row = doc.toObject ? doc.toObject() : doc;
  return orderFromRow({
    id: row.orderId,
    service: row.service,
    customer: row.customer,
    phone: row.phone,
    device: row.device,
    serial_number: row.serial_number,
    amount: row.amount,
    payment: row.payment,
    agent: row.agent,
    location: row.location,
    status: row.status,
    date: row.date,
    notes: row.notes,
    extras: JSON.stringify(row.extras || {}),
    items: JSON.stringify(row.items || []),
    created_at: row.createdAt
  });
}

function buildFilter(tenantId, query) {
  const filter = { tenantId };
  if (query.service) filter.service = query.service;
  if (query.status) filter.status = query.status;
  if (query.location) filter.location = normalizeLocation(query.location);
  if (query.search) {
    const re = new RegExp(String(query.search).trim(), 'i');
    filter.$or = [
      { orderId: re },
      { customer: re },
      { phone: re },
      { device: re }
    ];
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  return filter;
}

function createOrdersRouter() {
  const router = require('express').Router();
  const { requireAuth, requirePermission } = require('../middleware/auth');

  router.get('/summary', requireAuth, requirePermission('orders:read'), async (req, res, next) => {
    try {
      const rows = await Order.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$service', count: { $sum: 1 } } }
      ]);
      const counts = {};
      let total = 0;
      rows.forEach(r => {
        counts[r._id] = r.count;
        total += r.count;
      });
      res.json({ total, counts });
    } catch (err) {
      next(err);
    }
  });

  router.get('/stats', requireAuth, requirePermission('orders:read'), async (req, res, next) => {
    try {
      const filter = buildFilter(req.tenantId, req.query);
      const orders = await Order.find(filter).lean();
      const total = orders.length;
      const revenue = orders.reduce((s, r) => s + Number(r.amount || 0), 0);
      const pending = orders.filter(r => r.status === 'Pending').length;
      const completed = orders.filter(r => r.status === 'Completed').length;
      const byService = {};
      const byPayment = {};
      orders.forEach(r => {
        if (!byService[r.service]) byService[r.service] = { count: 0, amount: 0 };
        byService[r.service].count += 1;
        byService[r.service].amount += Number(r.amount || 0);
        if (r.payment) {
          if (!byPayment[r.payment]) byPayment[r.payment] = { count: 0, total: 0 };
          byPayment[r.payment].count += 1;
          byPayment[r.payment].total += Number(r.amount || 0);
        }
      });
      res.json({ total, revenue, pending, completed, byService, byPayment });
    } catch (err) {
      next(err);
    }
  });

  router.get('/recent', requireAuth, requirePermission('orders:read'), async (req, res, next) => {
    try {
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
      const rows = await Order.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(limit);
      res.json(rows.map(toApiOrder));
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuth, requirePermission('orders:read'), validateQuery(paginationQuerySchema), async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query, {
        limit: config.DEFAULT_PAGE_SIZE,
        maxLimit: config.MAX_PAGE_SIZE
      });
      const filter = buildFilter(req.tenantId, req.query);
      const [total, rows] = await Promise.all([
        Order.countDocuments(filter),
        Order.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit)
      ]);
      res.json({
        data: rows.map(toApiOrder),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/invoice', requireAuth, requirePermission('orders:read'), async (req, res, next) => {
    try {
      const PDFDocument = require('pdfkit');
      const order = await Order.findOne({ tenantId: req.tenantId, orderId: req.params.id });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${order.orderId}-invoice.pdf"`);
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);
      doc.fontSize(20).text('Rekart OMS — Invoice', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Order ID: ${order.orderId}`);
      doc.text(`Customer: ${order.customer}`);
      doc.text(`Phone: ${order.phone || ''}`);
      doc.text(`Service: ${order.service}`);
      doc.text(`Date: ${order.date || ''}`);
      doc.moveDown();
      doc.text('Items:');
      (order.items || []).forEach(it => {
        doc.text(`• ${it.name} x${it.qty} — AED ${Number(it.price || 0).toLocaleString()}`);
      });
      doc.moveDown();
      doc.fontSize(14).text(`Total: AED ${Number(order.amount || 0).toLocaleString()}`, { align: 'right' });
      doc.end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, requirePermission('orders:write'), validateBody(orderCreateSchema), async (req, res, next) => {
    try {
      await checkUsageLimit(req.tenantId);
      const items = sanitizeItems(req.body.items);
      const computed = items.reduce((sum, it) => sum + it.qty * it.price, 0);
      const device = (req.body.device || '').trim() || deviceSummary(items);
      const orderPayload = {
        orderId: req.body.id || makeOrderId(),
        service: req.body.service || 'Buy',
        customer: (req.body.customer || '').trim(),
        phone: (req.body.phone || '').trim(),
        device,
        serial_number: (req.body.serial_number || req.body.serialNumber || '').trim(),
        amount:
          req.body.amount !== undefined && req.body.amount !== ''
            ? Number(req.body.amount) || 0
            : computed,
        payment: (req.body.payment || '').trim(),
        agent: (req.body.agent || '').trim(),
        location: normalizeLocation(req.body.location),
        status: req.body.status || 'Pending',
        date: req.body.date || todayLabel(),
        notes: req.body.notes || '',
        extras: req.body.extras || {},
        items
      };

      const validationError = validateOrderInput(
        { ...orderPayload, id: orderPayload.orderId },
        items,
        true
      );
      if (validationError) return res.status(400).json({ error: validationError });

      await applyStockDelta(req.tenantId, orderPayload.service, items, -1);
      const saved = await Order.create({ tenantId: req.tenantId, ...orderPayload });
      await incrementOrderUsage(req.tenantId);
      await upsertCustomerFromOrder(req.tenantId, orderPayload);
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'order',
        entityId: saved.orderId,
        action: 'created',
        userEmail: req.user.email,
        summary: `${saved.service} order for ${saved.customer}`
      });

      const apiOrder = toApiOrder(saved);
      res.status(201).json(apiOrder);
      emitOrderEvent(req.tenantId, 'order.created', apiOrder);
      notifyWarehouse(saved, 'order.created').catch(() => {});
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireAuth, requirePermission('orders:write'), validateBody(orderPatchSchema), async (req, res, next) => {
    try {
      const current = await Order.findOne({ tenantId: req.tenantId, orderId: req.params.id });
      if (!current) return res.status(404).json({ error: 'Order not found' });

      const items =
        req.body.items !== undefined ? sanitizeItems(req.body.items) : current.items || [];
      const computed = items.reduce((sum, it) => sum + it.qty * it.price, 0);
      const nextPayload = {
        service: req.body.service ?? current.service,
        customer: req.body.customer ?? current.customer,
        phone: req.body.phone ?? current.phone,
        device:
          req.body.device !== undefined
            ? String(req.body.device || '').trim()
            : deviceSummary(items, current.device) || current.device,
        serial_number:
          req.body.serial_number !== undefined
            ? String(req.body.serial_number || '').trim()
            : current.serial_number,
        amount:
          req.body.amount !== undefined && req.body.amount !== ''
            ? Number(req.body.amount) || 0
            : items.length
              ? computed
              : current.amount,
        payment: req.body.payment ?? current.payment,
        agent: req.body.agent ?? current.agent,
        location:
          req.body.location !== undefined
            ? normalizeLocation(req.body.location)
            : normalizeLocation(current.location),
        status: req.body.status ?? current.status,
        date: req.body.date ?? current.date,
        notes: req.body.notes ?? current.notes,
        extras: req.body.extras !== undefined ? req.body.extras : current.extras,
        items
      };

      const validationError = validateOrderInput(
        { ...nextPayload, id: current.orderId },
        items,
        req.body.items !== undefined
      );
      if (validationError) return res.status(400).json({ error: validationError });

      await syncStockOnUpdate(req.tenantId, current, nextPayload, items);
      Object.assign(current, nextPayload);
      await current.save();

      await logAudit({
        tenantId: req.tenantId,
        entityType: 'order',
        entityId: current.orderId,
        action: 'updated',
        userEmail: req.user.email,
        summary: `Order ${current.orderId} updated`
      });

      const apiOrder = toApiOrder(current);
      res.json(apiOrder);
      emitOrderEvent(req.tenantId, 'order.updated', apiOrder);
      notifyWarehouse(current, 'order.updated').catch(() => {});
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAuth, requirePermission('orders:write'), async (req, res, next) => {
    try {
      const current = await Order.findOne({ tenantId: req.tenantId, orderId: req.params.id });
      if (!current) return res.status(404).json({ error: 'Order not found' });

      await applyStockDelta(req.tenantId, current.service, current.items || [], +1);
      await Order.deleteOne({ _id: current._id });
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'order',
        entityId: current.orderId,
        action: 'deleted',
        userEmail: req.user.email,
        summary: `Order ${current.orderId} deleted`
      });

      res.json({ ok: true });
      emitOrderEvent(req.tenantId, 'order.deleted', { id: current.orderId });
      notifyWarehouse(current, 'order.deleted').catch(() => {});
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createOrdersRouter };
