require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const dns = require('dns');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Many container hosts (e.g. Railway) cannot reach Gmail SMTP over IPv6.
// Prefer IPv4 results so outbound mail connects reliably.
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_EMAIL_DOMAIN = 'scalify.ae';
const WAREHOUSE_WHATSAPP = '+971545192005';
const WAREHOUSE_EMAIL = process.env.WAREHOUSE_EMAIL || 'sales@scalify.ae';
const GOOGLE_AUTH_READY = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const ENABLE_GOOGLE_AUTH = process.env.ENABLE_GOOGLE_AUTH === 'true' && GOOGLE_AUTH_READY;
const STAFF_LOGIN_EMAIL = (process.env.STAFF_LOGIN_EMAIL || 'sales@scalify.ae').toLowerCase();
const STAFF_LOGIN_PASSWORD = process.env.STAFF_LOGIN_PASSWORD || 'Scalify@2026';

function normalizeLocation(location = '') {
  return String(location || '').toLowerCase().includes('sharjah') ? 'Sharjah WH' : 'Dubai';
}

function emailTransportConfig() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    family: 4,                 // force IPv4 — host network may not route IPv6
    connectionTimeout: 10000,  // fail fast instead of hanging the request
    greetingTimeout: 10000,
    socketTimeout: 15000
  };
}

const emailTransport = emailTransportConfig() ? nodemailer.createTransport(emailTransportConfig()) : null;

// Pricelist seeded from PRICELIST.xlsx on first boot.
// In dev: data/pricelist.json. In containers: /app/pricelist.json outside the persistent data volume.
function loadPricelist() {
  const candidates = [
    path.join(__dirname, 'pricelist.json'),
    path.join(__dirname, 'data', 'pricelist.json')
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (err) { console.warn(`[pricelist] parse failed for ${filePath}:`, err.message); }
  }
  return [];
}

/* ── Database setup ──────────────────────────────────────────────── */
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
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
    serial_number TEXT,
    amount   REAL DEFAULT 0,
    payment  TEXT,
    agent    TEXT,
    location TEXT,
    status   TEXT DEFAULT 'Pending',
    date     TEXT,
    notes    TEXT,
    extras   TEXT DEFAULT '{}',
    items    TEXT DEFAULT '[]',
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

    CREATE TABLE IF NOT EXISTS sessions (
      sid        TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      data       TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
`);

  class SqliteSessionStore extends session.Store {
    constructor(database) {
      super();
      this.db = database;
      this.getStmt = database.prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?');
      this.setStmt = database.prepare(`
        INSERT INTO sessions (sid, expires_at, data, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(sid) DO UPDATE SET expires_at=excluded.expires_at, data=excluded.data, updated_at=datetime('now')
      `);
      this.destroyStmt = database.prepare('DELETE FROM sessions WHERE sid = ?');
      this.pruneStmt = database.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    }

    get(sid, callback) {
      try {
        const row = this.getStmt.get(sid, Date.now());
        callback(null, row ? JSON.parse(row.data) : null);
      } catch (err) { callback(err); }
    }

    set(sid, sessionData, callback = () => {}) {
      try {
        const expiresAt = sessionData.cookie?.expires
          ? new Date(sessionData.cookie.expires).getTime()
          : Date.now() + 1000 * 60 * 60 * 12;
        this.setStmt.run(sid, expiresAt, JSON.stringify(sessionData));
        this.pruneStmt.run(Date.now());
        callback(null);
      } catch (err) { callback(err); }
    }

    destroy(sid, callback = () => {}) {
      try {
        this.destroyStmt.run(sid);
        callback(null);
      } catch (err) { callback(err); }
    }

    touch(sid, sessionData, callback = () => {}) {
      this.set(sid, sessionData, callback);
    }
  }

const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
if (!orderColumns.includes('serial_number')) {
  db.exec('ALTER TABLE orders ADD COLUMN serial_number TEXT');
}
if (!orderColumns.includes('items')) {
  db.exec("ALTER TABLE orders ADD COLUMN items TEXT DEFAULT '[]'");
}

// Normalize legacy locations to the current two-location operating model.
db.prepare("UPDATE orders SET location = 'Sharjah WH' WHERE lower(location) LIKE '%sharjah%'").run();
db.prepare("UPDATE orders SET location = 'Dubai' WHERE location IS NULL OR location = '' OR location <> 'Sharjah WH'").run();
db.prepare("UPDATE products SET location = 'Sharjah WH' WHERE lower(location) LIKE '%sharjah%'").run();
db.prepare("UPDATE products SET location = 'Dubai' WHERE location IS NULL OR location = '' OR location <> 'Sharjah WH'").run();

/* Seed default agents on first run */
const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM agents').get();
if (cnt === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO agents (name) VALUES (?)');
  ['Bishal', 'Lena'].forEach(n => insert.run(n));
}

/* Seed products from PRICELIST.xlsx → data/pricelist.json on first run */
const productCount = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;
if (productCount === 0) {
  const pricelist = loadPricelist();
  if (pricelist.length) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO products (sku, name, brand, category, stock, price, location, status)
      VALUES (@sku, @name, @brand, @category, @stock, @price, @location, @status)
    `);
    db.transaction(items => items.forEach(item => insert.run(item)))(pricelist);
    console.log(`[seed] imported ${pricelist.length} products from pricelist.json`);
  }
}

