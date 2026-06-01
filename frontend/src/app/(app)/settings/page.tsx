'use client';

import { useState } from 'react';
import { Panel, Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { useSettings, useMe } from '@/lib/queries';
import { updateSettings, changePassword, fetchBillingPlan, startCheckout, openBillingPortal } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { LOCATION_OPTIONS } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { BrandingPanel } from '@/components/settings/BrandingPanel';

export default function SettingsPage() {
  const { data, isLoading } = useSettings();
  const { data: me } = useMe();
  const { data: billing } = useQuery({ queryKey: ['billing'], queryFn: fetchBillingPlan });
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const settings = data?.settings || {};
  const stats = data?.stats;
  const branding = data?.tenant?.branding;

  async function save(key: string, value: string) {
    setSaving(true);
    try {
      await updateSettings({ [key]: value });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      showToast('Settings saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password changed — please sign in again');
      router.replace('/login');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password change failed');
    }
  }

  async function handleUpgrade() {
    try {
      const { url } = await startCheckout();
      if (url) window.location.href = url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Billing unavailable');
    }
  }

  async function handlePortal() {
    try {
      const { url } = await openBillingPortal();
      if (url) window.location.href = url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Billing portal unavailable');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Tenant config, security, and billing" />

      <Panel title="Plan & Usage" subtitle="SaaS subscription and monthly limits">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-medium capitalize text-navy">{billing?.plan || 'pro'} plan</p>
            <p className="text-sm text-muted">
              {billing?.usage?.ordersThisMonth || 0} / {billing?.limits?.ordersPerMonth || '∞'} orders this month
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {billing?.stripeConfigured ? (
              <>
                <button type="button" onClick={handleUpgrade} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
                  Upgrade via Stripe
                </button>
                <button type="button" onClick={handlePortal} className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium">
                  Manage subscription
                </button>
              </>
            ) : (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">Stripe not configured</Badge>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Tenant Branding" subtitle="Logo and primary color per tenant">
        <BrandingPanel initial={branding} />
      </Panel>

      <Panel title="Two-Factor Authentication" subtitle="TOTP via authenticator app">
        <TwoFactorSetup enabled={Boolean(me?.user?.totpEnabled)} />
      </Panel>

      <Panel title="Change Password" subtitle="Updates bcrypt hash">
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="rounded-xl border border-navy/15 px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="rounded-xl border border-navy/15 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handlePasswordChange}
            className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium sm:col-span-2 sm:w-fit"
          >
            Update password
          </button>
        </div>
      </Panel>

      <Panel title="Operational Settings" subtitle="Locations, thresholds, and inventory">
        <div className="divide-y divide-navy/5">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-medium text-navy">Default Location</p>
              <p className="text-sm text-muted">Pre-selected on new orders</p>
            </div>
            <select
              disabled={isLoading || saving}
              value={settings.default_location || 'Dubai'}
              onChange={e => save('default_location', e.target.value)}
              className="rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm"
            >
              {LOCATION_OPTIONS.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-medium text-navy">Low Stock Threshold</p>
              <p className="text-sm text-muted">Dashboard inventory watch alert</p>
            </div>
            <input
              type="number"
              min={0}
              disabled={isLoading || saving}
              key={settings.low_stock_threshold || '2'}
              defaultValue={settings.low_stock_threshold || '2'}
              onBlur={e => save('low_stock_threshold', e.target.value)}
              className="w-24 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-medium text-navy">Staff / Products</p>
              <p className="text-sm text-muted">
                {stats?.agents ?? 0} agents · {stats?.products ?? 0} products
              </p>
            </div>
            <Badge className="border-green-200 bg-green-50 text-green-700">Synced</Badge>
          </div>
        </div>
      </Panel>
    </div>
  );
}
