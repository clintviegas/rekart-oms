'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, fetchOrders } from '@/lib/api';
import { useAgents, useAllProducts, useOrders, useOrderStats } from '@/lib/queries';
import type { Order, OrderItem, Product } from '@/lib/types';
import {
  LOCATION_OPTIONS,
  PAYMENT_MODES,
  SERVICES,
  SVC_COLORS,
  SVC_EXTRAS,
  STATUSES,
  STATUS_COLORS,
  normalizeLocation,
  type Service
} from '@/lib/constants';
import { Badge, Panel, StatCard, STAT_ICONS } from '@/components/ui/Badge';
import { StaffModal } from '@/components/StaffModal';
import { PageHeader } from '@/components/layout/Shell';
import { PhoneInput, fullPhone } from '@/components/ui/PhoneInput';
import { DEFAULT_PHONE_CODE } from '@/lib/phone-codes';
import { useMe } from '@/lib/queries';
import { queueOrder, flushQueue, isOnline } from '@/lib/offline-queue';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { orderInputClass, orderLabelClass } from '@/lib/order-utils';
import { LineItemRow } from '@/components/orders/LineItemRow';
import { EditOrderModal } from '@/components/orders/EditOrderModal';
import { blankItem, SVC_COND_LABEL, type FormItem } from '@/components/orders/types';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

const PAGE_SIZE = 50;

