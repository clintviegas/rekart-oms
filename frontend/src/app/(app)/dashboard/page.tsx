'use client';

import Link from 'next/link';
import { StatCard, Panel, Badge, STAT_ICONS } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { SVC_COLORS, STATUS_COLORS } from '@/lib/constants';
import { useOrderStats, useRecentOrders } from '@/lib/queries';
import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '@/lib/api';
import { useNotifications } from '@/lib/queries';

export default function DashboardPage() {
  const { data: stats } = useOrderStats();
  const { data: recentOrders = [] } = useRecentOrders(6);
  const { data: notifications = [] } = useNotifications();
  const { data: productsPage } = useQuery({
    queryKey: ['products', 'all-dashboard'],
    queryFn: () => fetchProducts({ limit: 500 })
  });

  const products = productsPage?.data || [];
  const lowStockThreshold = 2;
  const lowStock = products.filter(p => Number(p.stock || 0) <= lowStockThreshold).slice(0, 6);
  const latestEmail = notifications.find(n => n.channel === 'email');

  const total = stats?.total || 0;
  const revenue = stats?.revenue || 0;
  const pending = stats?.pending || 0;
  const completed = stats?.completed || 0;
  const rate = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live health check across orders, revenue, inventory, and warehouse alerts"
        actions={
          <>
            <Link
              href="/inventory"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm font-medium text-muted hover:border-navy/30 sm:flex-none sm:px-4"
            >
              Inventory
            </Link>
            <Link
              href="/orders"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-navy px-3 py-2.5 text-sm font-medium text-white hover:bg-navy-mid sm:flex-none sm:px-4"
            >
              + New Order
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard accent="brand" icon={STAT_ICONS.orders} label="Total Orders" value={total.toLocaleString()} meta="All saved orders" />
        <StatCard accent="green" icon={STAT_ICONS.revenue} label="Revenue AED" value={revenue.toLocaleString()} meta="From punched orders" />
        <StatCard accent="amber" icon={STAT_ICONS.pending} label="Pending" value={pending.toLocaleString()} meta="Awaiting action" />
        <StatCard
          accent="purple"
          icon={STAT_ICONS.completed}
          label="Completed"
          value={completed.toLocaleString()}
          metaNode={<><span className="font-medium text-green-600">{rate}%</span> completion rate</>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Recent Orders" subtitle="Latest activity from the order desk">
            <div className="scroll-x-touch">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-navy/5 hover:bg-surface/80">
                      <td className="px-4 py-3 font-mono text-xs text-faint">{order.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy">{order.customer}</div>
                        <div className="text-xs text-faint">{order.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={SVC_COLORS[order.service]}>{order.service}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold">AED {Number(order.amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {!recentOrders.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted">
                        No orders yet — punch your first order from the Orders desk.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Inventory Watch" subtitle="Products that need attention">
            <div className="divide-y divide-navy/5">
              {lowStock.length ? lowStock.map(p => (
                <div key={p.sku} className="flex items-center justify-between px-4 py-3 text-sm sm:px-6">
                  <div>
                    <p className="font-medium text-navy">{p.name}</p>
                    <p className="text-xs text-faint">{p.sku}</p>
                  </div>
                  <span className="font-semibold">{p.stock} left</span>
                </div>
              )) : (
                <p className="px-4 py-8 text-center text-sm text-muted sm:px-6">No low-stock products</p>
              )}
            </div>
          </Panel>

          <Panel title="System Status" subtitle="Backend and integrations">
            <div className="space-y-3 px-4 py-4 text-sm sm:px-6">
              <div className="flex justify-between"><span>Orders API</span><strong className="text-green-600">Live</strong></div>
              <div className="flex justify-between"><span>Products API</span><strong className="text-green-600">Live</strong></div>
              <div className="flex justify-between"><span>Warehouse Email</span><strong>{latestEmail?.status || 'Ready'}</strong></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
