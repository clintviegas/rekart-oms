const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.REFRESH_SECRET = 'test-refresh-secret-for-ci-only';
process.env.CSRF_SECRET = 'test-csrf-secret';
process.env.STAFF_LOGIN_EMAIL = 'sales@scalify.ae';
process.env.STAFF_LOGIN_PASSWORD = 'TestPass@2026';
process.env.WEB_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');

let mongo;
let app;
let agent;
let csrfToken;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();

  const { getApp } = require('../server');
  app = await getApp();

  agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: 'sales@scalify.ae', password: 'TestPass@2026' });
  assert.equal(res.status, 200);
  csrfToken = res.body.csrfToken;
});

function withCsrf(req) {
  return req.set('X-CSRF-Token', csrfToken);
}

test('health check', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, 'mongodb');
});

test('login rejects bad password', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'sales@scalify.ae', password: 'wrong' });
  assert.equal(res.status, 401);
});

test('orders require auth', async () => {
  const res = await request(app).get('/api/orders');
  assert.equal(res.status, 401);
});

test('create order and paginate', async () => {
  const create = await withCsrf(agent.post('/api/orders')).send({
    service: 'Repair',
    customer: 'Test Customer',
    phone: '+971500000001',
    device: 'Test Laptop',
    amount: 250,
    payment: 'Cash',
    agent: 'Bishal',
    location: 'Dubai',
    status: 'Pending',
    items: [{ name: 'Test Laptop', qty: 1, price: 250 }]
  });

  assert.equal(create.status, 201);
  assert.ok(create.body.id);

  const list = await agent.get('/api/orders?page=1&limit=10');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.data));
  assert.ok(list.body.pagination.total >= 1);
});

test('settings readable', async () => {
  const res = await agent.get('/api/settings');
  assert.equal(res.status, 200);
  assert.ok(res.body.settings);
});

after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