function OrdersPageContent() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: products = [] } = useAllProducts();
  const { data: agents = [] } = useAgents();
  const { data: stats } = useOrderStats();

  const [activeService, setActiveService] = useState<Service>('Buy');
  const [formItems, setFormItems] = useState<FormItem[]>([blankItem()]);
  const [customerName, setCustomerName] = useState('');
  const { data: meData } = useMe();
  const canWrite = meData?.user?.role !== 'warehouse';
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_CODE);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [payment, setPayment] = useState<string>(PAYMENT_MODES[0]);
  const [status, setStatus] = useState<string>('Pending');
  const [agent, setAgent] = useState('');
  const [location, setLocation] = useState<string>(LOCATION_OPTIONS[0]);
  const [notes, setNotes] = useState('');
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [orderPage, setOrderPage] = useState(1);

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const [formHighlight, setFormHighlight] = useState(false);

  const scrollToOrderForm = useCallback(() => {
    const el = formRef.current;
    if (!el) return;

    const main = el.closest('main');
    if (main) {
      const mainRect = main.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetTop =
        elRect.top - mainRect.top + main.scrollTop - main.clientHeight / 2 + elRect.height / 2;
      main.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setFormHighlight(true);
    window.setTimeout(() => setFormHighlight(false), 2600);
    window.setTimeout(() => {
      document.getElementById('customerName')?.focus({ preventScroll: true });
    }, 450);
  }, []);

  const orderQueryParams = useMemo(
    () => ({
      page: orderPage,
      limit: PAGE_SIZE,
      service: filterService || undefined,
      status: filterStatus || undefined,
      location: filterLocation || undefined,
      search: search.trim() || undefined
    }),
    [orderPage, filterService, filterStatus, filterLocation, search]
  );

  const { data: ordersResponse, isLoading: loading } = useOrders(orderQueryParams);
  const orders = ordersResponse?.data || [];
  const pagination = ordersResponse?.pagination;

  const invalidateOrders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  const itemsSubtotal = useMemo(
    () => formItems.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0),
    [formItems]
  );

  useEffect(() => {
    const svc = searchParams.get('service');
    if (svc && (SERVICES as readonly string[]).includes(svc)) {
      setActiveService(svc as Service);
      setFilterService(svc);
    }
  }, [searchParams]);

  useEffect(() => {
    if (itemsSubtotal > 0 && !amountTouched) {
      setAmount(String(itemsSubtotal));
    }
  }, [itemsSubtotal, amountTouched]);

  useEffect(() => {
    setExtras({});
  }, [activeService]);

  useEffect(() => {
    if (!canWrite) return;
    flushQueue(async payload => {
      await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    }).then(n => {
      if (n > 0) {
        invalidateOrders();
        showToast(`${n} offline order(s) synced`);
      }
    });
  }, [canWrite, invalidateOrders, showToast]);

  useEffect(() => {
    setOrderPage(1);
  }, [search, filterService, filterStatus, filterLocation]);

  const pending = stats?.pending || 0;
  const completed = stats?.completed || 0;
  const revenue = stats?.revenue || 0;
  const completionRate = stats?.total ? Math.round((completed / stats.total) * 100) : 0;
  const totalOrders = stats?.total || 0;

  const pageStart = pagination ? (pagination.page - 1) * pagination.limit : 0;
  const pageEnd = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : orders.length;

  function selectService(svc: Service) {
    setActiveService(svc);
    router.replace(`/orders?service=${encodeURIComponent(svc)}`, { scroll: false });
  }

  function updateFormItem(id: number, updated: FormItem) {
    setFormItems(items => items.map(it => (it._id === id ? updated : it)));
  }

  function resetForm() {
    setCustomerName('');
    setPhoneDigits('');
    setAmount('');
    setAmountTouched(false);
    setPayment(PAYMENT_MODES[0]);
    setStatus('Pending');
    setAgent('');
    setLocation(LOCATION_OPTIONS[0]);
    setNotes('');
    setExtras({});
    setFormItems([blankItem()]);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errors: Record<string, boolean> = {};
    const msgs: string[] = [];

    if (!customerName.trim()) {
      errors.customerName = true;
      msgs.push('Customer name is required');
    }
    const digits = phoneDigits.replace(/\D/g, '');
    if (!digits) {
      errors.phone = true;
      msgs.push('Phone is required');
    } else if (digits.length < 5 || digits.length > 15) {
      errors.phone = true;
      msgs.push('Enter a valid phone number');
    }
    if (!amount.trim()) {
      errors.amount = true;
      msgs.push('Amount is required');
    }
    if (!payment) {
      errors.payment = true;
      msgs.push('Payment mode is required');
    }
    if (!status) {
      errors.status = true;
      msgs.push('Status is required');
    }
    if (!agent) {
      errors.agent = true;
      msgs.push('Handled by is required');
    }
    if (!location) {
      errors.location = true;
      msgs.push('Location is required');
    }

    formItems.forEach((it, i) => {
      if (!it.name.trim()) {
        errors[`item-${it._id}-name`] = true;
        msgs.push(`Item ${i + 1} name is required`);
      }
      if (!it.qty || it.qty <= 0) {
        errors[`item-${it._id}-qty`] = true;
        msgs.push(`Item ${i + 1} quantity is required`);
      }
      if (it.price === undefined || it.price < 0) {
        errors[`item-${it._id}-price`] = true;
        msgs.push(`Item ${i + 1} price is required`);
      }
    });

    const svcExtras = SVC_EXTRAS[activeService] || [];
    svcExtras.forEach(f => {
      if (!String(extras[f.key] || '').trim()) {
        errors[`extra-${f.key}`] = true;
        msgs.push(`${f.label} is required`);
      }
    });

    setFormErrors(errors);
    if (msgs.length) {
      showToast(msgs[0]);
      return false;
    }
    return true;
  }

  async function submitOrder() {
    if (!validateForm()) return;
    const items: OrderItem[] = formItems
      .map(it => ({
        sku: it.sku,
        name: it.name.trim(),
        brand: it.brand,
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0
      }))
      .filter(it => it.name);

    const payload = {
      service: activeService,
      customer: customerName.trim(),
      phone: fullPhone(phoneCountry, phoneDigits),
      items,
      amount: parseFloat(amount) || 0,
      payment,
      status,
      agent,
      location,
      notes: notes.trim(),
      extras
    };

    setSubmitting(true);
    try {
      if (!isOnline()) {
        await queueOrder(payload);
        resetForm();
        showToast('Offline — order saved locally, will sync when online');
        return;
      }
      const created = await api<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await invalidateOrders();
      resetForm();
      showToast(`Order ${created.id} punched`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  async function cycleStatus(order: Order, e: React.MouseEvent) {
    e.stopPropagation();
    const cur = STATUSES.indexOf(order.status as (typeof STATUSES)[number]);
    const next = STATUSES[(cur + 1) % STATUSES.length];
    try {
      await api(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next })
      });
      invalidateOrders();
      showToast(`Status updated to ${next}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function deleteOrder(order: Order, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete order ${order.id} for ${order.customer}?`)) return;
    try {
      await api(`/api/orders/${encodeURIComponent(order.id)}`, { method: 'DELETE' });
      invalidateOrders();
      showToast('Order deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function saveOrderEdit(payload: Partial<Order>) {
    if (!editOrder) return;
    try {
      await api(`/api/orders/${encodeURIComponent(editOrder.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      invalidateOrders();
      showToast('Order updated');
      setEditOrder(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed');
      throw err;
    }
  }

  async function exportCsv() {
    try {
      const result = await fetchOrders({
        limit: 1000,
        service: filterService || undefined,
        status: filterStatus || undefined,
        location: filterLocation || undefined,
        search: search.trim() || undefined
      });
      const exportRows = result.data;
      if (!exportRows.length) {
        showToast('No orders to export');
        return;
      }
    const headers = [
      'ID',
      'Service',
      'Customer',
      'Phone',
      'Device',
      'Serial Number',
      'Amount (AED)',
      'Payment',
      'Agent',
      'Location',
      'Status',
      'Date',
      'Notes'
    ];
    const rows = exportRows.map(o => [
      o.id,
      o.service,
      o.customer,
      o.phone,
      o.device,
      o.serial_number || '',
      o.amount,
      o.payment,
      o.agent,
      o.location,
      o.status,
      o.date,
      o.notes || ''
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'rekart_orders.csv';
    a.click();
    showToast('CSV exported');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed');
    }
  }

  const svcExtras = SVC_EXTRAS[activeService];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StaffModal
        open={staffOpen}
        agents={agents}
        onClose={() => setStaffOpen(false)}
        onUpdated={async () => {
          invalidateOrders();
          queryClient.invalidateQueries({ queryKey: ['agents'] });
        }}
      />

      <PageHeader
        title="Offline Order Desk"
        subtitle="Punch walk-in and field orders across all 7 service verticals"
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm font-medium text-muted hover:border-navy/30 sm:flex-none sm:px-4"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button
              type="button"
              onClick={scrollToOrderForm}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-sm font-medium text-white hover:bg-navy-mid sm:flex-none sm:px-4"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Order
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard accent="brand" icon={STAT_ICONS.orders} label="Total Orders" value={totalOrders.toLocaleString()} meta="All time" />
        <StatCard accent="green" icon={STAT_ICONS.revenue} label="Revenue (AED)" value={revenue.toLocaleString()} meta="From punched orders" />
        <StatCard accent="amber" icon={STAT_ICONS.pending} label="Pending" value={pending.toLocaleString()} meta="Awaiting action" />
        <StatCard
          accent="purple"
          icon={STAT_ICONS.completed}
          label="Completed"
          value={completed.toLocaleString()}
          metaNode={
            <>
              <span className="font-medium text-green-600">{completionRate}%</span> completion rate
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Order form (left) ── */}
        <div
          ref={formRef}
          className={cn(
            'rounded-3xl transition-all duration-500',
            formHighlight && 'ring-4 ring-brand/45 ring-offset-4 ring-offset-surface shadow-lg shadow-brand/10'
          )}
        >
        <Panel title="Punch New Order" subtitle="Walk-in · Field · Workshop">
          {formHighlight && (
            <div className="mx-4 mt-3 rounded-xl border border-brand/25 bg-brand-pale/80 px-4 py-2.5 text-sm font-medium text-brand sm:mx-6">
              ↓ Fill customer details here to punch a new order
            </div>
          )}
          <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
            {/* Service tabs */}
            <div className="scroll-x-touch -mx-1 flex gap-1.5 px-1 pb-1">
              {SERVICES.map(svc => (
                <button
                  key={svc}
                  type="button"
                  onClick={() => selectService(svc)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:py-1.5',
                    activeService === svc
                      ? cn(SVC_COLORS[svc], 'shadow-sm')
                      : 'border-navy/10 bg-white text-muted hover:border-navy/20 hover:text-navy'
                  )}
                >
                  {svc}
                </button>
              ))}
            </div>

            {/* Customer */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={orderLabelClass()}>Customer Name</label>
                <input
                  id="customerName"
                  className={orderInputClass(formErrors.customerName)}
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className={orderLabelClass()}>Phone</label>
                <PhoneInput
                  countryCode={phoneCountry}
                  digits={phoneDigits}
                  onCountryCodeChange={setPhoneCountry}
                  onDigitsChange={setPhoneDigits}
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={orderLabelClass()}>Devices / Items</label>
                <span className="text-[10px] font-normal normal-case text-faint">type to search · qty defaults to 1</span>
              </div>
              <div className="space-y-2">
                {formItems.map(item => (
                  <LineItemRow
                    key={item._id}
                    item={item}
                    products={products}
                    solo={formItems.length === 1}
                    onChange={updated => updateFormItem(item._id, updated)}
                    onRemove={() => {
                      if (formItems.length <= 1) return;
                      setFormItems(items => items.filter(it => it._id !== item._id));
                    }}
                    errors={{
                      name: formErrors[`item-${item._id}-name`],
                      qty: formErrors[`item-${item._id}-qty`],
                      price: formErrors[`item-${item._id}-price`]
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFormItems(items => [...items, blankItem()])}
                className="mt-2 rounded-xl border border-dashed border-brand/35 px-3 py-2 text-xs font-semibold text-brand hover:border-brand hover:bg-brand-pale/50"
              >
                + Add another item
              </button>
              {itemsSubtotal > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-navy px-4 py-2.5 text-sm text-white">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Subtotal</span>
                  <strong className="text-base font-semibold tabular-nums">AED {itemsSubtotal.toLocaleString()}</strong>
                </div>
              )}
            </div>

            {/* Service-specific extras */}
            {svcExtras && (
              <div className="rounded-2xl border border-navy/10 bg-surface/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {SVC_COND_LABEL[activeService] || `${activeService} Details`}
                </p>
                <div className={cn('grid gap-4', svcExtras.length > 1 && 'sm:grid-cols-2')}>
                  {svcExtras.map(f => (
                    <div key={f.key}>
                      <label className={orderLabelClass()}>{f.label}</label>
                      {f.type === 'select' ? (
                        <select
                          className={orderInputClass(formErrors[`extra-${f.key}`])}
                          value={extras[f.key] || f.opts?.[0] || ''}
                          onChange={e => setExtras(prev => ({ ...prev, [f.key]: e.target.value }))}
                        >
                          {(f.opts || []).map(o => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type || 'text'}
                          className={orderInputClass(formErrors[`extra-${f.key}`])}
                          value={extras[f.key] || ''}
                          onChange={e => setExtras(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.label}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amount & payment row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={orderLabelClass()}>Amount (AED)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={orderInputClass(formErrors.amount)}
                  value={amount}
                  onChange={e => {
                    setAmountTouched(true);
                    setAmount(e.target.value);
                  }}
                />
              </div>
              <div>
                <label className={orderLabelClass()}>Payment Mode</label>
                <select
                  className={orderInputClass(formErrors.payment)}
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                >
                  {PAYMENT_MODES.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={orderLabelClass()}>Status</label>
                <select
                  className={orderInputClass(formErrors.status)}
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={orderLabelClass()}>Handled By</label>
                <div className="flex gap-2">
                  <select
                    className={cn(orderInputClass(formErrors.agent), 'min-w-0 flex-1')}
                    value={agent}
                    onChange={e => setAgent(e.target.value)}
                  >
                    <option value="">Select staff member</option>
                    {agents.map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setStaffOpen(true)}
                    title="Manage staff"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-navy/15 bg-white text-muted hover:border-brand hover:bg-brand-pale hover:text-brand"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className={orderLabelClass()}>Location</label>
                <select
                  className={orderInputClass(formErrors.location)}
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                >
                  {LOCATION_OPTIONS.map(l => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={orderLabelClass()}>Notes</label>
              <textarea
                className={cn(orderInputClass(), 'min-h-[72px] resize-y')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Accessories, condition, special instructions…"
              />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={submitOrder}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy py-3 text-sm font-semibold text-white shadow-md transition hover:bg-navy-mid disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {submitting ? 'Punching order…' : 'Punch Order'}
            </button>
          </div>
        </Panel>
        </div>

        {/* ── Order table (right) ── */}
        <Panel
          title="Order Log"
          subtitle={`${pagination?.total || 0} total · ${pending} pending`}
          action={
            <span className="hidden text-xs text-faint sm:inline">
              {pagination?.total
                ? `Showing ${pageStart + 1}-${pageEnd} of ${pagination.total}`
                : '0 orders'}
            </span>
          }
        >
          <div className="space-y-3 border-b border-navy/10 px-4 py-3 sm:px-6">
            <input
              type="search"
              className={orderInputClass()}
              placeholder="Search order ID, customer, phone, device, serial…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                className={orderInputClass()}
                value={filterService}
                onChange={e => setFilterService(e.target.value)}
              >
                <option value="">All services</option>
                {SERVICES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className={orderInputClass()}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className={orderInputClass()}
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
              >
                <option value="">All locations</option>
                {LOCATION_OPTIONS.map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="scroll-x-touch">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="hidden px-4 py-3 md:table-cell">Device</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Serial No.</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.length ? (
                  orders.map(order => (
                    <tr
                      key={order.id}
                      className="cursor-pointer border-b border-navy/5 transition hover:bg-surface/80"
                      onClick={() => setEditOrder(order)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-faint">{order.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy">{order.customer}</div>
                        <div className="text-xs text-faint">{order.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={SVC_COLORS[order.service]}>{order.service}</Badge>
                      </td>
                      <td className="hidden max-w-[140px] truncate px-4 py-3 text-muted md:table-cell">
                        {order.device}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-faint lg:table-cell">
                        {order.serial_number || 'Pending'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-navy">
                        AED {Number(order.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-faint sm:table-cell">{order.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Cycle status"
                            onClick={e => cycleStatus(order, e)}
                            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-brand"
                          >
                            ↻
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={e => deleteOrder(order, e)}
                            className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted">
                      No orders match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(pagination?.total || 0) > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-navy/10 px-4 py-4 sm:flex-row sm:px-6">
              <p className="text-xs text-faint">
                Showing {pageStart + 1}-{pageEnd} of {pagination?.total || 0} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={(pagination?.page || 1) <= 1}
                  onClick={() => setOrderPage(p => p - 1)}
                  className="rounded-xl border border-navy/15 px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-muted">
                  Page {pagination?.page || 1} of {pagination?.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={(pagination?.page || 1) >= (pagination?.totalPages || 1)}
                  onClick={() => setOrderPage(p => p + 1)}
                  className="rounded-xl border border-navy/15 px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {editOrder && (
        <EditOrderModal
          order={editOrder}
          agents={agents}
          onClose={() => setEditOrder(null)}
          onSave={saveOrderEdit}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted">Loading order desk…</p>
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
