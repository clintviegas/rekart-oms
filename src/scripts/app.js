let currentViewIdx = null;
let activeService = 'Buy';
let orders = [];
let products = [];
let agents = [];
let notifications = [];
let currentUser = null;
let staffModalControlsBound = false;

const dashboardTemplate = document.querySelector('.main').innerHTML;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

async function loadAgents() { agents = await api('/api/agents'); }
async function loadOrders() { orders = await api('/api/orders'); }
async function loadProducts(search = '') { products = await api('/api/products' + (search ? '?search=' + encodeURIComponent(search) : '')); }
async function loadNotifications() { notifications = await api('/api/notifications'); }
async function loadCurrentUser() { currentUser = (await api('/api/auth/me')).user; }

function updateUserChrome() {
  const avatar = document.querySelector('.avatar');
  if (!avatar || !currentUser) return;
  avatar.textContent = (currentUser.name || currentUser.email || 'U').slice(0, 2).toUpperCase();
  avatar.title = currentUser.email;
  avatar.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    location.href = '/login';
  });
}

function setActiveNav(label) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.textContent.trim() === label));
}

function getSidebarLabel(item) {
  const clone = item.cloneNode(true);
  clone.querySelectorAll('svg,.sidebar-count').forEach(el => el.remove());
  return clone.textContent.trim();
}

