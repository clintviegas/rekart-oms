'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { login, loginWithGoogle } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { TwoFactorChallenge } from '@/components/auth/TwoFactorChallenge';
import { PasswordInput } from '@/components/ui/PasswordInput';
import Link from 'next/link';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending2fa, setPending2fa] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  function goDashboard() {
    const next = searchParams.get('next');
    const dest = next && next.startsWith('/') ? next : '/dashboard';
    window.location.href = dest;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.requires2fa && data.pendingToken) {
        setPending2fa(data.pendingToken);
        return;
      }
      goDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!googleClientId || !window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential: string }) => {
        try {
          const data = await loginWithGoogle(response.credential);
          if (data.requires2fa && data.pendingToken) {
            setPending2fa(data.pendingToken);
            return;
          }
          goDashboard();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Google sign-in failed');
        }
      }
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320
    });
  }, [googleClientId]);

  return (
    <>
      {googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />}
      <div className="grid min-h-dvh lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy via-navy-mid to-brand p-8 text-white lg:flex lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(103,164,241,.25),transparent_55%)]" />
          <img src="/rekart-logo.svg" alt="Rekart" className="relative h-12 brightness-0 invert" />
          <div className="relative max-w-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-light">Order Management</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight">Punch orders the moment they walk in.</h1>
          </div>
        </aside>

        <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <img src="/rekart-logo.svg" alt="Rekart" className="h-10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-navy">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">Sign in to manage today&apos;s orders</p>

            {pending2fa ? (
              <TwoFactorChallenge pendingToken={pending2fa} onSuccess={goDashboard} />
            ) : (
              <>
                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">Work Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@scalify.ae"
                      required
                      className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">Password</label>
                    <PasswordInput
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="text-right">
                    <Link href="/forgot-password" className="text-xs text-brand hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loading ? 'Signing in…' : 'Sign In →'}
                  </button>
                </form>
                {googleClientId && (
                  <div className="mt-6">
                    <p className="mb-2 text-center text-xs text-muted">or continue with</p>
                    <div ref={googleBtnRef} className="flex justify-center" />
                  </div>
                )}
              </>
            )}
            <p className="mt-6 text-center text-xs text-faint">Access restricted to @scalify.ae accounts</p>
          </div>
        </main>
      </div>
    </>
  );
}
