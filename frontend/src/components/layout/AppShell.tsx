'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureCsrf, logout } from '@/lib/api';
import { useMe, useOrderSummary } from '@/lib/queries';
import { useOrderEvents } from '@/lib/useOrderEvents';
import { registerServiceWorker } from '@/lib/offline-queue';
import { Sidebar, TopNav } from '@/components/layout/Shell';
import { useTenant } from '@/components/providers/TenantProvider';
import { Skeleton } from '@/components/ui/Skeleton';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setBranding } = useTenant();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: meData, isLoading: meLoading, isError } = useMe();
  const { data: summary } = useOrderSummary();

  useOrderEvents(!meLoading && !isError);

  useEffect(() => {
    if (isError) router.replace('/login');
  }, [isError, router]);

  useEffect(() => {
    if (!meLoading && !isError) ensureCsrf();
    registerServiceWorker();
  }, [meLoading, isError]);

  useEffect(() => {
    if (meData?.tenant?.branding) setBranding(meData.tenant.branding);
  }, [meData, setBranding]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  if (meLoading) {
    return (
      <div className="flex h-dvh flex-col bg-surface p-6">
        <Skeleton className="mb-4 h-14 w-full" />
        <div className="flex flex-1 gap-4">
          <Skeleton className="hidden h-full w-56 lg:block" />
          <Skeleton className="h-full flex-1" />
        </div>
      </div>
    );
  }

  const user = meData?.user;
  const orderCounts = summary?.counts || {};

  async function handleLogout() {
    await logout();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-surface">
      <TopNav
        userName={user?.name || 'Sales Team'}
        userEmail={user?.email || ''}
        userRole={user?.role}
        onLogout={handleLogout}
        onMenuOpen={() => setMobileNavOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          orderCounts={orderCounts}
          mobileOpen={mobileNavOpen}
          onMobileClose={closeMobileNav}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
