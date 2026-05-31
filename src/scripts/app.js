let currentViewIdx = null;
let activeService = 'Buy';
let orders = [];
let products = [];
let agents = [];
let notifications = [];
let currentUser = null;
let staffModalControlsBound = false;
let formItems = [];          // working list for the order form
let nextItemId = 1;
let orderPage = 1;
let productPage = 1;

const orderDeskTemplate = document.querySelector('.main').innerHTML;
const SERVICES = ['Buy','Sell','Repair','Trade-In','Insurance','Rent','Recycle'];
const PAGE_SIZE = 50;
const LOCATION_OPTIONS = ['Dubai', 'Sharjah WH'];
const ELECTRONICS_CATALOG = {
  Laptop: ['Apple','Dell','HP','Lenovo','Microsoft','Asus','Acer','MSI','Samsung','Razer','Toshiba','Fujitsu'],
  Desktop: ['Apple','Dell','HP','Lenovo','Asus','Acer','MSI','Custom Build'],
  Monitor: ['Dell','HP','Lenovo','Samsung','LG','AOC','BenQ','Philips','ViewSonic','Asus'],
  Tablet: ['Apple','Samsung','Lenovo','Microsoft','Huawei','Xiaomi','Amazon'],
  Mobile: ['Apple','Samsung','Google','Huawei','Xiaomi','OnePlus','Oppo','Vivo','Nothing','Honor','Nokia','Motorola'],
  Accessory: ['Apple','Samsung','Dell','HP','Lenovo','Logitech','Anker','Belkin','Baseus','Ugreen','JBL','Sony','Generic'],
  Component: ['Intel','AMD','NVIDIA','Kingston','Crucial','Samsung','Western Digital','Seagate','SanDisk','Corsair'],
  Networking: ['TP-Link','D-Link','Ubiquiti','Cisco','Netgear','Asus','Linksys'],
  Printer: ['HP','Canon','Epson','Brother','Samsung','Xerox'],
  Gaming: ['Sony','Microsoft','Nintendo','Razer','Logitech','SteelSeries','HyperX'],
  Camera: ['Canon','Nikon','Sony','Fujifilm','GoPro','DJI'],
  Audio: ['Apple','Samsung','Sony','JBL','Bose','Sennheiser','Anker','Beats'],
  TV: ['Samsung','LG','Sony','TCL','Hisense','Panasonic'],
  Other: ['Generic']
};
const ELECTRONICS_CATEGORIES = Object.keys(ELECTRONICS_CATALOG);
const ALL_ELECTRONICS_BRANDS = [...new Set(Object.values(ELECTRONICS_CATALOG).flat())].sort((a, b) => a.localeCompare(b));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

function optionHtml(options, selected = '') {
  return options.map(option => `<option value="${escapeHtml(option)}"${option === selected ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
}

function locationOptionsHtml(selected = 'Dubai') {
  return optionHtml(LOCATION_OPTIONS, LOCATION_OPTIONS.includes(selected) ? selected : 'Dubai');
}

function brandsForCategory(category) {
  return ELECTRONICS_CATALOG[category] || ALL_ELECTRONICS_BRANDS;
}

function categoryOptionsHtml(selected = 'Laptop') {
  const options = ELECTRONICS_CATEGORIES.includes(selected) ? ELECTRONICS_CATEGORIES : [selected, ...ELECTRONICS_CATEGORIES];
  return optionHtml(options, selected || 'Laptop');
}

function brandOptionsHtml(category = 'Laptop', selected = '') {
  const base = brandsForCategory(category);
  const options = selected && !base.includes(selected) ? [selected, ...base] : base;
  return optionHtml(options, selected || options[0] || 'Generic');
}

function normalizeLocationName(location = '') {
  const value = String(location || '').toLowerCase();
  if (value.includes('sharjah')) return 'Sharjah WH';
  return 'Dubai';
}

function paginateRows(rows, page) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return { page: safePage, totalPages, start, end: Math.min(start + PAGE_SIZE, rows.length), rows: rows.slice(start, start + PAGE_SIZE) };
}

function renderPagination(containerId, page, totalPages, totalRows, onChangeName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!totalRows) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <button class="page-btn" type="button" data-page-action="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span class="page-count">Page ${page} of ${totalPages}</span>
    <button class="page-btn" type="button" data-page-action="next" ${page >= totalPages ? 'disabled' : ''}>Next</button>`;
  container.querySelector('[data-page-action="prev"]')?.addEventListener('click', () => window[onChangeName](page - 1));
  container.querySelector('[data-page-action="next"]')?.addEventListener('click', () => window[onChangeName](page + 1));
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
  const navRight = avatar.closest('.nav-right');
  avatar.textContent = (currentUser.name || currentUser.email || 'U').slice(0, 2).toUpperCase();
  avatar.title = currentUser.email;
  avatar.setAttribute('role', 'button');
  avatar.setAttribute('tabindex', '0');
  avatar.setAttribute('aria-haspopup', 'menu');
  avatar.setAttribute('aria-expanded', 'false');

  let menu = document.getElementById('profileMenu');
  if (!menu && navRight) {
    menu = document.createElement('div');
    menu.id = 'profileMenu';
    menu.className = 'profile-menu';
    menu.hidden = true;
    navRight.appendChild(menu);
  }
  if (!menu) return;
  menu.innerHTML = `
    <div class="profile-menu-head">
      <span class="profile-menu-name">${escapeHtml(currentUser.name || 'Sales Team')}</span>
      <span class="profile-menu-email">${escapeHtml(currentUser.email || '')}</span>
    </div>
    <button type="button" class="profile-menu-action" id="profileLogoutBtn">
      <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </button>`;

  const setMenuOpen = isOpen => {
    menu.hidden = !isOpen;
    avatar.setAttribute('aria-expanded', String(isOpen));
  };
  const toggleMenu = event => {
    event.stopPropagation();
    setMenuOpen(menu.hidden);
  };

  avatar.addEventListener('click', toggleMenu);
  avatar.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu(event);
    }
    if (event.key === 'Escape') setMenuOpen(false);
  });
  menu.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', () => setMenuOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenuOpen(false); });

  document.getElementById('profileLogoutBtn')?.addEventListener('click', async () => {
    if (!confirm('Logout from Rekart OMS?')) return;
    await fetch('/logout', { method: 'POST' });
    location.href = '/login';
  });
}

function setActiveNav(label) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.textContent.trim() === label));
}

function setActiveSidebar(label) {
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.toggle('active', getSidebarLabel(item) === label));
}

