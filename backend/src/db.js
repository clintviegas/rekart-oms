const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('./config');
const {
  Tenant,
  User,
  Agent,
  Product,
  AppSetting
} = require('./models');

function loadPricelist() {
  const candidates = [
    path.join(__dirname, '..', 'seed', 'pricelist.json'),
    path.join(config.DATA_DIR, 'pricelist.json')
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      /* skip */
    }
  }
  return [];
}

async function seedDefaults() {
  const tenantSlug = config.DEFAULT_TENANT_SLUG;
  let tenant = await Tenant.findOne({ slug: tenantSlug });
  if (!tenant) {
    tenant = await Tenant.create({
      slug: tenantSlug,
      name: 'Scalify / Rekart',
      plan: 'pro'
    });
    console.log(`[seed] tenant → ${tenantSlug}`);
  }

  const userCount = await User.countDocuments({ tenantId: tenantSlug });
  if (config.STAFF_LOGIN_EMAIL && config.STAFF_LOGIN_PASSWORD) {
    const email = config.STAFF_LOGIN_EMAIL.toLowerCase();
    await User.findOneAndUpdate(
      { tenantId: tenantSlug, email },
      {
        tenantId: tenantSlug,
        email,
        passwordHash: bcrypt.hashSync(config.STAFF_LOGIN_PASSWORD, 10),
        name: 'Sales Team',
        role: 'admin',
        totpEnabled: false,
        totpSecret: ''
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    if (userCount === 0) console.log(`[seed] admin user → ${email}`);
  }

  const agentCount = await Agent.countDocuments({ tenantId: tenantSlug });
  if (agentCount === 0) {
    await Agent.insertMany([
      { tenantId: tenantSlug, name: 'Bishal' },
      { tenantId: tenantSlug, name: 'Lena' }
    ]);
  }

  const productCount = await Product.countDocuments({ tenantId: tenantSlug });
  if (productCount === 0) {
    const pricelist = loadPricelist();
    if (pricelist.length) {
      await Product.insertMany(
        pricelist.map(item => ({
          tenantId: tenantSlug,
          sku: String(item.sku).toUpperCase(),
          name: item.name,
          brand: item.brand,
          category: item.category,
          stock: item.stock,
          price: item.price,
          location: String(item.location || '').toLowerCase().includes('sharjah')
            ? 'Sharjah WH'
            : 'Dubai',
          status: item.status || 'Available'
        }))
      );
      console.log(`[seed] imported ${pricelist.length} products`);
    }
  }

  const defaults = {
    default_location: 'Dubai',
    warehouse_location: 'Sharjah WH',
    low_stock_threshold: '2'
  };
  for (const [key, value] of Object.entries(defaults)) {
    await AppSetting.findOneAndUpdate(
      { tenantId: tenantSlug, key },
      { tenantId: tenantSlug, key, value },
      { upsert: true }
    );
  }
}

async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 15000
  });
  await seedDefaults();
  return mongoose.connection;
}

async function disconnectDb() {
  await mongoose.disconnect();
}

async function healthCheck() {
  if (mongoose.connection.readyState !== 1) return false;
  await mongoose.connection.db.admin().ping();
  return true;
}

module.exports = { connectDb, disconnectDb, healthCheck, seedDefaults };
