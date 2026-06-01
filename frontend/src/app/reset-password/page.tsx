'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { Suspense } from 'react';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const [email, setEmail] = useState(params.get('email') || '');
  const [token] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      showToast('Invalid reset link');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, token, password);
      showToast('Password reset — sign in now');
      router.replace('/login');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold text-navy">Set new password</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-11 w-full rounded-xl border border-navy/15 px-4 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="New password (min 8 chars)"
          className="h-11 w-full rounded-xl border border-navy/15 px-4 text-sm"
        />
        <button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-60">
          {loading ? 'Saving…' : 'Reset password'}
        </button>
      </form>
      <Link href="/login" className="mt-6 inline-block text-sm text-brand hover:underline">
        ← Back to sign in
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