function renderAgentSelect(selectValue) {
  const sel = document.getElementById('agent-select');
  if (!sel) return;
  const cur = selectValue !== undefined ? selectValue : sel.value;
  sel.innerHTML = '<option value="">Select agent...</option>' +
    agents.map(a => `<option value="${escapeHtml(a)}"${a === cur ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('');
}

function renderStaffList() {
  const ul = document.getElementById('staffList');
  if (!ul) return;
  if (!agents.length) {
    ul.innerHTML = '<li class="staff-empty">No staff added yet</li>';
    return;
  }
  ul.innerHTML = agents.map(a => `
    <li class="staff-list-item">
      <span>${escapeHtml(a)}</span>
      <button class="staff-del-btn" data-name="${escapeHtml(a)}" title="Remove ${escapeHtml(a)}">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </li>`).join('');
  ul.querySelectorAll('.staff-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      await api('/api/agents/' + encodeURIComponent(name), { method: 'DELETE' });
      await loadAgents();
      renderAgentSelect();
      renderStaffList();
      showToast(name + ' removed');
    });
  });
}

function bindStaffModal() {
  document.getElementById('add-agent-btn')?.addEventListener('click', () => {
    renderStaffList();
    document.getElementById('newAgentInput').value = '';
    document.getElementById('staffModal').style.display = 'flex';
  });
  if (staffModalControlsBound) return;
  staffModalControlsBound = true;
  document.getElementById('staffModalClose')?.addEventListener('click', () => {
    document.getElementById('staffModal').style.display = 'none';
  });
  document.getElementById('staffModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });
  document.getElementById('confirmAddAgent')?.addEventListener('click', async () => {
    const input = document.getElementById('newAgentInput');
    const name = input.value.trim();
    if (!name) return;
    try {
      await api('/api/agents', { method: 'POST', body: JSON.stringify({ name }) });
      await loadAgents();
      renderAgentSelect(name);
      renderStaffList();
      input.value = '';
      showToast(name + ' added');
    } catch (e) { showToast(e.message); }
  });
  document.getElementById('newAgentInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmAddAgent').click();
  });
}

function svcBadgeClass(svc) {
  return { Buy:'svc-Buy', Sell:'svc-Sell', Repair:'svc-Repair', 'Trade-In':'svc-TradeIn', Insurance:'svc-Insurance', Rent:'svc-Rent', Recycle:'svc-Recycle' }[svc] || 'svc-Buy';
}

function renderCondFields(svc) {
  const condFields = document.querySelector('.cond-fields');
  if (!condFields) return;
  const extras = SVC_EXTRAS[svc];
  if (!extras) { condFields.style.display = 'none'; condFields.innerHTML = ''; return; }
  condFields.style.display = 'block';
  condFields.innerHTML = `
    <div class="cond-label">${escapeHtml(SVC_COND_LABEL[svc] || svc + ' Details')}</div>
    <div class="form-row${extras.length === 1 ? ' single' : ''}" style="margin-bottom:0">
      ${extras.map(f => `
        <div class="field-group">
          <label class="field-label">${escapeHtml(f.label)}</label>
          ${f.type === 'select'
            ? `<select class="field-input" data-key="${escapeHtml(f.key)}">${(f.opts || []).map(o => `<option>${escapeHtml(o)}</option>`).join('')}</select>`
            : `<input type="${escapeHtml(f.type || 'text')}" class="field-input" data-key="${escapeHtml(f.key)}" placeholder="${escapeHtml(f.label)}">`}
        </div>`).join('')}
    </div>`;
}

function getFilteredOrders() {
  const searchInput = document.querySelector('.search-input');
  const filterSelects = document.querySelectorAll('.filter-select');
  const q = (searchInput?.value || '').toLowerCase();
  const svc = filterSelects[0]?.value;
  const st = filterSelects[1]?.value;
  const loc = filterSelects[2]?.value;
  return orders.filter(o => {
    if (svc && svc !== 'All services' && o.service !== svc) return false;
    if (st && st !== 'All statuses' && o.status !== st) return false;
    if (loc && loc !== 'All locations' && !o.location.includes(loc.replace(' HQ','').replace('India ','').trim())) return false;
    if (q && !o.customer.toLowerCase().includes(q) && !o.id.toLowerCase().includes(q) && !o.device.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderTable() {
  const filtered = getFilteredOrders();
  const tbody = document.querySelector('tbody');
  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-faint);font-size:13px">No orders match your filters</td></tr>';
    document.querySelector('.pg-info').textContent = '0 orders';
    return;
  }
  tbody.innerHTML = filtered.map(o => {
    const realIdx = orders.findIndex(order => order.id === o.id);
    return `<tr>
      <td><span class="order-id">${escapeHtml(o.id)}</span></td>
      <td><div class="cust-name">${escapeHtml(o.customer)}</div><div class="cust-phone">${escapeHtml(o.phone)}</div></td>
      <td><span class="svc-badge ${svcBadgeClass(o.service)}">${escapeHtml(o.service)}</span></td>
      <td><div class="device-name">${escapeHtml(o.device)}</div></td>
      <td><span class="amount-val">AED ${Number(o.amount || 0).toLocaleString()}</span></td>
      <td><span class="status-badge ${STATUS_CLS[o.status] || 's-Pending'}">${escapeHtml(o.status)}</span></td>
      <td style="color:var(--text-faint);font-size:12px">${escapeHtml(o.date)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" title="View" data-action="view" data-idx="${realIdx}"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="icon-btn" title="Cycle status" data-action="cycle" data-idx="${realIdx}"><svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></button>
        <button class="icon-btn danger" title="Delete" data-action="delete" data-idx="${realIdx}"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
  document.querySelector('.pg-info').textContent = `Showing 1-${filtered.length} of ${filtered.length} orders`;
  bindRowActions();
}

function updateStats() {
  const total = orders.length;
  const revenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const pending = orders.filter(o => o.status === 'Pending').length;
  const done = orders.filter(o => o.status === 'Completed').length;
  const rate = total ? Math.round(done / total * 100) : 0;
  const cards = document.querySelectorAll('.stat-card');
  if (!cards.length) return;
  cards[0].querySelector('.stat-val').textContent = total;
  cards[1].querySelector('.stat-val').textContent = revenue.toLocaleString();
  cards[2].querySelector('.stat-val').textContent = pending;
  cards[3].querySelector('.stat-val').textContent = done;
  cards[3].querySelector('.stat-meta').innerHTML = `<span>${rate}%</span> completion rate`;
  const sub = document.querySelector('.orders-panel .panel-sub');
  if (sub) sub.textContent = `${total} total - ${pending} pending`;
}

async function refreshOrders() {
  await Promise.all([loadOrders(), loadNotifications()]);
  renderTable();
  updateStats();
}

function bindDashboardEvents() {
  renderAgentSelect();
  renderCondFields(activeService);
  document.querySelectorAll('.svc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.svc-tab').forEach(t => { t.className = 'svc-tab'; });
      activeService = tab.textContent.trim();
      tab.classList.add('active-' + svcTabMap[activeService]);
      renderCondFields(activeService);
    });
  });
  document.querySelector('.submit-btn')?.addEventListener('click', submitOrder);
  document.querySelector('.search-input')?.addEventListener('input', renderTable);
  document.querySelectorAll('.filter-select').forEach(sel => sel.addEventListener('change', renderTable));
  document.querySelector('.btn-ghost')?.addEventListener('click', exportCsv);
  document.querySelector('.btn-navy')?.addEventListener('click', () => document.querySelector('.panel')?.scrollIntoView({ behavior: 'smooth' }));
  bindStaffModal();
  refreshOrders();
}

