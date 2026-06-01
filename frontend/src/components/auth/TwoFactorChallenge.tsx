'use client';

import { useState } from 'react';
import { verify2faLogin } from '@/lib/api';

export function TwoFactorChallenge({
  pendingToken,
  onSuccess
}: {
  pendingToken: string;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await verify2faLogin(pendingToken, code);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-navy/10 bg-surface/50 p-4">
      <p className="text-sm text-muted">Enter the 6-digit code from your authenticator app</p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="h-11 w-full rounded-xl border border-navy/15 px-4 text-center font-mono text-lg tracking-widest"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || code.length < 6}
        className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? 'Verifying…' : 'Verify & Sign In'}
      </button>
    </form>
  );
}