function clearActiveSidebar() {
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
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
  sel.innerHTML = '<option value="">Select staff member</option>' +
    agents.map(a => `<option value="${escapeHtml(a)}"${a === cur ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('');
}

function renderStatusSelect(selectValue = 'Pending') {
  const sel = document.getElementById('status-select');
  if (!sel) return;
  sel.innerHTML = STATUSES.map(s => `<option value="${escapeHtml(s)}"${s === selectValue ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
}

function renderCountrySelect(selectValue = '+971') {
  const sel = document.getElementById('phoneCountry');
  if (!sel) return;
  const current = selectValue || sel.value || '+971';
  // Dedupe codes to avoid duplicate options (e.g. multiple Caribbean countries share +1xxx)
  const seen = new Set();
  sel.innerHTML = COUNTRY_CODES
    .filter(([, code]) => { if (seen.has(code)) return false; seen.add(code); return true; })
    .map(([name, code]) => `<option value="${escapeHtml(code)}" title="${escapeHtml(name)} (${escapeHtml(code)})"${code === current && name === 'United Arab Emirates' ? ' selected' : ''}>${escapeHtml(code)}</option>`)
    .join('');
  if (![...sel.options].some(option => option.selected)) sel.value = current;
}

function phoneValueForSubmit() {
  const code = document.getElementById('phoneCountry')?.value || '+971';
  const digits = val('customerPhone').replace(/\D/g, '');
  return `${code} ${digits}`.trim();
}

function markInvalid(el, message) {
  if (!el) return false;
  el.classList.add('field-error');
  el.setAttribute('aria-invalid', 'true');
  if (message) el.title = message;
  return false;
}

function clearInvalid(el) {
  if (!el) return;
  el.classList.remove('field-error');
  el.removeAttribute('aria-invalid');
  el.removeAttribute('title');
}

function clearFormErrors(root = document) {
  root.querySelectorAll('.field-error').forEach(clearInvalid);
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
            ? `<select class="field-input" data-key="${escapeHtml(f.key)}" required>${(f.opts || []).map(o => `<option>${escapeHtml(o)}</option>`).join('')}</select>`
            : `<input type="${escapeHtml(f.type || 'text')}" class="field-input" data-key="${escapeHtml(f.key)}" placeholder="${escapeHtml(f.placeholder || f.label)}" required>`}
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
    if (loc && loc !== 'All locations' && normalizeLocationName(o.location) !== loc) return false;
    const haystack = [o.customer, o.id, o.device, o.phone, o.serial_number, o.notes].join(' ').toLowerCase();
    if (q && !haystack.includes(q)) return false;
    return true;
  });
}

function syncOrderTableHeader() {
  const head = document.querySelector('.orders-panel thead tr');
  if (!head) return;
  head.innerHTML = '<th>Order ID</th><th>Customer</th><th>Service</th><th>Device</th><th>Serial No.</th><th>Amount</th><th>Status</th><th>Date</th><th></th>';
}

