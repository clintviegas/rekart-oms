const { Product } = require('../models');
const { logAudit } = require('../services/audit');
const { productFromBody, normalizeLocation, parsePagination } = require('../utils/helpers');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { productSchema, productImportSchema, validateBody, validateQuery, paginationQuerySchema } = require('../validation/schemas');
const config = require('../config');

function createProductsRouter() {
  const router = require('express').Router();

  router.get('/', requireAuth, requirePermission('products:read'), validateQuery(paginationQuerySchema), async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query, {
        limit: config.DEFAULT_PAGE_SIZE,
        maxLimit: config.MAX_PAGE_SIZE
      });
      const filter = { tenantId: req.tenantId };
      const q = (req.query.search || '').trim();
      if (q) {
        const re = new RegExp(q, 'i');
        filter.$or = [{ sku: re }, { name: re }, { brand: re }];
      }
      const [total, rows] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).sort({ updatedAt: -1, brand: 1, name: 1 }).skip(offset).limit(limit)
      ]);
      res.json({
        data: rows,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/all', requireAuth, requirePermission('products:read'), async (req, res, next) => {
    try {
      const rows = await Product.find({ tenantId: req.tenantId }).sort({ updatedAt: -1, brand: 1, name: 1 });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, requirePermission('products:write'), validateBody(productSchema), async (req, res, next) => {
    try {
      const product = productFromBody(req.body);
      product.tenantId = req.tenantId;
      const created = await Product.create(product);
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'product',
        entityId: created.sku,
        action: 'created',
        userEmail: req.user.email,
        summary: `Product ${created.sku} created`
      });
      res.status(201).json(created);
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'SKU already exists' });
      next(err);
    }
  });

  router.post('/import', requireAuth, requirePermission('products:write'), validateBody(productImportSchema), async (req, res, next) => {
    try {
      const rows = req.body.products;
      let imported = 0;
      const skipped = [];
      for (let i = 0; i < rows.length; i += 1) {
        const product = productFromBody(rows[i]);
        if (!product.sku || !product.name || !product.brand) {
          skipped.push({ row: i + 1, reason: 'SKU, name, and brand are required' });
          continue;
        }
        await Product.findOneAndUpdate(
          { tenantId: req.tenantId, sku: product.sku },
          { ...product, tenantId: req.tenantId },
          { upsert: true, new: true }
        );
        imported += 1;
      }
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'product',
        entityId: 'import',
        action: 'imported',
        userEmail: req.user.email,
        summary: `${imported} products imported`
      });
      res.json({ imported, skipped });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:sku', requireAuth, requirePermission('products:write'), validateBody(productSchema.partial()), async (req, res, next) => {
    try {
      const current = await Product.findOne({ tenantId: req.tenantId, sku: req.params.sku.toUpperCase() });
      if (!current) return res.status(404).json({ error: 'Product not found' });
      if (req.body.name !== undefined) current.name = req.body.name;
      if (req.body.brand !== undefined) current.brand = req.body.brand;
      if (req.body.category !== undefined) current.category = req.body.category;
      if (req.body.stock !== undefined) current.stock = Number(req.body.stock) || 0;
      if (req.body.price !== undefined) current.price = Number(req.body.price) || 0;
      if (req.body.location !== undefined) current.location = normalizeLocation(req.body.location);
      if (req.body.status !== undefined) current.status = req.body.status;
      await current.save();
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'product',
        entityId: current.sku,
        action: 'updated',
        userEmail: req.user.email,
        summary: `Product ${current.sku} updated`
      });
      res.json(current);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:sku', requireAuth, requirePermission('products:write'), async (req, res, next) => {
    try {
      await Product.deleteOne({ tenantId: req.tenantId, sku: req.params.sku.toUpperCase() });
      await logAudit({
        tenantId: req.tenantId,
        entityType: 'product',
        entityId: req.params.sku,
        action: 'deleted',
        userEmail: req.user.email,
        summary: `Product ${req.params.sku} deleted`
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createProductsRouter };
