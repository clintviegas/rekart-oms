import { tenantApiHeaders } from '@/lib/tenant';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...tenantApiHeaders(),
    ...(options.headers as Record<string, string>)
  };
  if (csrfToken && options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && path !== '/api/auth/login' && !path.includes('/auth/2fa')) {
    const refreshed = await refreshSession().catch(() => false);
    if (refreshed) {
      return api<T>(path, options);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

async function refreshSession() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
  const data = await res.json();
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  return true;
}

export async function ensureCsrf() {
  try {
    const data = await api<{ csrfToken: string }>('/api/auth/csrf');
    setCsrfToken(data.csrfToken);
  } catch {
    /* not logged in */
  }
}

export async function login(email: string, password: string) {
  const data = await api<{
    ok: boolean;
    requires2fa?: boolean;
    pendingToken?: string;
    user?: unknown;
    tenant?: unknown;
    token?: string;
    csrfToken?: string;
  }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  return data;
}

export async function verify2faLogin(pendingToken: string, code: string) {
  const data = await api<{ ok: boolean; csrfToken: string }>('/api/auth/2fa/verify-login', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, code })
  });
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  return data;
}

export async function loginWithGoogle(credential: string) {
  const data = await api<{
    ok: boolean;
    requires2fa?: boolean;
    pendingToken?: string;
    csrfToken?: string;
  }>('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  return data;
}

export async function forgotPassword(email: string) {
  return api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(email: string, token: string, newPassword: string) {
  return api('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, token, newPassword })
  });
}

export async function setup2fa() {
  return api<{ secret: string; qrDataUrl: string }>('/api/auth/2fa/setup', { method: 'POST' });
}

export async function enable2fa(code: string) {
  return api('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function disable2fa(code: string) {
  return api('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  setCsrfToken(null);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchOrderSummary() {
  return api<{ total: number; counts: Record<string, number> }>('/api/orders/summary');
}

export async function fetchOrderStats(params?: { from?: string; to?: string }) {
  return api<import('@/lib/types').OrderStats>(`/api/orders/stats${buildQuery(params || {})}`);
}

export async function fetchRecentOrders(limit = 6) {
  return api<import('@/lib/types').Order[]>(`/api/orders/recent${buildQuery({ limit })}`);
}

export async function fetchOrders(params: {
  page?: number;
  limit?: number;
  service?: string;
  status?: string;
  location?: string;
  search?: string;
  from?: string;
  to?: string;
}) {
  return api<import('@/lib/types').PaginatedResponse<import('@/lib/types').Order>>(
    `/api/orders${buildQuery(params)}`
  );
}

export async function fetchAllProducts() {
  return api<import('@/lib/types').Product[]>('/api/products/all');
}

export async function fetchProducts(params: { page?: number; limit?: number; search?: string }) {
  return api<import('@/lib/types').PaginatedResponse<import('@/lib/types').Product>>(
    `/api/products${buildQuery(params)}`
  );
}

export async function fetchNotifications() {
  return api<import('@/lib/types').Notification[]>('/api/notifications');
}

export async function fetchCustomers() {
  return api<import('@/lib/types').Customer[]>('/api/customers');
}

export async function updateCustomer(phone: string, data: { notes?: string; tags?: string[]; name?: string }) {
  return api(`/api/customers/${encodeURIComponent(phone)}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export async function fetchCustomerOrders(phone: string) {
  return api<{ id: string; service: string; amount: number; status: string; date?: string }[]>(
    `/api/customers/${encodeURIComponent(phone)}/orders`
  );
}

export async function fetchSettings() {
  return api<{
    settings: import('@/lib/types').AppSettings;
    stats: { agents: number; products: number };
    tenant?: {
      plan: string;
      usage: { ordersThisMonth: number };
      branding?: { logoUrl?: string; primaryColor?: string };
      name?: string;
    };
  }>('/api/settings');
}

export async function fetchAudit(limit = 50) {
  return api(`/api/notifications/audit${buildQuery({ limit })}`);
}

export async function fetchReportsSummary(from?: string, to?: string) {
  return api<{
    totalOrders: number;
    revenue: number;
    pending: number;
    completed: number;
    byService: Record<string, { count: number; amount: number }>;
  }>(`/api/reports/summary${buildQuery({ from, to })}`);
}

export async function fetchBillingPlan() {
  return api<{
    plan: string;
    limits: { ordersPerMonth: number; users: number };
    usage: { ordersThisMonth: number };
    stripeConfigured: boolean;
  }>('/api/billing/plan');
}

export async function startCheckout() {
  return api<{ url: string }>('/api/billing/checkout', { method: 'POST' });
}

export async function openBillingPortal() {
  return api<{ url: string }>('/api/billing/portal', { method: 'POST' });
}

export async function updateBranding(data: { logoUrl?: string; primaryColor?: string }) {
  return api<{ branding: { logoUrl?: string; primaryColor?: string } }>('/api/settings/branding', {
    method: 'PATCH',
    body: JSON.stringify(data)
  }).then(r => r.branding);
}

export async function retryNotification(id: number) {
  return api<{ id: number; status: string }>(`/api/notifications/${id}/retry`, { method: 'POST' });
}

export async function sendTestEmail() {
  return api<{ ok: boolean; status: string }>('/api/notifications/test-email', { method: 'POST' });
}

export async function updateSettings(settings: Record<string, string>) {
  return api('/api/settings', { method: 'PATCH', body: JSON.stringify({ settings }) });
}

export function invoiceUrl(orderId: string) {
  return `/api/orders/${encodeURIComponent(orderId)}/invoice`;
}