function renderTable() {
  const filtered = getFilteredOrders();
  const tbody = document.querySelector('tbody');
  if (!tbody) return;
  syncOrderTableHeader();
  const pageData = paginateRows(filtered, orderPage);
  orderPage = pageData.page;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-faint);font-size:13px">No orders match your filters</td></tr>';
    document.querySelector('.pg-info').textContent = '0 orders';
    renderPagination('orderPagination', 1, 1, 0, 'changeOrderPage');
    return;
  }
  tbody.innerHTML = pageData.rows.map(o => {
    const realIdx = orders.findIndex(order => order.id === o.id);
    return `<tr data-row-idx="${realIdx}">
      <td><span class="order-id">${escapeHtml(o.id)}</span></td>
      <td><div class="cust-name">${escapeHtml(o.customer)}</div><div class="cust-phone">${escapeHtml(o.phone)}</div></td>
      <td><span class="svc-badge ${svcBadgeClass(o.service)}">${escapeHtml(o.service)}</span></td>
      <td><div class="device-name">${escapeHtml(o.device)}</div></td>
      <td><span class="serial-cell">${escapeHtml(o.serial_number || 'Pending')}</span></td>
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
  document.querySelector('.pg-info').textContent = `Showing ${pageData.start + 1}-${pageData.end} of ${filtered.length} orders`;
  renderPagination('orderPagination', pageData.page, pageData.totalPages, filtered.length, 'changeOrderPage');
  bindRowActions();
}

window.changeOrderPage = page => {
  orderPage = page;
  renderTable();
};

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

function updateSidebarCounts() {
  document.querySelectorAll('.sidebar-count[data-count]').forEach(badge => {
    const service = badge.dataset.count;
    const count = orders.filter(o => o.service === service).length;
    badge.textContent = count;
    badge.classList.toggle('is-empty', count === 0);
  });
}

async function refreshOrders() {
  await Promise.all([loadOrders(), loadNotifications()]);
  renderTable();
  updateStats();
  updateSidebarCounts();
}

function blankItem() {
  return { _id: nextItemId++, sku: '', name: '', brand: '', qty: 1, price: 0 };
}

function findProductByName(name) {
  const key = (name || '').trim().toLowerCase();
  if (!key) return null;
  return products.find(p => p.name.toLowerCase() === key)
      || products.find(p => p.name.toLowerCase().startsWith(key))
      || null;
}

function getProductMatches(query, limit = 30) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    // Default: alphabetical by brand then name
    return [...products].sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)).slice(0, limit);
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  return products
    .map(product => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      const brand = product.brand.toLowerCase();
      const haystack = [name, sku, brand, product.category || ''].join(' ').toLowerCase();
      if (!tokens.every(token => haystack.includes(token))) return null;
      let score = 0;
      if (name === q) score += 100;
      if (name.startsWith(q)) score += 60;
      if (brand === q) score += 50;
      if (sku.startsWith(q)) score += 40;
      if (brand.startsWith(q)) score += 30;
      if (name.includes(q)) score += 15;
      score += Math.max(0, 30 - name.length / 8);
      return { product, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map(result => result.product);
}

function selectProductForItem(item, row, product) {
  item.sku = product.sku;
  item.brand = product.brand;
  item.name = product.name;
  item.price = Number(product.price) || 0;
  const nameInput  = row.querySelector('.item-name');
  const priceInput = row.querySelector('.item-price');
  if (nameInput)  nameInput.value = product.name;
  if (priceInput) priceInput.value = item.price || '';
  row.classList.add('has-product');
  clearInvalid(nameInput);
  clearInvalid(priceInput);
  const box = row.querySelector('.product-suggestions');
  if (box) box.setAttribute('hidden', '');
  updateItemsTotal();
}

function setActiveSuggestion(box, index) {
  const buttons = [...box.querySelectorAll('.product-suggestion')];
  buttons.forEach((btn, i) => btn.classList.toggle('is-active', i === index));
  buttons[index]?.scrollIntoView({ block: 'nearest' });
}

function renderProductSuggestions(row, item, query = '') {
  const box = row.querySelector('.product-suggestions');
  if (!box) return;
  const matches = getProductMatches(query);
  if (!matches.length) {
    box.innerHTML = `<div class="product-suggestion-empty">No product matches <b>${escapeHtml(query)}</b>. Press Enter to keep as custom item.</div>`;
    box.removeAttribute('hidden');
    return;
  }
  box.innerHTML = matches.map(p => `
    <button type="button" class="product-suggestion" data-sku="${escapeHtml(p.sku)}">
      <span class="product-suggestion-main">${escapeHtml(p.name)}</span>
      <span class="product-suggestion-meta">${escapeHtml(p.brand)} · ${escapeHtml(p.sku)}</span>
      <span class="product-suggestion-price">AED ${Number(p.price || 0).toLocaleString()}</span>
    </button>`).join('');
  box.removeAttribute('hidden');
  box.dataset.activeIndex = '0';
  setActiveSuggestion(box, 0);
  box.querySelectorAll('.product-suggestion').forEach((btn, idx) => {
    btn.addEventListener('mousedown', event => event.preventDefault());
    btn.addEventListener('mouseenter', () => { box.dataset.activeIndex = String(idx); setActiveSuggestion(box, idx); });
    btn.addEventListener('click', () => {
      const product = products.find(p => p.sku === btn.dataset.sku);
      if (product) selectProductForItem(item, row, product);
    });
  });
}

function updateItemsTotal() {
  const total = formItems.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const wrap  = document.getElementById('itemsTotal');
  const value = document.getElementById('itemsTotalValue');
  const amount = document.getElementById('orderAmount');
  if (!wrap || !value) return;
  if (total > 0) {
    wrap.hidden = false;
    value.textContent = total.toLocaleString();
    if (amount && !amount.dataset.touched) {
      amount.value = total;
      clearInvalid(amount);
    }
  } else {
    wrap.hidden = true;
  }
}

function renderItemsList() {
  const list = document.getElementById('itemsList');
  if (!list) return;
  if (!formItems.length) formItems = [blankItem()];
  const solo = formItems.length === 1 ? ' solo' : '';
  list.innerHTML = formItems.map(item => `
    <div class="item-row${item.sku ? ' has-product' : ''}${solo}" data-id="${item._id}">
      <div class="item-search-wrap item-mini-field">
        <span>Device / Item</span>
        <input type="text" class="item-name" placeholder="Search (e.g. Lenovo, T460S, Dell 7400)" value="${escapeHtml(item.name)}" autocomplete="off" spellcheck="false" required>
        <span class="item-search-caret"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></span>
        <div class="product-suggestions" hidden></div>
      </div>
      <div class="item-mini-field"><span>Qty</span><input type="number" class="item-qty" placeholder="1" min="1" step="1" value="${item.qty || 1}"></div>
      <div class="item-mini-field"><span>Price (AED)</span><input type="number" class="item-price" placeholder="0" min="0" step="0.01" value="${item.price || ''}"></div>
      <button type="button" class="item-remove" title="Remove item">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  list.querySelectorAll('.item-row').forEach(row => {
    const id = parseInt(row.dataset.id, 10);
    const item = formItems.find(it => it._id === id);
    if (!item) return;
    const nameEl  = row.querySelector('.item-name');
    const qtyEl   = row.querySelector('.item-qty');
    const priceEl = row.querySelector('.item-price');
    const box     = row.querySelector('.product-suggestions');

    nameEl.addEventListener('focus', () => renderProductSuggestions(row, item, nameEl.value));
    nameEl.addEventListener('blur', () => setTimeout(() => box?.setAttribute('hidden', ''), 150));
    nameEl.addEventListener('input', () => {
      clearInvalid(nameEl);
      item.name = nameEl.value;
      item.sku = '';
      item.brand = '';
      row.classList.remove('has-product');
      renderProductSuggestions(row, item, nameEl.value);
    });
    nameEl.addEventListener('keydown', event => {
      const visible = box && !box.hasAttribute('hidden');
      const buttons = visible ? [...box.querySelectorAll('.product-suggestion')] : [];
      let idx = parseInt(box?.dataset.activeIndex || '0', 10);
      if (event.key === 'Escape') { box?.setAttribute('hidden', ''); return; }
      if (event.key === 'ArrowDown' && buttons.length) {
        event.preventDefault();
        idx = Math.min(idx + 1, buttons.length - 1);
        box.dataset.activeIndex = String(idx);
        setActiveSuggestion(box, idx);
      }
      if (event.key === 'ArrowUp' && buttons.length) {
        event.preventDefault();
        idx = Math.max(idx - 1, 0);
        box.dataset.activeIndex = String(idx);
        setActiveSuggestion(box, idx);
      }
      if (event.key === 'Enter') {
        if (buttons.length && visible) {
          event.preventDefault();
          buttons[idx]?.click();
        } else {
          box?.setAttribute('hidden', '');
        }
      }
      if (event.key === 'Tab' && visible && buttons.length) {
        // Pick highlighted product when tabbing out
        buttons[idx]?.click();
      }
    });
    qtyEl.addEventListener('input', () => { clearInvalid(qtyEl); item.qty = parseInt(qtyEl.value, 10) || 1; updateItemsTotal(); });
    priceEl.addEventListener('input', () => { clearInvalid(priceEl); item.price = parseFloat(priceEl.value) || 0; updateItemsTotal(); });

    row.querySelector('.item-remove').addEventListener('click', () => {
      if (formItems.length <= 1) return;
      formItems = formItems.filter(it => it._id !== id);
      renderItemsList();
    });
  });
  updateItemsTotal();
}

function resetFormItems() {
  formItems = [blankItem()];
  renderItemsList();
}

function syncActiveServiceTab() {
  const tabs = document.querySelectorAll('.svc-tab');
  tabs.forEach(tab => {
    tab.className = 'svc-tab';
    if (tab.textContent.trim() === activeService) {
      tab.classList.add('active-' + (svcTabMap[activeService] || 'buy'));
    }
  });
  renderCondFields(activeService);
}

function bindDashboardEvents() {
  renderAgentSelect();
  renderCountrySelect('+971');
  renderStatusSelect('Pending');
  resetFormItems();
  syncActiveServiceTab();
  document.querySelectorAll('.svc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeService = tab.textContent.trim();
      syncActiveServiceTab();
    });
  });
  document.getElementById('addItemBtn')?.addEventListener('click', () => {
    formItems.push(blankItem());
    renderItemsList();
    setTimeout(() => {
      const rows = document.querySelectorAll('.item-row');
      rows[rows.length - 1]?.querySelector('.item-name')?.focus();
    }, 0);
  });
  document.querySelector('.submit-btn')?.addEventListener('click', submitOrder);
  document.querySelectorAll('#customerName,#phoneCountry,#customerPhone,#orderAmount,#agent-select,#location-select,#payment-select,#status-select').forEach(el => {
    el.addEventListener('input', () => clearInvalid(el));
    el.addEventListener('change', () => clearInvalid(el));
  });
  document.getElementById('orderAmount')?.addEventListener('input', event => { event.currentTarget.dataset.touched = 'true'; });
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.placeholder = 'Search order ID, customer, phone, device, serial...';
    searchInput.addEventListener('input', () => { orderPage = 1; renderTable(); });
  }
  document.querySelectorAll('.filter-select').forEach(sel => sel.addEventListener('change', () => { orderPage = 1; renderTable(); }));
  document.querySelector('.btn-ghost')?.addEventListener('click', exportCsv);
  document.querySelector('.btn-navy')?.addEventListener('click', () => document.getElementById('customerName')?.focus());
  bindStaffModal();
  refreshOrders();
}