async function submitOrder() {
  const payload = {
    service: activeService,
    customer: document.querySelector('input[placeholder="e.g. Ravi Sharma"]').value.trim(),
    phone: document.querySelector('input[placeholder="+971 50 000 0000"]').value.trim(),
    device: document.querySelector('input[placeholder="e.g. iPhone 14 Pro Max 256GB Space Black"]').value.trim(),
    amount: parseFloat(document.querySelector('input[placeholder="0.00"]').value) || 0,
    payment: document.getElementById('payment-select').value,
    agent: document.getElementById('agent-select').value || 'Walk-in',
    location: document.getElementById('location-select').value,
    notes: document.querySelector('textarea.field-input').value.trim(),
    extras: {}
  };
  document.querySelectorAll('[data-key]').forEach(el => { payload.extras[el.dataset.key] = el.value; });
  if (!payload.customer || !payload.device) { showToast('Please fill customer name and device'); return; }
  try {
    const created = await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    await refreshOrders();
    clearForm();
    showToast('Order ' + created.id + ' punched');
  } catch (e) { showToast(e.message); }
}

function clearForm() {
  document.querySelector('input[placeholder="e.g. Ravi Sharma"]').value = '';
  document.querySelector('input[placeholder="+971 50 000 0000"]').value = '';
  document.querySelector('input[placeholder="e.g. iPhone 14 Pro Max 256GB Space Black"]').value = '';
  document.querySelector('input[placeholder="0.00"]').value = '';
  document.getElementById('agent-select').value = '';
  document.querySelector('textarea.field-input').value = '';
  document.querySelectorAll('[data-key]').forEach(el => el.value = el.tagName === 'SELECT' ? el.options[0].value : '');
}

function bindRowActions() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (btn.dataset.action === 'view') openModal(idx);
      if (btn.dataset.action === 'cycle') await cycleStatus(idx);
      if (btn.dataset.action === 'delete') await deleteOrder(idx);
    });
  });
}

async function cycleStatus(idx) {
  const order = orders[idx];
  const cur = STATUSES.indexOf(order.status);
  const status = STATUSES[(cur + 1) % STATUSES.length];
  await api('/api/orders/' + order.id, { method: 'PATCH', body: JSON.stringify({ status }) });
  await refreshOrders();
  showToast('Status updated to ' + status);
}

async function deleteOrder(idx) {
  const order = orders[idx];
  if (!confirm('Delete order ' + order.id + ' for ' + order.customer + '?')) return;
  await api('/api/orders/' + order.id, { method: 'DELETE' });
  await refreshOrders();
  showToast('Order deleted');
}

function openModal(idx) {
  currentViewIdx = idx;
  const o = orders[idx];
  document.getElementById('mOrderId').textContent = o.id;
  document.getElementById('mTitle').textContent = o.customer + ' - ' + o.service;
  const rows = [
    ['Service', `<span class="svc-badge ${svcBadgeClass(o.service)}">${escapeHtml(o.service)}</span>`],
    ['Status', `<span class="status-badge ${STATUS_CLS[o.status] || 's-Pending'}">${escapeHtml(o.status)}</span>`],
    ['Phone', escapeHtml(o.phone)], ['Payment', escapeHtml(o.payment)], ['Device', escapeHtml(o.device), true],
    ['Amount', 'AED ' + Number(o.amount || 0).toLocaleString()], ['Agent', escapeHtml(o.agent)],
    ['Location', escapeHtml(o.location)], ['Date', escapeHtml(o.date)]
  ];
  if (o.notes) rows.push(['Notes', escapeHtml(o.notes), true]);
  (SVC_EXTRAS[o.service] || []).forEach(f => { if (o.extras?.[f.key]) rows.push([f.label, escapeHtml(o.extras[f.key])]); });
  document.getElementById('mDetailGrid').innerHTML = rows.map(([k, v, full]) => `<div class="detail-item${full ? ' full' : ''}"><span class="detail-key">${escapeHtml(k)}</span><span class="detail-val">${v}</span></div>`).join('');
  document.getElementById('mStatusPills').innerHTML = STATUSES.map(s => `<button class="status-pill${s === o.status ? ' active' : ''}" data-status="${s}">${s}</button>`).join('');
  document.querySelectorAll('#mStatusPills .status-pill').forEach(pill => pill.addEventListener('click', () => {
    document.querySelectorAll('#mStatusPills .status-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
  }));
  document.getElementById('modalBackdrop').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalBackdrop').style.display = 'none';
  currentViewIdx = null;
}

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modalSaveBtn').addEventListener('click', async () => {
  if (currentViewIdx === null) return;
  const activePill = document.querySelector('#mStatusPills .status-pill.active');
  if (activePill) {
    await api('/api/orders/' + orders[currentViewIdx].id, { method: 'PATCH', body: JSON.stringify({ status: activePill.dataset.status }) });
    await refreshOrders();
    showToast('Order updated');
  }
  closeModal();
});