function orderFromRow(row) {
  let extras = {};
  let items = [];
  try { extras = row.extras ? JSON.parse(row.extras) : {}; } catch { extras = {}; }
  try { items  = row.items  ? JSON.parse(row.items)  : []; } catch { items  = []; }
  return { ...row, serial_number: row.serial_number || '', extras, items };
}

function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(it => ({
      sku:   String(it.sku || '').trim(),
      name:  String(it.name || '').trim(),
      brand: String(it.brand || '').trim(),
      qty:   Math.max(1, parseInt(it.qty, 10) || 1),
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
  if (items.some(item => !item.name || !item.qty || item.price < 0)) return 'Each item needs name, quantity, and price';
  if (order.amount === undefined || Number.isNaN(Number(order.amount)) || Number(order.amount) < 0) return 'Amount is required';
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

function isScalifyEmail(email = '') {
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

// Length-safe, constant-time string comparison to avoid login timing attacks.
function safeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  if (req.session?.staffUser || (req.isAuthenticated && req.isAuthenticated())) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in' });
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
  const safeMessage = String(message || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rekart OMS — Sign In</title>
<link rel="icon" type="image/svg+xml" href="/public/rekart-logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;font-family:'DM Sans',system-ui,-apple-system,sans-serif;color:#0d1f3c;background:#f6f8fc;display:grid;grid-template-columns:1fr 1fr;-webkit-font-smoothing:antialiased}
  .hero{background:linear-gradient(135deg,#0d1f3c 0%,#1a2f52 60%,#055ed7 140%);color:#fff;padding:48px 56px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
  .hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(103,164,241,.25),transparent 55%),radial-gradient(circle at 20% 90%,rgba(5,94,215,.35),transparent 50%);pointer-events:none}
  .hero-logo{position:relative;z-index:1}
  .hero-logo img{height:48px;width:auto;display:block;filter:brightness(0) invert(1);opacity:.95}
  .hero-copy{position:relative;z-index:1}
  .hero-eyebrow{font-size:12px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#67a4f1;margin-bottom:14px}
  .hero-title{font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-.6px;margin-bottom:14px;max-width:380px}
  .hero-sub{font-size:14px;line-height:1.6;color:rgba(255,255,255,.72);max-width:380px}
  .hero-meta{position:relative;z-index:1;display:flex;gap:24px;font-size:12px;color:rgba(255,255,255,.55)}
  .hero-meta span{display:flex;align-items:center;gap:6px}
  .hero-meta span::before{content:"";width:6px;height:6px;border-radius:50%;background:#67a4f1}
  .form-side{display:flex;align-items:center;justify-content:center;padding:48px}
  .card{width:100%;max-width:380px}
  .logo-mobile{display:none}
  .heading{font-size:24px;font-weight:700;letter-spacing:-.4px;margin-bottom:6px}
  .lede{font-size:13px;color:#5a6a85;margin-bottom:28px}
  .err{font-size:12px;line-height:1.5;margin-bottom:18px;color:#b83232;background:#fdf0f0;border:1px solid #f2caca;border-radius:10px;padding:11px 13px;display:flex;align-items:flex-start;gap:8px}
  .err svg{width:14px;height:14px;stroke:#b83232;flex-shrink:0;margin-top:1px}
  .field{margin-bottom:14px}
  .field label{display:block;font-size:11px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;color:#5a6a85;margin-bottom:6px}
  .field input{width:100%;height:44px;border:1.5px solid #e0e6f0;background:#f6f8fc;border-radius:10px;padding:0 14px;font-size:14px;color:#0d1f3c;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
  .field input::placeholder{color:#98a8be}
  .field input:focus{border-color:#055ed7;background:#fff;box-shadow:0 0 0 3px rgba(5,94,215,.12)}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border:0;border-radius:10px;background:#055ed7;color:#fff;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;letter-spacing:.2px;transition:background .15s,transform .1s}
  .btn:hover{background:#044bb5}
  .btn:active{transform:scale(.99)}
  .btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  .helper{font-size:11px;color:#98a8be;margin-top:22px;text-align:center;line-height:1.5}
  .helper a{color:#055ed7;text-decoration:none;font-weight:500}
  @media (max-width:880px){
    body{grid-template-columns:1fr}
    .hero{display:none}
    .logo-mobile{display:flex;justify-content:center;margin-bottom:32px}
    .logo-mobile img{height:42px;width:auto}
  }
</style>
</head>
<body>
  <aside class="hero">
    <div class="hero-logo"><img src="/public/rekart-logo.svg" alt="Rekart"></div>
    <div class="hero-copy">
      <div class="hero-eyebrow">Order Management</div>
      <div class="hero-title">Punch orders the moment they walk in.</div>
      <div class="hero-sub">Buy. Sell. Repair. Trade-in. Rent. Recycle. Insurance. One desk, every service line — synced live to the Sharjah warehouse.</div>
    </div>
    <div class="hero-meta">
      <span>Dubai HQ</span>
      <span>Sharjah Warehouse</span>
      <span>Field Visits</span>
    </div>
  </aside>
  <main class="form-side">
    <div class="card">
      <div class="logo-mobile"><img src="/public/rekart-logo.svg" alt="Rekart"></div>
      <h1 class="heading">Welcome back</h1>
      <p class="lede">Sign in to manage today's orders</p>
      ${safeMessage ? `<div class="err"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${safeMessage}</span></div>` : ''}
      <form method="post" action="/login" autocomplete="on" novalidate>
        <div class="field">
          <label for="email">Work Email</label>
          <input id="email" name="email" type="email" autocomplete="username" placeholder="you@scalify.ae" required autofocus>
        </div>
        <div class="field" style="margin-bottom:22px">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required>
        </div>
        <button class="btn" type="submit">
          Sign In
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>
      <div class="helper">Access restricted to <strong>@scalify.ae</strong> · Need help? <a href="mailto:clint.viegas@gmail.com">Contact admin</a></div>
    </div>
  </main>
</body>
</html>`;
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
  const serial = order.serial_number ? `Serial: ${order.serial_number}` : '';
  const location = order.location ? `Location: ${order.location}` : '';
  const phone = order.phone ? `Phone: ${order.phone}` : '';
  return `Rekart OMS ${eventType}\nOrder: ${order.id}\nService: ${order.service}\nCustomer: ${order.customer}\n${phone}\nDevice: ${order.device}\n${serial}\n${location}\n${status}\nAmount: AED ${Number(order.amount || 0).toLocaleString()}`;
}

function notificationSubject(eventType, order) {
  const label = eventType === 'order.created' ? 'New warehouse order' : eventType.replace('order.', 'Order ');
  return `Rekart OMS: ${label} ${order.id}`;
}

function notificationHtml(eventType, order) {
  const safe = value => String(value ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
  const rows = [
    ['Order', order.id],
    ['Event', eventType],
    ['Service', order.service],
    ['Customer', order.customer],
    ['Phone', order.phone],
    ['Device', order.device],
    ['Serial', order.serial_number],
    ['Location', order.location],
    ['Status', order.status],
    ['Amount', `AED ${Number(order.amount || 0).toLocaleString()}`],
    ['Agent', order.agent],
    ['Notes', order.notes]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  return `
    <div style="font-family:Arial,sans-serif;color:#10233f;line-height:1.45">
      <h2 style="margin:0 0 12px;font-size:18px">${safe(notificationSubject(eventType, order))}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:620px">
        ${rows.map(([label, value]) => `<tr><td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:150px">${safe(label)}</td><td style="padding:8px 10px;border:1px solid #e2e8f0">${safe(value)}</td></tr>`).join('')}
      </table>
      <p style="margin-top:14px;color:#52627a;font-size:12px">Sent automatically by Rekart OMS.</p>
    </div>`;
}

async function sendWarehouseEmail(eventType, order, message) {
  if (!emailTransport) return 'pending_config';
  try {
    await emailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: WAREHOUSE_EMAIL,
      subject: notificationSubject(eventType, order),
      text: message,
      html: notificationHtml(eventType, order)
    });
    return 'sent';
  } catch (err) {
    console.error('[email] warehouse alert failed:', err.message);
    return 'failed';
  }
}

async function notifyWarehouse(eventType, order) {
  const message = notificationMessage(eventType, order);
  const emailStatus = await sendWarehouseEmail(eventType, order, message);

  db.prepare(`
    INSERT INTO notifications (order_id, channel, recipient, event_type, message, status, link)
    VALUES (?, 'email', ?, ?, ?, ?, ?)
  `).run(order.id, WAREHOUSE_EMAIL, eventType, message, emailStatus, `mailto:${WAREHOUSE_EMAIL}`);

  const normalizedPhone = WAREHOUSE_WHATSAPP.replace(/\D/g, '');
  const link = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  let status = 'fallback_link';

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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust the Fly.io / reverse-proxy so secure cookies and req.protocol work behind TLS termination.
if (IS_PRODUCTION) app.set('trust proxy', 1);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new SqliteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'dev-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 12 // 12h
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Public assets (logo, favicon) — must be accessible before auth gate
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (ENABLE_GOOGLE_AUTH) {
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
app.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const emailOk = safeEqual(email, STAFF_LOGIN_EMAIL);
  const passwordOk = safeEqual(password, STAFF_LOGIN_PASSWORD);
  if (!emailOk || !passwordOk) {
    return res.redirect('/login?error=' + encodeURIComponent('Invalid email or password'));
  }
  req.session.staffUser = { id: email, email, name: 'Sales Team', photo: '' };
  res.redirect('/');
});
app.get('/auth/google', (req, res, next) => {
  if (!GOOGLE_AUTH_READY) return res.redirect('/login?error=' + encodeURIComponent('Google OAuth is not configured on this server.'));
  if (!ENABLE_GOOGLE_AUTH) return res.redirect('/login');
  passport.authenticate('google', { scope: ['profile', 'email'], hostedDomain: ALLOWED_EMAIL_DOMAIN })(req, res, next);
});
app.get('/auth/google/callback', (req, res, next) => {
  if (!ENABLE_GOOGLE_AUTH) return res.redirect('/login');
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
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/auth/me', (req, res) => {
  const user = req.session?.staffUser || req.user || null;
  res.json({ authenticated: Boolean(user), user, domain: ALLOWED_EMAIL_DOMAIN });
});

app.use(requireAuth);
// Serve ONLY the front-end shell and its assets. Never expose the project root
// (server.js, .env, package.json, data/rekart.db, etc.) over static hosting.
app.use('/src', express.static(path.join(__dirname, 'src'), { maxAge: '7d' }));
app.get('/rekart_oms_design_2.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'rekart_oms_design_2.html')));

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
  const items = sanitizeItems(req.body.items);
  const computed = items.reduce((sum, it) => sum + it.qty * it.price, 0);
  const device = (req.body.device || '').trim() || deviceSummary(items);
  const order = {
    id: req.body.id || makeOrderId(),
    service: req.body.service || 'Buy',
    customer: (req.body.customer || '').trim(),
    phone: (req.body.phone || '').trim(),
    device,
    serial_number: (req.body.serial_number || req.body.serialNumber || '').trim(),
    amount: req.body.amount !== undefined && req.body.amount !== '' ? Number(req.body.amount) || 0 : computed,
    payment: (req.body.payment || '').trim(),
    agent: (req.body.agent || '').trim(),
    location: normalizeLocation(req.body.location),
    status: req.body.status || 'Pending',
    date: req.body.date || todayLabel(),
    notes: req.body.notes || '',
    extras: JSON.stringify(req.body.extras || {}),
    items: JSON.stringify(items)
  };
  const validationError = validateOrderInput(order, items, true);
  if (validationError) return res.status(400).json({ error: validationError });
  db.prepare(`
    INSERT INTO orders (id, service, customer, phone, device, serial_number, amount, payment, agent, location, status, date, notes, extras, items)
    VALUES (@id, @service, @customer, @phone, @device, @serial_number, @amount, @payment, @agent, @location, @status, @date, @notes, @extras, @items)
  `).run(order);
  const saved = orderFromRow(order);
  res.status(201).json(saved);
  notifyWarehouse('order.created', saved).catch(err => console.error('[notify] order.created failed:', err.message));
});

app.patch('/api/orders/:id', async (req, res) => {
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Order not found' });
  const items = req.body.items !== undefined
    ? sanitizeItems(req.body.items)
    : (() => { try { return JSON.parse(current.items || '[]'); } catch { return []; } })();
  const computed = items.reduce((sum, it) => sum + it.qty * it.price, 0);
  const device = req.body.device !== undefined
    ? String(req.body.device || '').trim()
    : (deviceSummary(items, current.device) || current.device);
  const next = {
    ...current,
    ...req.body,
    device,
    serial_number: req.body.serial_number !== undefined ? String(req.body.serial_number || '').trim() : current.serial_number,
    amount: req.body.amount !== undefined && req.body.amount !== '' ? Number(req.body.amount) || 0 : (items.length ? computed : current.amount),
    location: req.body.location !== undefined ? normalizeLocation(req.body.location) : normalizeLocation(current.location),
    extras: JSON.stringify(req.body.extras !== undefined ? req.body.extras : JSON.parse(current.extras || '{}')),
    items: JSON.stringify(items)
  };
  const validationError = validateOrderInput(next, items, req.body.items !== undefined);
  if (validationError) return res.status(400).json({ error: validationError });
  db.prepare(`
    UPDATE orders SET service=@service, customer=@customer, phone=@phone, device=@device, serial_number=@serial_number,
      amount=@amount, payment=@payment, agent=@agent, location=@location, status=@status,
      date=@date, notes=@notes, extras=@extras, items=@items, updated_at=datetime('now')
    WHERE id=@id
  `).run(next);
  const saved = orderFromRow(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  res.json(saved);
  notifyWarehouse('order.updated', saved).catch(err => console.error('[notify] order.updated failed:', err.message));
});

app.delete('/api/orders/:id', async (req, res) => {
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
  if (current) notifyWarehouse('order.deleted', orderFromRow(current)).catch(err => console.error('[notify] order.deleted failed:', err.message));
});

/* ── Products API ────────────────────────────────────────────────── */
app.get('/api/products', (req, res) => {
  const q = (req.query.search || '').trim().toLowerCase();
  if (!q) return res.json(db.prepare('SELECT * FROM products ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, brand, name').all());
  const like = `%${q}%`;
  res.json(db.prepare(`
    SELECT * FROM products
    WHERE lower(sku) LIKE ? OR lower(name) LIKE ? OR lower(brand) LIKE ?
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, brand, name
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

/* ── Start ───────────────────────────────────────────────────────── */if (IS_PRODUCTION) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'dev-change-this-session-secret') {
    console.warn('[security] SESSION_SECRET is unset or default. Set a long random SESSION_SECRET in production.');
  }
  if (!process.env.STAFF_LOGIN_PASSWORD) {
    console.warn('[security] STAFF_LOGIN_PASSWORD is unset — using the built-in default. Set a strong password in production.');
  }
}
app.listen(PORT, () => {
  console.log(`\nRekart OMS  →  http://localhost:${PORT}/rekart_oms_design_2.html\n`);
  if (emailTransport) {
    emailTransport.verify()
      .then(() => console.log(`[email] SMTP ready — warehouse alerts will be sent to ${WAREHOUSE_EMAIL}`))
      .catch(err => console.error('[email] SMTP verify failed:', err.message));
  } else {
    console.warn('[email] SMTP not configured — set SMTP_HOST/SMTP_USER/SMTP_PASS to enable warehouse email alerts.');
  }
});