function val(id) { return (document.getElementById(id)?.value || '').trim(); }

function collectItemsForSubmit() {
  return formItems
    .map(it => ({ sku: it.sku, name: (it.name || '').trim(), brand: it.brand, qty: Number(it.qty) || 1, price: Number(it.price) || 0 }))
    .filter(it => it.name);
}

function validateOrderForm() {
  clearFormErrors();
  const errors = [];
  const requiredIds = [
    ['customerName', 'Customer name is required'],
    ['phoneCountry', 'Country code is required'],
    ['customerPhone', 'Phone is required'],
    ['orderAmount', 'Amount is required'],
    ['payment-select', 'Payment mode is required'],
    ['status-select', 'Status is required'],
    ['agent-select', 'Handled by is required'],
    ['location-select', 'Location is required']
  ];
  requiredIds.forEach(([id, message]) => {
    const el = document.getElementById(id);
    if (!String(el?.value || '').trim()) {
      errors.push(message);
      markInvalid(el, message);
    }
  });
  const phoneInput = document.getElementById('customerPhone');
  const phoneDigits = val('customerPhone').replace(/\D/g, '');
  if (phoneInput && phoneDigits && (phoneDigits.length < 5 || phoneDigits.length > 15)) {
    errors.push('Enter a valid phone number');
    markInvalid(phoneInput, 'Enter digits only, without country code');
  }

  document.querySelectorAll('.item-row').forEach((row, index) => {
    const nameEl = row.querySelector('.item-name');
    const qtyEl = row.querySelector('.item-qty');
    const priceEl = row.querySelector('.item-price');
    if (!nameEl.value.trim()) { errors.push(`Item ${index + 1} name is required`); markInvalid(nameEl, 'Device/item is required'); }
    if (!qtyEl.value || Number(qtyEl.value) <= 0) { errors.push(`Item ${index + 1} quantity is required`); markInvalid(qtyEl, 'Quantity must be at least 1'); }
    if (priceEl.value === '' || Number(priceEl.value) < 0) { errors.push(`Item ${index + 1} price is required`); markInvalid(priceEl, 'Price is required'); }
  });

  document.querySelectorAll('.cond-fields [data-key]').forEach(el => {
    if (!String(el.value || '').trim()) {
      const label = el.closest('.field-group')?.querySelector('.field-label')?.textContent.trim() || 'Service detail';
      errors.push(label + ' is required');
      markInvalid(el, label + ' is required');
    }
  });

  if (errors.length) {
    document.querySelector('.field-error')?.focus();
    showToast(errors[0]);
    return false;
  }
  return true;
}

async function submitOrder() {
  if (!validateOrderForm()) return;
  const items = collectItemsForSubmit();
  const amountRaw = document.getElementById('orderAmount')?.value;
  const payload = {
    service: activeService,
    customer: val('customerName'),
    phone: phoneValueForSubmit(),
    items,
    amount: amountRaw === '' || amountRaw === undefined ? undefined : parseFloat(amountRaw) || 0,
    payment: document.getElementById('payment-select')?.value || 'Pending',
    status:  document.getElementById('status-select')?.value || 'Pending',
    agent: document.getElementById('agent-select')?.value,
    location: document.getElementById('location-select')?.value || 'Dubai',
    notes: val('orderNotes'),
    extras: {}
  };
  document.querySelectorAll('.cond-fields [data-key]').forEach(el => { payload.extras[el.dataset.key] = el.value; });
  try {
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.classList.add('is-saving');
    const created = await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    await refreshOrders();
    clearForm();
    showToast('Order ' + created.id + ' punched');
  } catch (e) { showToast(e.message); }
  finally {
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-saving');
  }
}