function renderDashboard() {
  setActiveNav('Dashboard');
  document.querySelector('.main').innerHTML = dashboardTemplate;
  bindDashboardEvents();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map(h => h.toLowerCase().replace(/\s+/g, '').replace(/_/g, ''));
  const aliases = { productname:'name', itemname:'name', qty:'stock', quantity:'stock', saleprice:'price', sellingprice:'price', warehouse:'location' };
  return rows.map(values => {
    const item = {};
    headers.forEach((header, index) => {
      item[aliases[header] || header] = values[index] || '';
    });
    return item;
  });
}

function productPayloadFromForm(prefix = 'p') {
  return {
    sku: document.getElementById(prefix + 'Sku').value,
    name: document.getElementById(prefix + 'Name').value,
    brand: document.getElementById(prefix + 'Brand').value,
    category: document.getElementById(prefix + 'Category').value || 'Device',
    stock: document.getElementById(prefix + 'Stock').value,
    price: document.getElementById(prefix + 'Price').value,
    location: document.getElementById(prefix + 'Location')?.value || 'Dubai - HQ',
    status: document.getElementById(prefix + 'Status')?.value || 'Available'
  };
}

function renderInventory() {
  setActiveNav('Inventory');
  document.querySelector('.main').innerHTML = `
    <div class="page-header"><div><div class="page-title">Product Inventory</div><div class="page-sub">Search by SKU, name, or brand. Import CSV and edit stock, price, location, status, and product details.</div></div></div>
    <div class="panel"><div class="orders-toolbar">
      <div class="search-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="productSearch" class="search-input" placeholder="Search by SKU, name, or brand..." type="text"></div>
      <input id="productCsvFile" type="file" accept=".csv,text/csv" class="file-input">
      <button class="btn btn-ghost" id="importProductsBtn" type="button">Import CSV</button>
    </div><div class="panel-body">
      <div class="form-row"><input class="field-input" id="pSku" placeholder="SKU"><input class="field-input" id="pName" placeholder="Product name"></div>
      <div class="form-row"><input class="field-input" id="pBrand" placeholder="Brand"><input class="field-input" id="pCategory" placeholder="Category"></div>
      <div class="form-row"><input class="field-input" id="pStock" type="number" placeholder="Quantity / stock"><input class="field-input" id="pPrice" type="number" placeholder="Price AED"></div>
      <div class="form-row"><input class="field-input" id="pLocation" placeholder="Location" value="Dubai - HQ"><select class="field-input" id="pStatus"><option>Available</option><option>Low Stock</option><option>Reserved</option><option>Unavailable</option></select></div>
      <button class="submit-btn" id="addProductBtn">Add Product</button>
    </div><div class="order-table-wrap"><table><thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th>Category</th><th>Stock</th><th>Price</th><th>Location</th><th></th></tr></thead><tbody id="productRows"></tbody></table></div></div>`;
  bindInventory();
}

