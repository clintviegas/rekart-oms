'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { forgotPassword } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      showToast('Check your email for reset instructions');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-navy">Forgot password</h1>
        <p className="mt-1 text-sm text-muted">We&apos;ll email a reset link to your @scalify.ae address</p>
        {sent ? (
          <p className="mt-6 text-sm text-green-700">If that email exists, a reset link was sent.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@scalify.ae"
              className="h-11 w-full rounded-xl border border-navy/15 px-4 text-sm"
            />
            <button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-60">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <Link href="/login" className="mt-6 inline-block text-sm text-brand hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
