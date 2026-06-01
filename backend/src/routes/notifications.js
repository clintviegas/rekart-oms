const { Notification } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { retryNotification, sendTestEmail } = require('../services/notify');
const { listAudit } = require('../services/audit');

function createNotificationsRouter() {
  const router = require('express').Router();

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const rows = await Notification.find({ tenantId: req.tenantId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json(
        rows.map(r => ({
          id: r._id,
          order_id: r.orderId,
          channel: r.channel,
          recipient: r.recipient,
          event_type: r.eventType,
          message: r.message,
          status: r.status,
          link: r.link,
          created_at: r.createdAt
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  router.get('/audit', requireAuth, async (req, res, next) => {
    try {
      const rows = await listAudit(req.tenantId, {
        entityType: req.query.entityType,
        entityId: req.query.entityId,
        limit: Math.min(200, Number(req.query.limit) || 50)
      });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post('/test-email', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
      const status = await sendTestEmail();
      res.json({ ok: true, status });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/retry', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
      const result = await retryNotification(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createNotificationsRouter };