function renderProducts() {
  const tbody = document.getElementById('productRows');
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `<tr>
    <td><span class="order-id">${escapeHtml(p.sku)}</span></td>
    <td><input class="mini-input" data-field="name" data-sku="${escapeHtml(p.sku)}" value="${escapeHtml(p.name)}"></td>
    <td><input class="mini-input" data-field="brand" data-sku="${escapeHtml(p.sku)}" value="${escapeHtml(p.brand)}"></td>
    <td><input class="mini-input" data-field="category" data-sku="${escapeHtml(p.sku)}" value="${escapeHtml(p.category)}"></td>
    <td><input class="mini-input qty" type="number" data-field="stock" data-sku="${escapeHtml(p.sku)}" value="${Number(p.stock || 0)}"></td>
    <td><input class="mini-input price" type="number" data-field="price" data-sku="${escapeHtml(p.sku)}" value="${Number(p.price || 0)}"></td>
    <td><input class="mini-input" data-field="location" data-sku="${escapeHtml(p.sku)}" value="${escapeHtml(p.location)}"><select class="mini-input product-status" data-field="status" data-sku="${escapeHtml(p.sku)}"><option${p.status === 'Available' ? ' selected' : ''}>Available</option><option${p.status === 'Low Stock' ? ' selected' : ''}>Low Stock</option><option${p.status === 'Reserved' ? ' selected' : ''}>Reserved</option><option${p.status === 'Unavailable' ? ' selected' : ''}>Unavailable</option></select></td>
    <td><div class="row-actions"><button class="icon-btn" data-save-product="${escapeHtml(p.sku)}" title="Save"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button><button class="icon-btn danger" data-delete-product="${escapeHtml(p.sku)}" title="Delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></div></td>
  </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-faint)">No products found</td></tr>';
  document.querySelectorAll('[data-save-product]').forEach(btn => btn.addEventListener('click', async () => {
    const sku = btn.dataset.saveProduct;
    const fields = [...document.querySelectorAll(`[data-sku="${CSS.escape(sku)}"]`)];
    const payload = {};
    fields.forEach(field => { payload[field.dataset.field] = field.value; });
    await api('/api/products/' + encodeURIComponent(sku), { method: 'PATCH', body: JSON.stringify(payload) });
    await loadProducts(document.getElementById('productSearch').value.trim());
    renderProducts();
    showToast('Product updated');
  }));
  document.querySelectorAll('[data-delete-product]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/api/products/' + encodeURIComponent(btn.dataset.deleteProduct), { method: 'DELETE' });
    await loadProducts(document.getElementById('productSearch').value.trim());
    renderProducts();
    showToast('Product deleted');
  }));
}

async function bindInventory() {
  await loadProducts();
  renderProducts();
  document.getElementById('productSearch').addEventListener('input', async e => { await loadProducts(e.target.value.trim()); renderProducts(); });
  document.getElementById('addProductBtn').addEventListener('click', async () => {
    const payload = productPayloadFromForm('p');
    try {
      await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      ['pSku','pName','pBrand','pCategory','pStock','pPrice'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('pLocation').value = 'Dubai - HQ';
      document.getElementById('pStatus').value = 'Available';
      await loadProducts();
      renderProducts();
      showToast('Product saved');
    } catch (e) { showToast(e.message); }
  });
  document.getElementById('importProductsBtn').addEventListener('click', async () => {
    const file = document.getElementById('productCsvFile').files[0];
    if (!file) { showToast('Choose a CSV file first'); return; }
    const rows = parseCsv(await file.text());
    if (!rows.length) { showToast('CSV has no product rows'); return; }
    try {
      const result = await api('/api/products/import', { method: 'POST', body: JSON.stringify({ products: rows }) });
      await loadProducts();
      renderProducts();
      showToast(`${result.imported} products imported${result.skipped?.length ? ', ' + result.skipped.length + ' skipped' : ''}`);
    } catch (e) { showToast(e.message); }
  });
}

function renderReports() {
  setActiveNav('Reports');
  const revenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const byService = [...new Set(orders.map(o => o.service))].map(service => ({ service, count: orders.filter(o => o.service === service).length, amount: orders.filter(o => o.service === service).reduce((s, o) => s + Number(o.amount || 0), 0) }));
  document.querySelector('.main').innerHTML = `<div class="page-header"><div><div class="page-title">Reports</div><div class="page-sub">Live totals from saved order data</div></div></div><div class="stats-grid"><div class="stat-card c-blue"><div class="stat-val">${orders.length}</div><div class="stat-lbl">Orders</div></div><div class="stat-card c-green"><div class="stat-val">${revenue.toLocaleString()}</div><div class="stat-lbl">Revenue AED</div></div><div class="stat-card c-amber"><div class="stat-val">${orders.filter(o => o.status === 'Pending').length}</div><div class="stat-lbl">Pending</div></div><div class="stat-card c-purple"><div class="stat-val">${products.length}</div><div class="stat-lbl">Products</div></div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">Service Performance</div><div class="panel-sub">Order count and revenue by vertical</div></div></div><div class="order-table-wrap"><table><thead><tr><th>Service</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>${byService.map(r => `<tr><td><span class="svc-badge ${svcBadgeClass(r.service)}">${r.service}</span></td><td>${r.count}</td><td><span class="amount-val">AED ${r.amount.toLocaleString()}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderSimpleSection(title, subtitle, rows) {
  document.querySelector('.main').innerHTML = `<div class="page-header"><div><div class="page-title">${title}</div><div class="page-sub">${subtitle}</div></div></div><div class="panel"><div class="order-table-wrap"><table><thead><tr><th>Name</th><th>Detail</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr><td><div class="cust-name">${escapeHtml(r[0])}</div></td><td>${escapeHtml(r[1])}</td><td><span class="status-badge s-Completed">${escapeHtml(r[2])}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderCustomers() {
  const seen = new Map();
  orders.forEach(o => { if (!seen.has(o.phone)) seen.set(o.phone, [o.customer, o.phone, `${orders.filter(x => x.phone === o.phone).length} orders`]); });
  renderSimpleSection('Customers', 'Customer book generated from saved orders', [...seen.values()]);
}

function renderPayments() {
  renderSimpleSection('Payments', 'Payment modes from saved orders', [...new Set(orders.map(o => o.payment))].map(mode => [mode, `AED ${orders.filter(o => o.payment === mode).reduce((s, o) => s + Number(o.amount || 0), 0).toLocaleString()}`, 'Tracked']));
}

function renderIntegrations() {
  setActiveNav('Integrations');
  const latestWhatsApp = notifications.find(n => n.channel === 'whatsapp');
  renderSimpleSection('Integrations', 'Local OMS services and warehouse notification status', [
    ['SQLite Database', 'data/rekart.db', 'Connected'],
    ['Orders API', '/api/orders', 'Live'],
    ['Products API', '/api/products', 'Live'],
    ['Agents API', '/api/agents', 'Live'],
    ['Warehouse WhatsApp', latestWhatsApp ? `${latestWhatsApp.recipient} - ${latestWhatsApp.status}` : '+971545192005 - waiting for first order update', 'Configured']
  ]);
}

function renderSettings() {
  renderSimpleSection('Settings', 'Operational configuration', [['Default Location', 'Dubai - HQ', 'Active'], ['Staff Database', `${agents.length} members`, 'Active'], ['Inventory Database', `${products.length} products`, 'Active']]);
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', e => {
    e.preventDefault();
    const label = item.textContent.trim();
    if (label === 'Dashboard' || label === 'Orders') renderDashboard();
    if (label === 'Inventory') renderInventory();
    if (label === 'Reports') renderReports();
    if (label === 'Integrations') renderIntegrations();
  }));
  document.querySelectorAll('.sidebar-item').forEach(item => item.addEventListener('click', () => {
    const label = getSidebarLabel(item);
    if (['Buy','Sell','Repair','Trade-In','Insurance','Rent','Recycle'].includes(label)) {
      renderDashboard();
      document.querySelectorAll('.filter-select')[0].value = label;
      renderTable();
    }
    if (label === 'Customers') renderCustomers();
    if (label === 'Payments') renderPayments();
    if (label === 'Settings') renderSettings();
  }));
}

function exportCsv() {
  if (!orders.length) { showToast('No orders to export'); return; }
  const headers = ['ID','Service','Customer','Phone','Device','Amount (AED)','Payment','Agent','Location','Status','Date','Notes'];
  const rows = orders.map(o => [o.id, o.service, o.customer, o.phone, o.device, o.amount, o.payment, o.agent, o.location, o.status, o.date, o.notes]);
  const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c || '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'rekart_orders.csv';
  a.click();
  showToast('CSV exported');
}

let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toast').classList.add('visible');
  toastTimer = setTimeout(() => document.getElementById('toast').classList.remove('visible'), 2800);
}

async function init() {
  await Promise.all([loadCurrentUser(), loadAgents(), loadOrders(), loadProducts(), loadNotifications()]);
  updateUserChrome();
  bindNavigation();
  bindDashboardEvents();
}

init().catch(e => showToast(e.message));
