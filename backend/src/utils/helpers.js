const crypto = require('crypto');

function normalizeLocation(location = '') {
  return String(location || '').toLowerCase().includes('sharjah') ? 'Sharjah WH' : 'Dubai';
}

function safeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function orderFromRow(row) {
  let extras = {};
  let items = [];
  try {
    extras = row.extras ? JSON.parse(row.extras) : {};
  } catch {
    extras = {};
  }
  try {
    items = row.items ? JSON.parse(row.items) : [];
  } catch {
    items = [];
  }
  return { ...row, serial_number: row.serial_number || '', extras, items };
}

function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(it => ({
      sku: String(it.sku || '').trim(),
      name: String(it.name || '').trim(),
      brand: String(it.brand || '').trim(),
      qty: Math.max(1, parseInt(it.qty, 10) || 1),
      price: Math.max(0, parseFloat(it.price) || 0)
    }))
    .filter(it => it.name);
}

function validateOrderInput(order, items, requireItems = true) {
  const required = [
    ['service', 'Service is required'],
    ['customer', 'Customer name is required'],
    ['phone', 'Phone is required'],
    ['device', 'Device/item is required'],
    ['payment', 'Payment mode is required'],
    ['agent', 'Handled by is required'],
    ['location', 'Location is required'],
    ['status', 'Status is required']
  ];
  for (const [field, message] of required) {
    if (!String(order[field] || '').trim()) return message;
  }
  if (requireItems && !items.length) return 'At least one device/item is required';
  if (items.some(item => !item.name || !item.qty || item.price < 0)) {
    return 'Each item needs name, quantity, and price';
  }
  if (order.amount === undefined || Number.isNaN(Number(order.amount)) || Number(order.amount) < 0) {
    return 'Amount is required';
  }
  return '';
}

function deviceSummary(items, fallback) {
  if (!items?.length) return fallback || '';
  const head = items[0];
  const headLabel = head.qty > 1 ? `${head.qty}× ${head.name}` : head.name;
  return items.length === 1 ? headLabel : `${headLabel} +${items.length - 1} more`;
}

function makeOrderId() {
  return 'RKT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function todayLabel() {
  const now = new Date();
  return `${now.getDate()} ${now.toLocaleString('en', { month: 'short' })}`;
}

function productFromBody(body) {
  return {
    sku: (body.sku || '').trim().toUpperCase(),
    name: (body.name || '').trim(),
    brand: (body.brand || '').trim(),
    category: body.category || 'Device',
    stock: Number(body.stock) || 0,
    price: Number(body.price) || 0,
    location: normalizeLocation(body.location),
    status: body.status || 'Available'
  };
}

function parsePagination(query, defaults = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page || 1);
  const limit = Math.min(
    defaults.maxLimit || 100,
    Math.max(1, parseInt(query.limit, 10) || defaults.limit || 50)
  );
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
  normalizeLocation,
  safeEqual,
  orderFromRow,
  sanitizeItems,
  validateOrderInput,
  deviceSummary,
  makeOrderId,
  todayLabel,
  productFromBody,
  parsePagination
};
