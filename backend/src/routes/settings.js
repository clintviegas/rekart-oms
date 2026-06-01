const { AppSetting, Agent, Product, Tenant } = require('../models');
const { logAudit } = require('../services/audit');
const { requireAuth, requireRole } = require('../middleware/auth');
const { settingsPatchSchema, brandingPatchSchema, validateBody } = require('../validation/schemas');

function createSettingsRouter() {
  const router = require('express').Router();

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const rows = await AppSetting.find({ tenantId: req.tenantId }).sort({ key: 1 });
      const settings = {};
      rows.forEach(r => {
        settings[r.key] = r.value;
      });
      const [agents, products, tenant] = await Promise.all([
        Agent.countDocuments({ tenantId: req.tenantId }),
        Product.countDocuments({ tenantId: req.tenantId }),
        Tenant.findOne({ slug: req.tenantId }).lean()
      ]);
      res.json({
        settings,
        stats: { agents, products },
        tenant: tenant
          ? { plan: tenant.plan, usage: tenant.usage, branding: tenant.branding, name: tenant.name }
          : null
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/', requireAuth, requireRole('admin'), validateBody(settingsPatchSchema), async (req, res, next) => {
    try {
      const allowed = ['default_location', 'warehouse_location', 'low_stock_threshold'];
      const updates = req.body.settings || req.body;
      for (const [key, value] of Object.entries(updates)) {
        if (!allowed.includes(key)) continue;
        await AppSetting.findOneAndUpdate(
          { tenantId: req.tenantId, key },
          { tenantId: req.tenantId, key, value: String(value) },
          { upsert: true }
        );
      }
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'settings',
        entityId: 'app',
        action: 'updated',
        userEmail: req.user.email,
        summary: 'App settings updated',
        payload: updates
      });
      const rows = await AppSetting.find({ tenantId: req.tenantId });
      const settings = {};
      rows.forEach(r => {
        settings[r.key] = r.value;
      });
      res.json({ settings });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/branding', requireAuth, requireRole('admin'), validateBody(brandingPatchSchema), async (req, res, next) => {
    try {
      const tenant = await Tenant.findOne({ slug: req.tenantId });
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      if (req.body.logoUrl !== undefined) tenant.branding.logoUrl = req.body.logoUrl;
      if (req.body.primaryColor !== undefined) tenant.branding.primaryColor = req.body.primaryColor;
      await tenant.save();
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'tenant',
        entityId: req.tenantId,
        action: 'branding_updated',
        userEmail: req.user.email,
        summary: 'Tenant branding updated',
        payload: req.body
      });
      res.json({ branding: tenant.branding });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createSettingsRouter };
