const EventEmitter = require('events');
const { Tenant } = require('../models');
const config = require('../config');

const bus = new EventEmitter();
bus.setMaxListeners(100);

function emitOrderEvent(tenantId, type, payload) {
  bus.emit('order', { tenantId, type, payload, at: new Date().toISOString() });
}

function subscribeClient(tenantId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(': connected\n\n');

  const handler = event => {
    if (event.tenantId !== tenantId) return;
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
  };

  bus.on('order', handler);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  reqOnClose(res, () => {
    bus.off('order', handler);
    clearInterval(ping);
  });
}

function reqOnClose(res, fn) {
  res.on('close', fn);
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function checkUsageLimit(tenantId) {
  const tenant = await Tenant.findOne({ slug: tenantId });
  if (!tenant) return { ok: true };
  const plan = tenant.plan || 'free';
  const limits = config.PLAN_LIMITS[plan] || config.PLAN_LIMITS.free;
  const monthKey = currentMonthKey();
  if (tenant.usage?.monthKey !== monthKey) {
    tenant.usage = { ordersThisMonth: 0, monthKey };
    await tenant.save();
  }
  if ((tenant.usage?.ordersThisMonth || 0) >= limits.ordersPerMonth) {
    const err = new Error(`Plan limit reached (${limits.ordersPerMonth} orders/month). Upgrade to continue.`);
    err.status = 402;
    throw err;
  }
  return { ok: true, limits };
}

async function incrementOrderUsage(tenantId) {
  const monthKey = currentMonthKey();
  await Tenant.findOneAndUpdate(
    { slug: tenantId },
    {
      $set: { 'usage.monthKey': monthKey },
      $inc: { 'usage.ordersThisMonth': 1 }
    }
  );
}

module.exports = {
  emitOrderEvent,
  subscribeClient,
  checkUsageLimit,
  incrementOrderUsage
};
