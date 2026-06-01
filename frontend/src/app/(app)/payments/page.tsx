'use client';

import { useMemo } from 'react';
import { Panel } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { useOrderStats } from '@/lib/queries';

export default function PaymentsPage() {
  const { data: stats } = useOrderStats();

  const byPayment = useMemo(() => {
    if (!stats?.byPayment) return [];
    return Object.entries(stats.byPayment)
      .map(([mode, row]) => ({ mode, ...row }))
      .sort((a, b) => b.total - a.total);
  }, [stats]);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Payment modes from saved orders" />

      <Panel title="Payment Summary" subtitle="Total AED grouped by payment mode">
        <div className="scroll-x-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Total AED</th>
              </tr>
            </thead>
            <tbody>
              {byPayment.map(row => (
                <tr key={row.mode} className="border-b border-navy/5 hover:bg-surface/80">
                  <td className="px-4 py-3 font-medium text-navy">{row.mode}</td>
                  <td className="px-4 py-3 text-muted">{row.count}</td>
                  <td className="px-4 py-3 font-semibold">AED {row.total.toLocaleString()}</td>
                </tr>
              ))}
              {!byPayment.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted">
                    No payment data yet — totals will appear once orders are saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
