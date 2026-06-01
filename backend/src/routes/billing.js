const config = require('../config');
const { Tenant } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

function createBillingRouter() {
  const router = require('express').Router();

  router.get('/plan', requireAuth, async (req, res, next) => {
    try {
      const tenant = await Tenant.findOne({ slug: req.tenantId }).lean();
      const plan = tenant?.plan || 'free';
      res.json({
        plan,
        limits: config.PLAN_LIMITS[plan],
        usage: tenant?.usage || { ordersThisMonth: 0 },
        stripeConfigured: Boolean(config.STRIPE_SECRET_KEY)
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/checkout', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
      if (!config.STRIPE_SECRET_KEY || !config.STRIPE_PRICE_ID) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }
      const Stripe = require('stripe');
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      const tenant = await Tenant.findOne({ slug: req.tenantId });
      const sessionParams = {
        mode: 'subscription',
        line_items: [{ price: config.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${config.WEB_ORIGIN}/settings?billing=success`,
        cancel_url: `${config.WEB_ORIGIN}/settings?billing=cancel`,
        metadata: { tenantId: req.tenantId }
      };
      if (tenant?.stripeCustomerId) {
        sessionParams.customer = tenant.stripeCustomerId;
      } else {
        sessionParams.customer_email = req.user.email;
      }
      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  });

  router.post('/portal', requireAuth, requireRole('admin'), async (req, res, next) => {
    try {
      if (!config.STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }
      const Stripe = require('stripe');
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      const tenant = await Tenant.findOne({ slug: req.tenantId });
      if (!tenant?.stripeCustomerId) {
        return res.status(400).json({ error: 'No Stripe customer — upgrade first' });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${config.WEB_ORIGIN}/settings`
      });
      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function stripeWebhook(req, res) {
  if (!config.STRIPE_WEBHOOK_SECRET || !config.STRIPE_SECRET_KEY) {
    return res.status(503).send('Webhook not configured');
  }
  const Stripe = require('stripe');
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const tenantId = event.data.object.metadata?.tenantId || config.DEFAULT_TENANT_SLUG;
      await Tenant.findOneAndUpdate(
        { slug: tenantId },
        { plan: 'pro', stripeCustomerId: event.data.object.customer }
      );
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

module.exports = { createBillingRouter, stripeWebhook };
