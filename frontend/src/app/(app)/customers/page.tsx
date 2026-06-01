'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCustomers, updateCustomer, fetchCustomerOrders } from '@/lib/api';

type Customer = {
  _id: string;
  phone: string;
  name: string;
  notes?: string;
  tags?: string[];
  orderCount: number;
  totalSpent: number;
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers
  });

  const { data: history = [] } = useQuery({
    queryKey: ['customer-orders', selected?.phone],
    queryFn: () => fetchCustomerOrders(selected!.phone),
    enabled: Boolean(selected?.phone)
  });

  async function saveNotes() {
    if (!selected) return;
    await updateCustomer(selected.phone, { notes });
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="CRM with notes, tags, and order history" />

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Customer Directory" subtitle={`${customers.length} customers`}>
          <div className="scroll-x-touch max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Orders</th>
                </tr>
              </thead>
              <tbody>
                {(customers as Customer[]).map(c => (
                  <tr
                    key={c.phone}
                    className="cursor-pointer border-b border-navy/5 hover:bg-surface/80"
                    onClick={() => {
                      setSelected(c);
                      setNotes(c.notes || '');
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                    <td className="px-4 py-3 text-muted">{c.phone}</td>
                    <td className="px-4 py-3 font-semibold">{c.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="xl:col-span-2 space-y-6">
          {selected ? (
            <>
              <Panel title={selected.name} subtitle={selected.phone}>
                <div className="space-y-4 px-4 py-4 sm:px-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-faint">Total spent</p>
                      <p className="font-semibold text-navy">AED {Number(selected.totalSpent || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-faint">Orders</p>
                      <p className="font-semibold text-navy">{selected.orderCount}</p>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-faint">CRM Notes</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-navy/15 px-3 py-2 text-sm"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add follow-up notes, preferences, warranty info…"
                    />
                    <button
                      type="button"
                      onClick={saveNotes}
                      className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
                    >
                      Save notes
                    </button>
                  </div>
                </div>
              </Panel>
              <Panel title="Order History" subtitle={`${history.length} recent orders`}>
                <div className="scroll-x-touch">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase text-faint">
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Service</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((o: { id: string; service: string; amount: number; status: string }) => (
                        <tr key={o.id} className="border-b border-navy/5">
                          <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                          <td className="px-4 py-3">{o.service}</td>
                          <td className="px-4 py-3">AED {Number(o.amount).toLocaleString()}</td>
                          <td className="px-4 py-3">{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ) : (
            <Panel title="Select a customer" subtitle="Click a row to view CRM details and order history">
              <p className="px-6 py-12 text-center text-sm text-muted">No customer selected</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
