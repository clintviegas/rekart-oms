require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_EMAIL_DOMAIN = 'scalify.ae';
const WAREHOUSE_WHATSAPP = '+971545192005';
const GOOGLE_AUTH_READY = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const sampleOrders = [
  {id:'RKT-482A1C', service:'Repair', customer:'Arjun Mehta', phone:'+971 52 111 2233', device:'iPhone 14 Pro - Cracked Screen', amount:350, payment:'Cash', agent:'Bishal', location:'Dubai - HQ', status:'Processing', date:'19 May', notes:'Customer wants original Apple screen only', extras:{fault:'Front glass shattered', delivery:'2025-05-21', tech:'Bishal'}},
  {id:'RKT-39FF2B', service:'Buy', customer:'Fatima Al Rashidi', phone:'+971 55 987 6543', device:'Samsung Galaxy S23 256GB Phantom Black', amount:1200, payment:'Card (POS)', agent:'Lena', location:'Sharjah - Walk-in', status:'Completed', date:'19 May', notes:'', extras:{}},
  {id:'RKT-7A3D90', service:'Trade-In', customer:'Mohammed Khalid', phone:'+971 50 444 5566', device:'iPhone 12 Pro 128GB Silver', amount:650, payment:'Bank Transfer', agent:'Bishal', location:'Dubai - HQ', status:'Pending', date:'18 May', notes:'', extras:{grade:'B', quote:'650'}},
  {id:'RKT-C1B27E', service:'Sell', customer:'Vikram Nair', phone:'+971 56 321 7890', device:'MacBook Pro M2 14" 512GB', amount:3200, payment:'Bank Transfer', agent:'Lena', location:'India - Rohini', status:'Completed', date:'18 May', notes:'', extras:{}},
  {id:'RKT-55DE4A', service:'Recycle', customer:'Sarah Johnson', phone:'+971 54 222 3344', device:'3x Old Dell Laptops (mixed)', amount:0, payment:'Cash', agent:'Bishal', location:'Dubai - HQ', status:'Completed', date:'17 May', notes:'Certificate issued', extras:{weight:'3 units', cert:'Yes'}},
  {id:'RKT-88BC71', service:'Rent', customer:'Omar Farooq', phone:'+971 58 765 4321', device:'iPad Pro 11" M2 WiFi+Cell', amount:400, payment:'Card (POS)', agent:'Lena', location:'Sharjah - Walk-in', status:'Pending', date:'17 May', notes:'', extras:{period:'30 days', returnDate:'2025-06-18'}},
  {id:'RKT-24F19D', service:'Repair', customer:'Layla Hassan', phone:'+971 52 890 1234', device:'Samsung S22 Ultra - Battery Replacement', amount:180, payment:'Cash', agent:'Bishal', location:'Dubai - HQ', status:'Awaiting Parts', date:'16 May', notes:'Waiting for OEM battery from supplier', extras:{fault:'Battery draining fast', delivery:'2025-05-23', tech:'Lena'}}
];

const sampleProducts = [
  {sku:'RKT-IP14PM-256-SB', name:'iPhone 14 Pro Max 256GB', brand:'Apple', category:'Phone', stock:4, price:2850, location:'Dubai - HQ', status:'Available'},
  {sku:'RKT-S23-256-BLK', name:'Galaxy S23 256GB Phantom Black', brand:'Samsung', category:'Phone', stock:7, price:1450, location:'Sharjah - Walk-in', status:'Available'},
  {sku:'RKT-MBP-M2-512', name:'MacBook Pro M2 14 inch 512GB', brand:'Apple', category:'Laptop', stock:2, price:4200, location:'Dubai - HQ', status:'Low Stock'},
  {sku:'RKT-IPAD-M2-CELL', name:'iPad Pro 11 M2 WiFi + Cellular', brand:'Apple', category:'Tablet', stock:3, price:2100, location:'Dubai - HQ', status:'Available'},
  {sku:'RKT-S22U-BAT', name:'Samsung S22 Ultra Battery', brand:'Samsung', category:'Repair Part', stock:1, price:180, location:'Workshop', status:'Low Stock'}
];

/* ── Database setup ──────────────────────────────────────────────── */
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'rekart.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id       TEXT PRIMARY KEY,
    service  TEXT NOT NULL,
    customer TEXT NOT NULL,
    phone    TEXT,
    device   TEXT NOT NULL,
    amount   REAL DEFAULT 0,
    payment  TEXT,
    agent    TEXT,
    location TEXT,
    status   TEXT DEFAULT 'Pending',
    date     TEXT,
    notes    TEXT,
    extras   TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    sku      TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    brand    TEXT NOT NULL,
    category TEXT,
    stock    INTEGER DEFAULT 0,
    price    REAL DEFAULT 0,
    location TEXT,
    status   TEXT DEFAULT 'Available',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name       TEXT,
    photo      TEXT,
    last_login TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT,
    channel    TEXT NOT NULL,
    recipient  TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message    TEXT NOT NULL,
    status     TEXT NOT NULL,
    link       TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

/* Seed default agents on first run */
const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM agents').get();
if (cnt === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO agents (name) VALUES (?)');
  ['Bishal', 'Lena'].forEach(n => insert.run(n));
}

const orderCount = db.prepare('SELECT COUNT(*) AS cnt FROM orders').get().cnt;
if (orderCount === 0) {
  const insert = db.prepare(`
    INSERT INTO orders (id, service, customer, phone, device, amount, payment, agent, location, status, date, notes, extras)
    VALUES (@id, @service, @customer, @phone, @device, @amount, @payment, @agent, @location, @status, @date, @notes, @extras)
  `);
  sampleOrders.forEach(order => insert.run({ ...order, extras: JSON.stringify(order.extras || {}) }));
}

const productCount = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;
if (productCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products (sku, name, brand, category, stock, price, location, status)
    VALUES (@sku, @name, @brand, @category, @stock, @price, @location, @status)
  `);
  sampleProducts.forEach(product => insert.run(product));
}

function orderFromRow(row) {
  return { ...row, extras: row.extras ? JSON.parse(row.extras) : {} };
}

function makeOrderId() {
  return 'RKT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function todayLabel() {
  const now = new Date();
  return `${now.getDate()} ${now.toLocaleString('en', { month: 'short' })}`;
}

function isScalifyEmail(email = '') {
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Google sign-in required' });
  return res.redirect('/login');
}

function upsertUser(profile) {
  const email = profile.emails?.[0]?.value || '';
  const photo = profile.photos?.[0]?.value || '';
  db.prepare(`
    INSERT INTO users (id, email, name, photo, last_login)
    VALUES (@id, @email, @name, @photo, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET email=@email, name=@name, photo=@photo, last_login=datetime('now')
  `).run({ id: profile.id, email, name: profile.displayName || email, photo });
}

function loginPage(message = '') {
  const setup = GOOGLE_AUTH_READY ? '' : '<p class="hint">Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SESSION_SECRET, then restart the server.</p>';
  const devLogin = process.env.ALLOW_DEV_LOGIN === 'true' ? '<form method="post" action="/auth/dev" style="margin-top:12px"><input name="email" placeholder="you@scalify.ae" style="width:100%;height:38px;border:1px solid #d8e0ef;border-radius:9px;padding:0 10px;margin-bottom:8px"><button class="btn" type="submit" style="border:0">Local dev sign-in</button></form>' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rekart OMS Sign In</title><style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8fc;font-family:DM Sans,Arial,sans-serif;color:#0d1f3c}.card{width:min(420px,calc(100vw - 32px));background:white;border:1px solid rgba(13,31,60,.1);border-radius:16px;box-shadow:0 12px 32px rgba(13,31,60,.08);padding:28px}.mark{width:42px;height:42px;border-radius:10px;background:#055ed7;color:white;display:grid;place-items:center;font-weight:700;margin-bottom:16px}.title{font-size:22px;font-weight:700;margin-bottom:4px}.sub{font-size:13px;color:#5a6a85;margin-bottom:20px}.btn{display:flex;align-items:center;justify-content:center;width:100%;height:42px;border-radius:10px;background:#055ed7;color:white;text-decoration:none;font-weight:700;font-size:14px}.hint,.err{font-size:12px;line-height:1.5;margin-top:14px;color:#5a6a85}.err{color:#b83232;background:#fdf0f0;border:1px solid #f2caca;border-radius:8px;padding:10px}.domain{font-family:DM Mono,monospace;color:#055ed7}
  </style></head><body><main class="card"><div class="mark">R</div><div class="title">Sign in to Rekart OMS</div><div class="sub">Only <span class="domain">@${ALLOWED_EMAIL_DOMAIN}</span> Google accounts are allowed.</div>${message ? `<div class="err">${message}</div>` : ''}<a class="btn" href="/auth/google">Continue with Google</a>${devLogin}${setup}</main></body></html>`;
}

function productFromBody(body) {
  return {
    sku: (body.sku || '').trim().toUpperCase(),
    name: (body.name || '').trim(),
    brand: (body.brand || '').trim(),
    category: body.category || 'Device',
    stock: Number(body.stock) || 0,
    price: Number(body.price) || 0,
    location: body.location || 'Dubai - HQ',
    status: body.status || 'Available'
  };
}

function upsertProduct(product) {
  db.prepare(`
    INSERT INTO products (sku, name, brand, category, stock, price, location, status)
    VALUES (@sku, @name, @brand, @category, @stock, @price, @location, @status)
    ON CONFLICT(sku) DO UPDATE SET name=@name, brand=@brand, category=@category,
      stock=@stock, price=@price, location=@location, status=@status, updated_at=datetime('now')
  `).run(product);
}

function notificationMessage(eventType, order) {
  const status = order.status ? `Status: ${order.status}` : '';
  return `Rekart OMS ${eventType}\nOrder: ${order.id}\nService: ${order.service}\nCustomer: ${order.customer}\nDevice: ${order.device}\n${status}\nAmount: AED ${Number(order.amount || 0).toLocaleString()}`;
}

async function notifyWarehouse(eventType, order) {
  const message = notificationMessage(eventType, order);
  const normalizedPhone = WAREHOUSE_WHATSAPP.replace(/\D/g, '');
  const link = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  let status = 'pending_config';

  if (process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizedPhone, type: 'text', text: { body: message } })
      });
      status = response.ok ? 'sent' : 'failed';
    } catch { status = 'failed'; }
  }

  db.prepare(`
    INSERT INTO notifications (order_id, channel, recipient, event_type, message, status, link)
    VALUES (?, 'whatsapp', ?, ?, ?, ?, ?)
  `).run(order.id, WAREHOUSE_WHATSAPP, eventType, message, status, link);
}

/* ── Auth + Middleware ───────────────────────────────────────────── */
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (GOOGLE_AUTH_READY) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value || '';
    if (!isScalifyEmail(email)) return done(null, false, { message: `Only @${ALLOWED_EMAIL_DOMAIN} accounts can log in.` });
    upsertUser(profile);
    done(null, { id: profile.id, email, name: profile.displayName || email, photo: profile.photos?.[0]?.value || '' });
  }));
}

app.get('/login', (req, res) => res.send(loginPage(req.query.error || '')));
app.get('/auth/google', (req, res, next) => {
  if (!GOOGLE_AUTH_READY) return res.redirect('/login?error=' + encodeURIComponent('Google OAuth is not configured on this server.'));
  passport.authenticate('google', { scope: ['profile', 'email'], hostedDomain: ALLOWED_EMAIL_DOMAIN })(req, res, next);
});
app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.redirect('/login?error=' + encodeURIComponent(info?.message || `Only @${ALLOWED_EMAIL_DOMAIN} accounts can log in.`));
    req.logIn(user, loginErr => {
      if (loginErr) return next(loginErr);
      res.redirect('/');
    });
  })(req, res, next);
});
app.post('/auth/dev', (req, res) => {
  if (process.env.ALLOW_DEV_LOGIN !== 'true') return res.status(404).send('Not found');
  const email = (req.body.email || '').trim().toLowerCase();
  if (!isScalifyEmail(email)) return res.redirect('/login?error=' + encodeURIComponent(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can log in.`));
  req.logIn({ id: email, email, name: email.split('@')[0], photo: '' }, err => {
    if (err) return res.redirect('/login?error=' + encodeURIComponent('Could not sign in'));
    res.redirect('/');
  });
});
app.post('/logout', (req, res) => req.logout(() => res.json({ ok: true })));
app.get('/api/auth/me', (req, res) => res.json({ authenticated: Boolean(req.user), user: req.user || null, domain: ALLOWED_EMAIL_DOMAIN }));

app.use(requireAuth);
app.use(express.static(__dirname));   // serves HTML, src/styles, src/scripts, etc.

/* ── Agents API ──────────────────────────────────────────────────── */

// GET /api/agents  →  ["Bishal","Lena",...]
app.get('/api/agents', (req, res) => {
  const rows = db.prepare('SELECT name FROM agents ORDER BY name ASC').all();
  res.json(rows.map(r => r.name));
});

// POST /api/agents  body: { name }  →  adds a new agent
app.post('/api/agents', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    db.prepare('INSERT INTO agents (name) VALUES (?)').run(name);
    res.status(201).json({ ok: true, name });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Agent already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agents/:name  →  removes an agent
app.delete('/api/agents/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  db.prepare('DELETE FROM agents WHERE name = ? COLLATE NOCASE').run(name);
  res.json({ ok: true });
});

/* ── Orders API ──────────────────────────────────────────────────── */
app.get('/api/orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC, date DESC').all();
  res.json(rows.map(orderFromRow));
});

app.post('/api/orders', async (req, res) => {
  const order = {
    id: req.body.id || makeOrderId(),
    service: req.body.service || 'Buy',
    customer: (req.body.customer || '').trim(),
    phone: req.body.phone || '-',
    device: (req.body.device || '').trim(),
    amount: Number(req.body.amount) || 0,
    payment: req.body.payment || 'Pending',
    agent: req.body.agent || 'Walk-in',
    location: req.body.location || 'Dubai - HQ',
    status: req.body.status || 'Pending',
    date: req.body.date || todayLabel(),
    notes: req.body.notes || '',
    extras: JSON.stringify(req.body.extras || {})
  };
  if (!order.customer || !order.device) return res.status(400).json({ error: 'Customer and device are required' });
  db.prepare(`
    INSERT INTO orders (id, service, customer, phone, device, amount, payment, agent, location, status, date, notes, extras)
    VALUES (@id, @service, @customer, @phone, @device, @amount, @payment, @agent, @location, @status, @date, @notes, @extras)
  `).run(order);
  const saved = orderFromRow(order);
  await notifyWarehouse('order.created', saved);
  res.status(201).json(saved);
});

app.patch('/api/orders/:id', async (req, res) => {
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Order not found' });
  const next = {
    ...current,
    ...req.body,
    amount: req.body.amount !== undefined ? Number(req.body.amount) || 0 : current.amount,
    extras: JSON.stringify(req.body.extras !== undefined ? req.body.extras : JSON.parse(current.extras || '{}'))
  };
  db.prepare(`
    UPDATE orders SET service=@service, customer=@customer, phone=@phone, device=@device,
      amount=@amount, payment=@payment, agent=@agent, location=@location, status=@status,
      date=@date, notes=@notes, extras=@extras, updated_at=datetime('now')
    WHERE id=@id
  `).run(next);
  const saved = orderFromRow(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  await notifyWarehouse('order.updated', saved);
  res.json(saved);
});

app.delete('/api/orders/:id', async (req, res) => {
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  if (current) await notifyWarehouse('order.deleted', orderFromRow(current));
  res.json({ ok: true });
});

/* ── Products API ────────────────────────────────────────────────── */
app.get('/api/products', (req, res) => {
  const q = (req.query.search || '').trim().toLowerCase();
  if (!q) return res.json(db.prepare('SELECT * FROM products ORDER BY brand, name').all());
  const like = `%${q}%`;
  res.json(db.prepare(`
    SELECT * FROM products
    WHERE lower(sku) LIKE ? OR lower(name) LIKE ? OR lower(brand) LIKE ?
    ORDER BY brand, name
  `).all(like, like, like));
});

app.post('/api/products', (req, res) => {
  const product = productFromBody(req.body);
  if (!product.sku || !product.name || !product.brand) return res.status(400).json({ error: 'SKU, name, and brand are required' });
  try {
    db.prepare(`
      INSERT INTO products (sku, name, brand, category, stock, price, location, status)
      VALUES (@sku, @name, @brand, @category, @stock, @price, @location, @status)
    `).run(product);
    res.status(201).json(product);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return res.status(409).json({ error: 'SKU already exists' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products/import', (req, res) => {
  const rows = Array.isArray(req.body.products) ? req.body.products : [];
  if (!rows.length) return res.status(400).json({ error: 'No products supplied' });
  const tx = db.transaction(products => {
    let imported = 0;
    const skipped = [];
    products.forEach((row, index) => {
      const product = productFromBody(row);
      if (!product.sku || !product.name || !product.brand) {
        skipped.push({ row: index + 1, reason: 'SKU, name, and brand are required' });
        return;
      }
      upsertProduct(product);
      imported += 1;
    });
    return { imported, skipped };
  });
  res.json(tx(rows));
});

app.patch('/api/products/:sku', (req, res) => {
  const current = db.prepare('SELECT * FROM products WHERE sku = ?').get(req.params.sku);
  if (!current) return res.status(404).json({ error: 'Product not found' });
  const next = {
    ...current,
    ...req.body,
    sku: current.sku,
    stock: req.body.stock !== undefined ? Number(req.body.stock) || 0 : current.stock,
    price: req.body.price !== undefined ? Number(req.body.price) || 0 : current.price
  };
  db.prepare(`
    UPDATE products SET name=@name, brand=@brand, category=@category, stock=@stock,
      price=@price, location=@location, status=@status, updated_at=datetime('now')
    WHERE sku=@sku
  `).run(next);
  res.json(db.prepare('SELECT * FROM products WHERE sku = ?').get(req.params.sku));
});

app.delete('/api/products/:sku', (req, res) => {
  db.prepare('DELETE FROM products WHERE sku = ?').run(req.params.sku);
  res.json({ ok: true });
});

/* ── Notifications API ───────────────────────────────────────────── */
app.get('/api/notifications', (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT 100').all());
});

/* ── Root redirect ───────────────────────────────────────────────── */
app.get('/', (req, res) => res.redirect('/rekart_oms_design_2.html'));

/* ── Start ───────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\nRekart OMS  →  http://localhost:${PORT}/rekart_oms_design_2.html\n`);
});
