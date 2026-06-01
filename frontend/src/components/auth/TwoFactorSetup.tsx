'use client';

import { useEffect, useState } from 'react';
import { setup2fa, enable2fa, disable2fa } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const { showToast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    try {
      const data = await setup2fa();
      setQrDataUrl(data.qrDataUrl);
      showToast('Scan QR with Google Authenticator');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    try {
      await enable2fa(code);
      showToast('2FA enabled');
      setQrDataUrl('');
      setCode('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!code) {
      showToast('Enter current 2FA code to disable');
      return;
    }
    setBusy(true);
    try {
      await disable2fa(code);
      showToast('2FA disabled');
      setCode('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Disable failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    setQrDataUrl('');
  }, [enabled]);

  return (
    <div className="space-y-3 px-4 py-4 sm:px-6">
      <p className="text-sm text-muted">
        {enabled ? 'Two-factor authentication is active on your account.' : 'Add an extra layer of security with TOTP.'}
      </p>
      {!enabled && !qrDataUrl && (
        <button type="button" disabled={busy} onClick={startSetup} className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium">
          Set up 2FA
        </button>
      )}
      {qrDataUrl && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <img src={qrDataUrl} alt="2FA QR code" className="h-36 w-36 rounded-lg border border-navy/10" />
          <div className="space-y-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="rounded-xl border border-navy/15 px-3 py-2 text-sm"
            />
            <button type="button" disabled={busy} onClick={confirmEnable} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
              Enable 2FA
            </button>
          </div>
        </div>
      )}
      {enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Code to disable"
            className="rounded-xl border border-navy/15 px-3 py-2 text-sm"
          />
          <button type="button" disabled={busy} onClick={handleDisable} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600">
            Disable 2FA
          </button>
        </div>
      )}
    </div>
  );
}
