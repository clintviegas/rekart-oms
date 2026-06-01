const { Agent } = require('../models');
const { logAudit } = require('../services/audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { agentSchema, validateBody } = require('../validation/schemas');

function createAgentsRouter() {
  const router = require('express').Router();

  router.get('/', requireAuth, requirePermission('orders:read'), async (req, res, next) => {
    try {
      const rows = await Agent.find({ tenantId: req.tenantId }).sort({ name: 1 });
      res.json(rows.map(r => r.name));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, requirePermission('orders:write'), validateBody(agentSchema), async (req, res, next) => {
    try {
      const name = req.body.name.trim();
      await Agent.create({ tenantId: req.tenantId, name });
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'agent',
        entityId: name,
        action: 'created',
        userEmail: req.user.email,
        summary: `Agent ${name} added`
      });
      res.status(201).json({ ok: true, name });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Agent already exists' });
      next(err);
    }
  });

  router.delete('/:name', requireAuth, requirePermission('orders:write'), async (req, res, next) => {
    try {
      const name = decodeURIComponent(req.params.name);
      await Agent.deleteOne({ tenantId: req.tenantId, name });
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'agent',
        entityId: name,
        action: 'deleted',
        userEmail: req.user.email,
        summary: `Agent ${name} removed`
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAgentsRouter };
