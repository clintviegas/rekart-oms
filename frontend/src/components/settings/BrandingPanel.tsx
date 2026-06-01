'use client';

import { useState } from 'react';
import { updateBranding } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useTenant } from '@/components/providers/TenantProvider';

export function BrandingPanel({ initial }: { initial?: { logoUrl?: string; primaryColor?: string } }) {
  const { showToast } = useToast();
  const { setBranding } = useTenant();
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(initial?.primaryColor || '#055ed7');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const branding = await updateBranding({ logoUrl, primaryColor });
      setBranding(branding);
      showToast('Branding saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted">Logo URL</label>
        <input
          value={logoUrl}
          onChange={e => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
          className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted">Primary color</label>
        <div className="flex gap-2">
          <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-navy/15" />
          <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 rounded-xl border border-navy/15 px-3 py-2 font-mono text-sm" />
        </div>
      </div>
      <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white sm:col-span-2 sm:w-fit">
        Save branding
      </button>
    </div>
  );
}