function clearForm() {
  ['customerName','customerPhone','orderAmount','orderNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const payment = document.getElementById('payment-select');
  if (payment) payment.selectedIndex = 0;
  renderStatusSelect('Pending');
  const amount = document.getElementById('orderAmount');
  if (amount) delete amount.dataset.touched;
  const agent = document.getElementById('agent-select');
  if (agent) agent.value = '';
  const location = document.getElementById('location-select');
  if (location) location.selectedIndex = 0;
  renderCountrySelect('+971');
  document.querySelectorAll('.cond-fields [data-key]').forEach(el => {
    el.value = el.tagName === 'SELECT' ? (el.options[0]?.value || '') : '';
  });
  resetFormItems();
}

function bindRowActions() {
  document.querySelectorAll('tbody tr[data-row-idx]').forEach(row => {
    row.addEventListener('click', () => openModal(parseInt(row.dataset.rowIdx, 10)));
  });
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
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

function renderModalItems(items) {
  if (!items?.length) return '<div class="modal-item-empty">No line items recorded</div>';
  const total = items.reduce((sum, it) => sum + (Number(it.qty)||0) * (Number(it.price)||0), 0);
  return `
    <div class="modal-items-table">
      ${items.map(it => `
        <div class="modal-item-row">
          <div class="modal-item-name">${escapeHtml(it.name)}${it.sku ? `<span class="modal-item-sku">${escapeHtml(it.sku)}</span>` : ''}</div>
          <div class="modal-item-qty">×${Number(it.qty)||1}</div>
          <div class="modal-item-price">AED ${(Number(it.price)||0).toLocaleString()}</div>
        </div>`).join('')}
      <div class="modal-item-total"><span>Items subtotal</span><strong>AED ${total.toLocaleString()}</strong></div>
    </div>`;
}

function openModal(idx) {
  currentViewIdx = idx;
  const o = orders[idx];
  document.getElementById('mOrderId').textContent = o.id;
  document.getElementById('mTitle').textContent = o.customer + ' - ' + o.service;
  document.getElementById('mDetailGrid').innerHTML = `
    <div class="detail-item"><span class="detail-key">Customer</span><input class="mini-input" id="mCustomer" value="${escapeHtml(o.customer)}"></div>
    <div class="detail-item"><span class="detail-key">Phone</span><input class="mini-input" id="mPhone" value="${escapeHtml(o.phone)}"></div>
    <div class="detail-item full"><span class="detail-key">Items</span>${renderModalItems(o.items)}</div>
    <div class="detail-item full"><span class="detail-key">Device Summary</span><input class="mini-input" id="mDevice" value="${escapeHtml(o.device)}"></div>
    <div class="detail-item"><span class="detail-key">Amount AED</span><input class="mini-input" id="mAmount" type="number" value="${Number(o.amount || 0)}"></div>
    <div class="detail-item"><span class="detail-key">Payment</span><select class="mini-input" id="mPayment">${['Cash','Card (POS)','Bank Transfer','Tabby / BNPL','Pending'].map(payment => `<option${payment === o.payment ? ' selected' : ''}>${payment}</option>`).join('')}</select></div>
    <div class="detail-item"><span class="detail-key">Handled By</span><select class="mini-input" id="mAgent">${['Walk-in', ...agents].map(agent => `<option${agent === o.agent ? ' selected' : ''}>${escapeHtml(agent)}</option>`).join('')}</select></div>
    <div class="detail-item"><span class="detail-key">Location</span><select class="mini-input" id="mLocation">${locationOptionsHtml(normalizeLocationName(o.location))}</select></div>
    <div class="detail-item full"><span class="detail-key">Warehouse Serial Number</span><input class="mini-input serial-input" id="mSerialNumber" value="${escapeHtml(o.serial_number || '')}" placeholder="Enter serial number while packing"></div>
    <div class="detail-item full"><span class="detail-key">Notes</span><textarea class="mini-input modal-textarea" id="mNotes" placeholder="Accessories, condition, packing notes">${escapeHtml(o.notes || '')}</textarea></div>
    ${(SVC_EXTRAS[o.service] || []).map(f => `<div class="detail-item"><span class="detail-key">${escapeHtml(f.label)}</span><span class="detail-val">${escapeHtml(o.extras?.[f.key] || '-')}</span></div>`).join('')}
  `;
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
  const payload = {
    customer: document.getElementById('mCustomer').value.trim(),
    phone: document.getElementById('mPhone').value.trim(),
    device: document.getElementById('mDevice').value.trim(),
    amount: document.getElementById('mAmount').value,
    payment: document.getElementById('mPayment').value,
    agent: document.getElementById('mAgent').value,
    location: document.getElementById('mLocation').value,
    serial_number: document.getElementById('mSerialNumber').value.trim(),
    notes: document.getElementById('mNotes').value.trim(),
    status: activePill?.dataset.status || orders[currentViewIdx].status
  };
  clearFormErrors(document.getElementById('modalBackdrop'));
  const requiredModal = [
    ['mCustomer', 'Customer is required'], ['mPhone', 'Phone is required'], ['mDevice', 'Device summary is required'],
    ['mAmount', 'Amount is required'], ['mPayment', 'Payment is required'], ['mAgent', 'Handled by is required'], ['mLocation', 'Location is required']
  ];
  for (const [id, message] of requiredModal) {
    const el = document.getElementById(id);
    if (!String(el?.value || '').trim()) { markInvalid(el, message); showToast(message); el?.focus(); return; }
  }
  await api('/api/orders/' + orders[currentViewIdx].id, { method: 'PATCH', body: JSON.stringify(payload) });
  await refreshOrders();
  showToast('Order updated');
  closeModal();
});

function statCardHtml(kind, icon, value, label, meta) {
  return `
    <div class="stat-card c-${kind}">
      <div class="stat-icon ${kind}">${icon}</div>
      <div class="stat-val">${value}</div>
      <div class="stat-lbl">${label}</div>
      <div class="stat-meta">${meta}</div>
    </div>`;
}

function renderDashboard() {
  setActiveNav('Dashboard');
  clearActiveSidebar();
  const total = orders.length;
  const revenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const pending = orders.filter(order => order.status === 'Pending').length;
  const completed = orders.filter(order => order.status === 'Completed').length;
  const completionRate = total ? Math.round(completed / total * 100) : 0;
  const recentOrders = orders.slice(0, 6);
  const serviceRows = SERVICES.map(service => {
    const serviceOrders = orders.filter(order => order.service === service);
    const amount = serviceOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    return { service, count: serviceOrders.length, amount };
  });
  const lowStock = products.filter(product => Number(product.stock || 0) <= 2).slice(0, 6);
  const latestEmail = notifications.find(notification => notification.channel === 'email');

  document.querySelector('.main').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Operations Dashboard</div>
        <div class="page-sub">Live health check across orders, revenue, inventory, and warehouse email alerts</div>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" id="dashboardInventoryBtn" type="button">
          <svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          Inventory
        </button>
        <button class="btn btn-navy" id="dashboardNewOrderBtn" type="button">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Order
        </button>
      </div>
    </div>

    <div class="stats-grid">
      ${statCardHtml('blue', '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>', total.toLocaleString(), 'Total Orders', 'All saved orders')}
      ${statCardHtml('green', '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', revenue.toLocaleString(), 'Revenue AED', 'From punched orders')}
      ${statCardHtml('amber', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', pending.toLocaleString(), 'Pending', 'Awaiting action')}
      ${statCardHtml('purple', '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', completed.toLocaleString(), 'Completed', `<span>${completionRate}%</span> completion rate`)}
    </div>

    <div class="dashboard-grid">
      <div class="panel dashboard-panel wide">
        <div class="panel-head"><div><div class="panel-title">Recent Orders</div><div class="panel-sub">Latest activity from the order desk</div></div></div>
        <div class="order-table-wrap dashboard-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          ${recentOrders.length ? recentOrders.map(order => {
            const idx = orders.findIndex(item => item.id === order.id);
            return `<tr data-dashboard-order-idx="${idx}"><td><span class="order-id">${escapeHtml(order.id)}</span></td><td><div class="cust-name">${escapeHtml(order.customer)}</div><div class="cust-phone">${escapeHtml(order.phone)}</div></td><td><span class="svc-badge ${svcBadgeClass(order.service)}">${escapeHtml(order.service)}</span></td><td><span class="amount-val">AED ${Number(order.amount || 0).toLocaleString()}</span></td><td><span class="status-badge ${STATUS_CLS[order.status] || 's-Pending'}">${escapeHtml(order.status)}</span></td></tr>`;
          }).join('') : '<tr><td colspan="5" class="empty-cell">No orders yet</td></tr>'}
        </tbody></table></div>
      </div>

      <div class="panel dashboard-panel">
        <div class="panel-head"><div><div class="panel-title">Service Mix</div><div class="panel-sub">Count and revenue by vertical</div></div></div>
        <div class="dashboard-list">
          ${serviceRows.map(row => `<div class="dashboard-list-row"><span><span class="svc-badge ${svcBadgeClass(row.service)}">${row.service}</span></span><strong>${row.count}</strong><small>AED ${row.amount.toLocaleString()}</small></div>`).join('')}
        </div>
      </div>

      <div class="panel dashboard-panel">
        <div class="panel-head"><div><div class="panel-title">Inventory Watch</div><div class="panel-sub">Products that need attention</div></div></div>
        <div class="dashboard-list">
          ${lowStock.length ? lowStock.map(product => `<div class="dashboard-list-row"><span>${escapeHtml(product.name)}<small>${escapeHtml(product.sku)}</small></span><strong>${Number(product.stock || 0)}</strong><small>${escapeHtml(product.status || 'Available')}</small></div>`).join('') : '<div class="empty-cell">No low-stock products</div>'}
        </div>
      </div>

      <div class="panel dashboard-panel">
        <div class="panel-head"><div><div class="panel-title">System Status</div><div class="panel-sub">Backend and integrations</div></div></div>
        <div class="dashboard-list">
          <div class="dashboard-list-row"><span>Orders API<small>/api/orders</small></span><strong>Live</strong></div>
          <div class="dashboard-list-row"><span>Products API<small>/api/products</small></span><strong>Live</strong></div>
          <div class="dashboard-list-row"><span>Warehouse Email<small>${latestEmail ? escapeHtml(latestEmail.recipient) : 'sales@scalify.ae'}</small></span><strong>${escapeHtml(latestEmail?.status || 'Ready')}</strong></div>
        </div>
      </div>
    </div>`;

  document.getElementById('dashboardNewOrderBtn')?.addEventListener('click', () => {
    renderOrderDesk('Orders');
    document.getElementById('customerName')?.focus();
  });
  document.getElementById('dashboardInventoryBtn')?.addEventListener('click', renderInventory);
  document.querySelectorAll('[data-dashboard-order-idx]').forEach(row => row.addEventListener('click', () => openModal(parseInt(row.dataset.dashboardOrderIdx, 10))));
}

function renderOrderDesk(navLabel = 'Orders') {
  setActiveNav(navLabel);
  clearActiveSidebar();
  document.querySelector('.main').innerHTML = orderDeskTemplate;
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
    location: document.getElementById(prefix + 'Location')?.value || 'Dubai',
    status: document.getElementById(prefix + 'Status')?.value || 'Available'
  };
}

function inventoryStats() {
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const totalValue = products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.price || 0), 0);
  const lowStock = products.filter(product => Number(product.stock || 0) <= 2).length;
  const categoryCount = new Set(products.map(product => product.category).filter(Boolean)).size;
  const brandCount = new Set(products.map(product => product.brand).filter(Boolean)).size;
  return { totalProducts, totalStock, totalValue, lowStock, categoryCount, brandCount };
}

function updateInventoryDashboardStats() {
  const wrap = document.querySelector('.inventory-stats');
  if (!wrap) return;
  const stats = inventoryStats();
  const cards = wrap.querySelectorAll('.stat-card');
  if (!cards.length) return;
  cards[0].querySelector('.stat-val').textContent = stats.totalProducts.toLocaleString();
  cards[0].querySelector('.stat-meta').textContent = `${stats.categoryCount} categories · ${stats.brandCount} brands`;
  cards[1].querySelector('.stat-val').textContent = stats.totalStock.toLocaleString();
  cards[2].querySelector('.stat-val').textContent = stats.lowStock.toLocaleString();
  cards[3].querySelector('.stat-val').textContent = stats.totalValue.toLocaleString();
}

function getFilteredProducts() {
  const category = document.getElementById('productCategoryFilter')?.value || 'All categories';
  const brand = document.getElementById('productBrandFilter')?.value || 'All brands';
  const location = document.getElementById('productLocationFilter')?.value || 'All locations';
  return products.filter(product => {
    if (category !== 'All categories' && product.category !== category) return false;
    if (brand !== 'All brands' && product.brand !== brand) return false;
    if (location !== 'All locations' && normalizeLocationName(product.location) !== location) return false;
    return true;
  });
}

function updateProductBrandFilter() {
  const category = document.getElementById('productCategoryFilter')?.value || 'All categories';
  const brandFilter = document.getElementById('productBrandFilter');
  if (!brandFilter) return;
  const current = brandFilter.value;
  const brands = category === 'All categories'
    ? [...new Set(products.map(product => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : brandsForCategory(category);
  brandFilter.innerHTML = '<option>All brands</option>' + optionHtml(brands, brands.includes(current) ? current : '');
}

function bindConnectedCategoryBrand(categoryId, brandId) {
  const categoryEl = document.getElementById(categoryId);
  const brandEl = document.getElementById(brandId);
  if (!categoryEl || !brandEl) return;
  categoryEl.addEventListener('change', () => {
    brandEl.innerHTML = brandOptionsHtml(categoryEl.value, brandEl.value);
  });
}

function renderImportAlert(result) {
  const alert = document.getElementById('importAlert');
  if (!alert) return;
  const skipped = result.skipped || [];
  alert.hidden = false;
  alert.className = skipped.length ? 'import-alert has-skips' : 'import-alert';
  alert.innerHTML = `
    <div class="import-alert-main">
      <strong>${Number(result.imported || 0).toLocaleString()} products imported</strong>
      <span>${skipped.length ? `${skipped.length} rows skipped. Review the first ${Math.min(skipped.length, 8)} below.` : 'CSV import completed successfully.'}</span>
    </div>
    ${skipped.length ? `<div class="import-alert-skips">${skipped.slice(0, 8).map(item => `<span>Row ${escapeHtml(item.row)}: ${escapeHtml(item.reason)}</span>`).join('')}</div>` : ''}`;
}

function renderInventory() {
  setActiveNav('Inventory');
  clearActiveSidebar();
  const stats = inventoryStats();
  document.querySelector('.main').innerHTML = `
    <div class="page-header"><div><div class="page-title">Inventory Dashboard</div><div class="page-sub">Stock control for Rekart electronics across Dubai and Sharjah WH</div></div></div>
    <div class="stats-grid inventory-stats">
      ${statCardHtml('blue', '<svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>', stats.totalProducts.toLocaleString(), 'Products', `${stats.categoryCount} categories · ${stats.brandCount} brands`)}
      ${statCardHtml('green', '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', stats.totalStock.toLocaleString(), 'Units In Stock', 'Across Dubai and Sharjah WH')}
      ${statCardHtml('amber', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', stats.lowStock.toLocaleString(), 'Low Stock', '2 units or fewer')}
      ${statCardHtml('purple', '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', stats.totalValue.toLocaleString(), 'Stock Value AED', 'Qty x selling price')}
    </div>

    <div class="panel"><div class="orders-toolbar">
      <div class="search-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="productSearch" class="search-input" placeholder="Search by SKU, name, or brand..." type="text"></div>
      <select class="filter-select" id="productCategoryFilter"><option>All categories</option>${optionHtml(ELECTRONICS_CATEGORIES)}</select>
      <select class="filter-select" id="productBrandFilter"><option>All brands</option>${optionHtml([...new Set(products.map(product => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)))}</select>
      <select class="filter-select" id="productLocationFilter"><option>All locations</option>${optionHtml(LOCATION_OPTIONS)}</select>
      <input id="productCsvFile" type="file" accept=".csv,text/csv" class="file-input">
      <button class="btn btn-ghost" id="importProductsBtn" type="button">Import CSV</button>
    </div><div class="panel-body">
      <div class="import-alert" id="importAlert" hidden></div>
      <div class="form-row"><input class="field-input" id="pSku" placeholder="SKU"><input class="field-input" id="pName" placeholder="Product name"></div>
      <div class="form-row"><select class="field-input" id="pCategory">${categoryOptionsHtml('Laptop')}</select><select class="field-input" id="pBrand">${brandOptionsHtml('Laptop', 'Dell')}</select></div>
      <div class="form-row"><input class="field-input" id="pStock" type="number" placeholder="Quantity / stock"><input class="field-input" id="pPrice" type="number" placeholder="Price AED"></div>
      <div class="form-row"><select class="field-input" id="pLocation">${locationOptionsHtml('Dubai')}</select><select class="field-input" id="pStatus"><option>Available</option><option>Low Stock</option><option>Reserved</option><option>Unavailable</option></select></div>
      <button class="submit-btn" id="addProductBtn">Add Product</button>
    </div><div class="order-table-wrap"><table><thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th>Category</th><th>Stock</th><th>Price</th><th>Location</th><th></th></tr></thead><tbody id="productRows"></tbody></table></div><div class="table-footer"><span class="pg-info" id="productPageInfo">0 products</span><div class="pagination" id="productPagination"></div></div></div>`;
  bindInventory();
}

function renderProducts() {
  const tbody = document.getElementById('productRows');
  if (!tbody) return;
  const filtered = getFilteredProducts();
  const pageData = paginateRows(filtered, productPage);
  productPage = pageData.page;
  tbody.innerHTML = pageData.rows.map(p => `<tr>
    <td><span class="order-id">${escapeHtml(p.sku)}</span></td>
    <td><input class="mini-input" data-field="name" data-sku="${escapeHtml(p.sku)}" value="${escapeHtml(p.name)}"></td>
    <td><select class="mini-input product-brand-select" data-field="brand" data-sku="${escapeHtml(p.sku)}">${brandOptionsHtml(p.category || 'Laptop', p.brand)}</select></td>
    <td><select class="mini-input product-category-select" data-field="category" data-sku="${escapeHtml(p.sku)}">${categoryOptionsHtml(p.category || 'Laptop')}</select></td>
    <td><input class="mini-input qty" type="number" data-field="stock" data-sku="${escapeHtml(p.sku)}" value="${Number(p.stock || 0)}"></td>
    <td><input class="mini-input price" type="number" data-field="price" data-sku="${escapeHtml(p.sku)}" value="${Number(p.price || 0)}"></td>
    <td><select class="mini-input" data-field="location" data-sku="${escapeHtml(p.sku)}">${locationOptionsHtml(normalizeLocationName(p.location))}</select><select class="mini-input product-status" data-field="status" data-sku="${escapeHtml(p.sku)}"><option${p.status === 'Available' ? ' selected' : ''}>Available</option><option${p.status === 'Low Stock' ? ' selected' : ''}>Low Stock</option><option${p.status === 'Reserved' ? ' selected' : ''}>Reserved</option><option${p.status === 'Unavailable' ? ' selected' : ''}>Unavailable</option></select></td>
    <td><div class="row-actions"><button class="icon-btn" data-save-product="${escapeHtml(p.sku)}" title="Save"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button><button class="icon-btn danger" data-delete-product="${escapeHtml(p.sku)}" title="Delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></div></td>
  </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-faint)">No products found</td></tr>';
  const pageInfo = document.getElementById('productPageInfo');
  if (pageInfo) pageInfo.textContent = filtered.length ? `Showing ${pageData.start + 1}-${pageData.end} of ${filtered.length} products` : '0 products';
  renderPagination('productPagination', pageData.page, pageData.totalPages, filtered.length, 'changeProductPage');
  document.querySelectorAll('.product-category-select').forEach(select => select.addEventListener('change', () => {
    const sku = select.dataset.sku;
    const brandSelect = document.querySelector(`.product-brand-select[data-sku="${CSS.escape(sku)}"]`);
    if (brandSelect) brandSelect.innerHTML = brandOptionsHtml(select.value, brandSelect.value);
  }));
  document.querySelectorAll('[data-save-product]').forEach(btn => btn.addEventListener('click', async () => {
    const sku = btn.dataset.saveProduct;
    const fields = [...document.querySelectorAll(`[data-sku="${CSS.escape(sku)}"]`)];
    const payload = {};
    fields.forEach(field => { payload[field.dataset.field] = field.value; });
    await api('/api/products/' + encodeURIComponent(sku), { method: 'PATCH', body: JSON.stringify(payload) });
    await loadProducts(document.getElementById('productSearch').value.trim());
    updateInventoryDashboardStats();
    updateProductBrandFilter();
    renderProducts();
    showToast('Product updated');
  }));
  document.querySelectorAll('[data-delete-product]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/api/products/' + encodeURIComponent(btn.dataset.deleteProduct), { method: 'DELETE' });
    await loadProducts(document.getElementById('productSearch').value.trim());
    updateInventoryDashboardStats();
    updateProductBrandFilter();
    renderProducts();
    showToast('Product deleted');
  }));
}

