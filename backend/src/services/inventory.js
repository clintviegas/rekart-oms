const { Product } = require('../models');

const STOCK_SERVICES = new Set(['Buy', 'Sell']);

function stockMultiplier(service, direction) {
  if (!STOCK_SERVICES.has(service)) return 0;
  if (service === 'Sell') return direction;
  if (service === 'Buy') return -direction;
  return 0;
}

function shouldAdjustStock(service, items) {
  return STOCK_SERVICES.has(service) && items.some(it => it.sku);
}

function stockMap(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.sku) continue;
    map.set(item.sku, (map.get(item.sku) || 0) + item.qty);
  }
  return map;
}

async function applyStockDelta(tenantId, service, items, direction) {
  const multiplier = stockMultiplier(service, direction);
  if (!multiplier || !shouldAdjustStock(service, items)) return { ok: true, adjusted: [] };

  const map = stockMap(items);
  const adjusted = [];
  const errors = [];

  for (const [sku, qty] of map.entries()) {
    const product = await Product.findOne({ tenantId, sku });
    if (!product) {
      errors.push(`SKU ${sku} not found in inventory`);
      continue;
    }
    const delta = qty * multiplier;
    const nextStock = Number(product.stock || 0) + delta;
    if (nextStock < 0) {
      errors.push(`Insufficient stock for ${product.name} (${sku}): have ${product.stock}, need ${qty}`);
      continue;
    }
    product.stock = nextStock;
    await product.save();
    adjusted.push({ sku, from: product.stock - delta, to: nextStock, delta });
  }

  if (errors.length) {
    const err = new Error(errors[0]);
    err.status = 400;
    err.details = errors;
    throw err;
  }

  return { ok: true, adjusted };
}

async function syncStockOnUpdate(tenantId, oldOrder, newOrder, newItems) {
  const oldItems = oldOrder.items || [];
  if (!shouldAdjustStock(oldOrder.service, oldItems)) {
    return applyStockDelta(tenantId, newOrder.service, newItems, -1);
  }
  await applyStockDelta(tenantId, oldOrder.service, oldItems, +1);
  return applyStockDelta(tenantId, newOrder.service, newItems, -1);
}

module.exports = { applyStockDelta, syncStockOnUpdate };
