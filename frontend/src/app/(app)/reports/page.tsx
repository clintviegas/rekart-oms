'use client';

import { useState } from 'react';
import { StatCard, Panel, Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { SVC_COLORS } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { fetchReportsSummary } from '@/lib/api';

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: report } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => fetchReportsSummary(from || undefined, to || undefined)
  });

  const byService = report?.byService
    ? Object.entries(report.byService).map(([service, row]) => ({
        service,
        ...(row as { count: number; amount: number })
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Filter by date range for performance breakdown" />

      <div className="flex flex-wrap gap-3 rounded-2xl border border-navy/10 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-faint">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-xl border border-navy/15 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-faint">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-xl border border-navy/15 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Orders" value={(report?.totalOrders || 0).toLocaleString()} meta="In selected range" />
        <StatCard label="Revenue AED" value={(report?.revenue || 0).toLocaleString()} accent="green" />
        <StatCard label="Pending" value={(report?.pending || 0).toLocaleString()} accent="amber" />
        <StatCard label="Completed" value={(report?.completed || 0).toLocaleString()} accent="purple" />
      </div>

      <Panel title="Service Performance" subtitle="Orders and revenue by vertical">
        <div className="scroll-x-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {byService.map(row => (
                <tr key={row.service} className="border-b border-navy/5 hover:bg-surface/80">
                  <td className="px-4 py-3">
                    <Badge className={SVC_COLORS[row.service]}>{row.service}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">{row.count}</td>
                  <td className="px-4 py-3 font-semibold">AED {row.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