window.changeProductPage = page => {
  productPage = page;
  renderProducts();
};

async function bindInventory() {
  await loadProducts();
  updateInventoryDashboardStats();
  updateProductBrandFilter();
  bindConnectedCategoryBrand('pCategory', 'pBrand');
  renderProducts();
  document.getElementById('productSearch').addEventListener('input', async e => {
    productPage = 1;
    await loadProducts(e.target.value.trim());
    updateInventoryDashboardStats();
    updateProductBrandFilter();
    renderProducts();
  });
  document.getElementById('productCategoryFilter')?.addEventListener('change', () => {
    productPage = 1;
    updateProductBrandFilter();
    renderProducts();
  });
  document.getElementById('productBrandFilter')?.addEventListener('change', () => { productPage = 1; renderProducts(); });
  document.getElementById('productLocationFilter')?.addEventListener('change', () => { productPage = 1; renderProducts(); });
  document.getElementById('addProductBtn').addEventListener('click', async () => {
    const payload = productPayloadFromForm('p');
    try {
      await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      ['pSku','pName','pBrand','pCategory','pStock','pPrice'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('pCategory').value = 'Laptop';
      document.getElementById('pBrand').innerHTML = brandOptionsHtml('Laptop', 'Dell');
      document.getElementById('pLocation').value = 'Dubai';
      document.getElementById('pStatus').value = 'Available';
      await loadProducts();
      updateInventoryDashboardStats();
      updateProductBrandFilter();
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
      productPage = 1;
      updateInventoryDashboardStats();
      updateProductBrandFilter();
      renderProducts();
      renderImportAlert(result);
      showToast(`${result.imported} products imported${result.skipped?.length ? ` · ${result.skipped.length} skipped` : ''}`);
    } catch (e) { showToast(e.message); }
  });
}

function renderReports() {
  setActiveNav('Reports');
  clearActiveSidebar();
  const revenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const byService = [...new Set(orders.map(o => o.service))].map(service => ({ service, count: orders.filter(o => o.service === service).length, amount: orders.filter(o => o.service === service).reduce((s, o) => s + Number(o.amount || 0), 0) }));
  document.querySelector('.main').innerHTML = `<div class="page-header"><div><div class="page-title">Reports</div><div class="page-sub">Live totals from saved order data</div></div></div><div class="stats-grid"><div class="stat-card c-blue"><div class="stat-val">${orders.length}</div><div class="stat-lbl">Orders</div></div><div class="stat-card c-green"><div class="stat-val">${revenue.toLocaleString()}</div><div class="stat-lbl">Revenue AED</div></div><div class="stat-card c-amber"><div class="stat-val">${orders.filter(o => o.status === 'Pending').length}</div><div class="stat-lbl">Pending</div></div><div class="stat-card c-purple"><div class="stat-val">${products.length}</div><div class="stat-lbl">Products</div></div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">Service Performance</div><div class="panel-sub">Order count and revenue by vertical</div></div></div><div class="order-table-wrap"><table><thead><tr><th>Service</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>${byService.map(r => `<tr><td><span class="svc-badge ${svcBadgeClass(r.service)}">${r.service}</span></td><td>${r.count}</td><td><span class="amount-val">AED ${r.amount.toLocaleString()}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderSimpleSection(title, subtitle, rows) {
  document.querySelector('.main').innerHTML = `<div class="page-header"><div><div class="page-title">${title}</div><div class="page-sub">${subtitle}</div></div></div><div class="panel"><div class="order-table-wrap"><table><thead><tr><th>Name</th><th>Detail</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr><td><div class="cust-name">${escapeHtml(r[0])}</div></td><td>${escapeHtml(r[1])}</td><td><span class="status-badge s-Completed">${escapeHtml(r[2])}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderCustomers() {
  setActiveNav('');
  setActiveSidebar('Customers');
  const seen = new Map();
  orders.forEach(o => { if (!seen.has(o.phone)) seen.set(o.phone, [o.customer, o.phone, `${orders.filter(x => x.phone === o.phone).length} orders`]); });
  renderSimpleSection('Customers', 'Customer book generated from saved orders', [...seen.values()]);
}

function renderPayments() {
  setActiveNav('');
  setActiveSidebar('Payments');
  renderSimpleSection('Payments', 'Payment modes from saved orders', [...new Set(orders.map(o => o.payment))].map(mode => [mode, `AED ${orders.filter(o => o.payment === mode).reduce((s, o) => s + Number(o.amount || 0), 0).toLocaleString()}`, 'Tracked']));
}

function renderIntegrations() {
  setActiveNav('Integrations');
  clearActiveSidebar();
  const latestEmail = notifications.find(n => n.channel === 'email');
  const latestWhatsApp = notifications.find(n => n.channel === 'whatsapp');
  renderSimpleSection('Integrations', 'Local OMS services and warehouse notification status', [
    ['SQLite Database', 'data/rekart.db', 'Connected'],
    ['Orders API', '/api/orders', 'Live'],
    ['Products API', '/api/products', 'Live'],
    ['Agents API', '/api/agents', 'Live'],
    ['Warehouse Email', latestEmail ? `${latestEmail.recipient} - ${latestEmail.status}` : 'sales@scalify.ae - waiting for first order alert', 'Primary'],
    ['WhatsApp Fallback Link', latestWhatsApp ? `${latestWhatsApp.recipient} - ${latestWhatsApp.status}` : '+971545192005 - waiting for first order alert', 'Fallback']
  ]);
}

function renderSettings() {
  setActiveNav('');
  setActiveSidebar('Settings');
  renderSimpleSection('Settings', 'Operational configuration', [['Default Location', 'Dubai', 'Active'], ['Warehouse Location', 'Sharjah WH', 'Active'], ['Staff Database', `${agents.length} members`, 'Active'], ['Inventory Database', `${products.length} products`, 'Active']]);
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', e => {
    e.preventDefault();
    const label = item.textContent.trim();
    if (label === 'Dashboard') renderDashboard();
    if (label === 'Orders') renderOrderDesk('Orders');
    if (label === 'Inventory') renderInventory();
    if (label === 'Reports') renderReports();
    if (label === 'Integrations') renderIntegrations();
  }));
  document.querySelectorAll('.sidebar-item').forEach(item => item.addEventListener('click', () => {
    const label = getSidebarLabel(item);
    const services = ['Buy','Sell','Repair','Trade-In','Insurance','Rent','Recycle'];
    if (services.includes(label)) {
      activeService = label;
      renderOrderDesk('Orders');
      setActiveSidebar(label);
      const filter = document.querySelectorAll('.filter-select')[0];
      if (filter) { filter.value = label; renderTable(); }
      return;
    }
    if (label === 'Customers') renderCustomers();
    if (label === 'Payments') renderPayments();
    if (label === 'Settings') renderSettings();
  }));
}

function exportCsv() {
  if (!orders.length) { showToast('No orders to export'); return; }
  const headers = ['ID','Service','Customer','Phone','Device','Serial Number','Amount (AED)','Payment','Agent','Location','Status','Date','Notes'];
  const rows = orders.map(o => [o.id, o.service, o.customer, o.phone, o.device, o.serial_number || '', o.amount, o.payment, o.agent, o.location, o.status, o.date, o.notes]);
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
  renderDashboard();
}

init().catch(e => showToast(e.message));
