const { Order, Product } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { dateRangeQuerySchema, validateQuery } = require('../validation/schemas');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

function createReportsRouter() {
  const router = require('express').Router();

  router.get('/summary', requireAuth, validateQuery(dateRangeQuerySchema), async (req, res, next) => {
    try {
      const filter = { tenantId: req.tenantId };
      if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
        if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
      }
      const orders = await Order.find(filter).lean();
      const revenue = orders.reduce((s, o) => s + Number(o.amount || 0), 0);
      const byService = {};
      orders.forEach(o => {
        if (!byService[o.service]) byService[o.service] = { count: 0, amount: 0 };
        byService[o.service].count += 1;
        byService[o.service].amount += Number(o.amount || 0);
      });
      res.json({
        totalOrders: orders.length,
        revenue,
        pending: orders.filter(o => o.status === 'Pending').length,
        completed: orders.filter(o => o.status === 'Completed').length,
        byService,
        from: req.query.from || null,
        to: req.query.to || null
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/payments/export', requireAuth, async (req, res, next) => {
    try {
      const orders = await Order.find({ tenantId: req.tenantId }).lean();
      const byPayment = {};
      orders.forEach(o => {
        if (!byPayment[o.payment]) byPayment[o.payment] = { count: 0, total: 0 };
        byPayment[o.payment].count += 1;
        byPayment[o.payment].total += Number(o.amount || 0);
      });
      const lines = ['Payment Mode,Orders,Total AED'];
      Object.entries(byPayment).forEach(([mode, row]) => {
        lines.push(`"${mode}",${row.count},${row.total}`);
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=payments-reconciliation.csv');
      res.send(lines.join('\n'));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function createBackupRouter() {
  const router = require('express').Router();

  router.post('/run', requireAuth, requireRole('admin'), async (req, res) => {
    if (!config.MONGODB_URI) return res.status(503).json({ error: 'MongoDB URI not configured' });
    const backupDir = path.join(config.DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = path.join(backupDir, `rekart-${stamp}`);

    execFile('mongodump', [`--uri=${config.MONGODB_URI}`, `--out=${out}`], err => {
      if (err) {
        return res.status(500).json({
          error: 'Backup failed — ensure mongodump is installed and MongoDB is running',
          details: err.message
        });
      }
      res.json({ ok: true, path: out });
    });
  });

  return router;
}

module.exports = { createReportsRouter, createBackupRouter };
