'use client';

import { Panel, Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { useNotifications } from '@/lib/queries';
import { retryNotification, sendTestEmail } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';

function StatusRow({
  label,
  detail,
  status,
  statusClass = 'text-green-600',
  action
}: {
  label: string;
  detail: string;
  status: string;
  statusClass?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-navy/5 px-4 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-navy">{label}</p>
        <p className="text-xs text-faint">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <Badge className={`border-transparent bg-transparent px-0 py-0 text-sm font-semibold ${statusClass}`}>
          {status}
        </Badge>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { data: notifications = [] } = useNotifications();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const latestEmail = notifications.find(n => n.channel === 'email');
  const latestWhatsApp = notifications.find(n => n.channel === 'whatsapp');
  const failedEmail = notifications.find(n => n.channel === 'email' && n.status === 'failed');

  async function handleRetry() {
    if (!failedEmail) return;
    try {
      const result = await retryNotification(failedEmail.id);
      showToast(`Email retry: ${result.status}`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  async function handleTestEmail() {
    try {
      const result = await sendTestEmail();
      showToast(`Test email: ${result.status}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Test failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" subtitle="Local OMS services and warehouse notification status" />

      <Panel title="System Integrations" subtitle="Database, APIs, and notification channels">
        <StatusRow
          label="SQLite Database"
          detail="Primary data store for orders, products, agents, and audit log"
          status="Connected"
        />
        <StatusRow label="Orders API" detail="/api/orders with pagination & stock sync" status="Live" />
        <StatusRow label="Products API" detail="/api/products with pagination" status="Live" />
        <StatusRow
          label="Warehouse Email"
          detail={
            latestEmail
              ? `${latestEmail.recipient} — ${latestEmail.status}`
              : 'sales@scalify.ae — waiting for first order alert'
          }
          status={latestEmail?.status || 'Primary'}
          statusClass={latestEmail?.status === 'failed' ? 'text-red-600' : 'text-navy'}
          action={
            <div className="flex gap-2">
              {failedEmail && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg border border-navy/15 px-2 py-1 text-xs font-medium text-muted hover:bg-surface"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={handleTestEmail}
                className="rounded-lg border border-brand/20 bg-brand-pale px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10"
              >
                Test
              </button>
            </div>
          }
        />
        <StatusRow
          label="WhatsApp Fallback"
          detail={
            latestWhatsApp
              ? `${latestWhatsApp.recipient} — ${latestWhatsApp.status}`
              : '+971545192005 — waiting for first order alert'
          }
          status={latestWhatsApp?.status || 'Fallback'}
          statusClass={latestWhatsApp ? 'text-navy' : 'text-muted'}
        />
      </Panel>
    </div>
  );
}
