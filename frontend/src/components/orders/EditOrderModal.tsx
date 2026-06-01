'use client';

import { useState } from 'react';
import type { Order } from '@/lib/types';
import { LOCATION_OPTIONS, PAYMENT_MODES, SVC_EXTRAS, STATUSES, STATUS_COLORS, normalizeLocation } from '@/lib/constants';
import { orderInputClass, orderLabelClass } from '@/lib/order-utils';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export function EditOrderModal({
  order,
  agents,
  onClose,
  onSave
}: {
  order: Order;
  agents: string[];
  onClose: () => void;
  onSave: (payload: Partial<Order>) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [customer, setCustomer] = useState(order.customer);
  const [phone, setPhone] = useState(order.phone);
  const [device, setDevice] = useState(order.device);
  const [amount, setAmount] = useState(String(order.amount ?? 0));
  const [payment, setPayment] = useState(order.payment);
  const [agent, setAgent] = useState(order.agent);
  const [location, setLocation] = useState(normalizeLocation(order.location));
  const [serialNumber, setSerialNumber] = useState(order.serial_number || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);

  const itemsTotal = (order.items || []).reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0
  );

  async function handleSave() {
    const required = [
      [customer, 'Customer is required'],
      [phone, 'Phone is required'],
      [device, 'Device summary is required'],
      [amount, 'Amount is required'],
      [payment, 'Payment is required'],
      [agent, 'Handled by is required'],
      [location, 'Location is required']
    ] as const;
    for (const [val, msg] of required) {
      if (!String(val || '').trim()) {
        showToast(msg);
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        customer: customer.trim(),
        phone: phone.trim(),
        device: device.trim(),
        amount: parseFloat(amount) || 0,
        payment,
        agent,
        location,
        serial_number: serialNumber.trim(),
        notes: notes.trim(),
        status
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-navy/10 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="font-mono text-xs text-faint">{order.id}</p>
            <h2 className="text-lg font-semibold text-navy">
              {order.customer} — {order.service}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl px-2 py-1 text-xl text-muted hover:bg-surface">
            ×
          </button>
        </div>

        <div className="sidebar-scroll overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={orderLabelClass()}>Customer</label>
              <input className={orderInputClass()} value={customer} onChange={e => setCustomer(e.target.value)} />
            </div>
            <div>
              <label className={orderLabelClass()}>Phone</label>
              <input className={orderInputClass()} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className={orderLabelClass()}>Items</label>
              {order.items?.length ? (
                <div className="rounded-2xl border border-navy/10 bg-surface/50 p-3 text-sm">
                  {order.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 border-b border-navy/5 py-2 last:border-0">
                      <div>
                        <span className="font-medium text-navy">{it.name}</span>
                        {it.sku && <span className="ml-2 font-mono text-xs text-faint">{it.sku}</span>}
                      </div>
                      <span className="text-muted">×{it.qty}</span>
                      <span className="font-semibold">AED {Number(it.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-navy/10 pt-2 text-sm font-semibold text-navy">
                    <span>Items subtotal</span>
                    <span>AED {itemsTotal.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No line items recorded</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className={orderLabelClass()}>Device Summary</label>
              <input className={orderInputClass()} value={device} onChange={e => setDevice(e.target.value)} />
            </div>

            <div>
              <label className={orderLabelClass()}>Amount AED</label>
              <input type="number" className={orderInputClass()} value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className={orderLabelClass()}>Payment</label>
              <select className={orderInputClass()} value={payment} onChange={e => setPayment(e.target.value)}>
                {PAYMENT_MODES.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={orderLabelClass()}>Handled By</label>
              <select className={orderInputClass()} value={agent} onChange={e => setAgent(e.target.value)}>
                <option value="">Select staff member</option>
                {agents.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={orderLabelClass()}>Location</label>
              <select className={orderInputClass()} value={location} onChange={e => setLocation(e.target.value)}>
                {LOCATION_OPTIONS.map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={orderLabelClass()}>Warehouse Serial Number</label>
              <input
                className={orderInputClass()}
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="Enter serial number while packing"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={orderLabelClass()}>Notes</label>
              <textarea
                className={cn(orderInputClass(), 'min-h-[80px] resize-y')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Accessories, condition, packing notes"
              />
            </div>

            {(SVC_EXTRAS[order.service] || []).map(f => (
              <div key={f.key}>
                <label className={orderLabelClass()}>{f.label}</label>
                <p className="rounded-xl border border-navy/10 bg-surface/50 px-3 py-2.5 text-sm text-navy">
                  {order.extras?.[f.key] || '—'}
                </p>
              </div>
            ))}

            <div className="sm:col-span-2">
              <label className={orderLabelClass()}>Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      status === s
                        ? cn(STATUS_COLORS[s], 'border-transparent ring-2 ring-brand/30')
                        : 'border-navy/15 bg-white text-muted hover:border-navy/30'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-navy/10 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
