'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SERVICES } from '@/lib/constants';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/reports', label: 'Reports' },
  { href: '/integrations', label: 'Integrations' }
];

const MANAGE = [
  { href: '/customers', label: 'Customers' },
  { href: '/payments', label: 'Payments' },
  { href: '/settings', label: 'Settings' }
];

function navActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  orderCounts,
  activeService,
  pathname,
  onNavigate,
  includeMainNav = false
}: {
  orderCounts: Record<string, number>;
  activeService: string | null;
  pathname: string;
  onNavigate?: () => void;
  includeMainNav?: boolean;
}) {
  return (
    <>
      {includeMainNav && (
        <>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Main</p>
          <nav className="mb-6 space-y-0.5">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'block rounded-lg border-l-2 py-2.5 pl-[18px] pr-3 text-sm transition',
                  navActive(pathname, item.href)
                    ? 'border-brand bg-brand-pale font-medium text-brand'
                    : 'border-transparent text-muted hover:bg-surface hover:text-navy'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      )}
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Services</p>
      <nav className="space-y-0.5">
        {SERVICES.map(service => {
          const isActive = activeService === service;
          const count = orderCounts[service] || 0;
          return (
            <Link
              key={service}
              href={`/orders?service=${encodeURIComponent(service)}`}
              onClick={onNavigate}
              className={cn(
                'flex items-center justify-between rounded-lg border-l-2 py-2.5 pl-[18px] pr-3 text-sm transition',
                isActive
                  ? 'border-brand bg-brand-pale font-medium text-brand'
                  : 'border-transparent text-muted hover:bg-surface hover:text-navy'
              )}
            >
              <span className="truncate">{service}</span>
              <span
                className={cn(
                  'ml-2 shrink-0 min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums',
                  isActive && 'bg-brand text-white',
                  !isActive && count > 0 && 'bg-brand-pale text-brand',
                  !isActive && count === 0 && 'bg-surface text-faint'
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <p className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Manage</p>
      <nav className="space-y-0.5">
        {MANAGE.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'block rounded-lg border-l-2 py-2.5 pl-[18px] pr-3 text-sm transition',
              pathname === item.href
                ? 'border-brand bg-brand-pale font-medium text-brand'
                : 'border-transparent text-muted hover:bg-surface hover:text-navy'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function SidebarInner({
  orderCounts,
  mobileOpen,
  onMobileClose
}: {
  orderCounts: Record<string, number>;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeService = pathname === '/orders' ? searchParams.get('service') : null;

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    onMobileClose();
  }, [pathname, searchParams, onMobileClose]);

  return (
    <>
      {/* Desktop: fixed column, scrolls internally only */}
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-navy/10 bg-white lg:flex">
        <div className="sidebar-scroll flex-1 overflow-y-auto overscroll-y-contain p-5">
          <SidebarContent orderCounts={orderCounts} activeService={activeService} pathname={pathname} />
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-navy/50 backdrop-blur-[2px] lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-[70] flex w-[min(280px,88vw)] flex-col border-r border-navy/10 bg-white shadow-2xl lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-navy/10 px-5 py-4">
              <span className="text-sm font-semibold text-navy">Menu</span>
              <button
                type="button"
                onClick={onMobileClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="sidebar-scroll flex-1 overflow-y-auto overscroll-y-contain p-5 pb-8">
              <SidebarContent
                orderCounts={orderCounts}
                activeService={activeService}
                pathname={pathname}
                onNavigate={onMobileClose}
                includeMainNav
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export function Sidebar({
  orderCounts,
  mobileOpen,
  onMobileClose
}: {
  orderCounts: Record<string, number>;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  return (
    <Suspense fallback={null}>
      <SidebarInner orderCounts={orderCounts} mobileOpen={mobileOpen} onMobileClose={onMobileClose} />
    </Suspense>
  );
}

export function TopNav({
  userName,
  userEmail,
  userRole,
  onLogout,
  onMenuOpen
}: {
  userName: string;
  userEmail: string;
  userRole?: string;
  onLogout: () => void;
  onMenuOpen: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="z-50 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-navy px-3 text-white sm:gap-4 sm:px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 lg:hidden"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
        <img src="/rekart-logo.svg" alt="Rekart" className="h-6 w-auto shrink-0 brightness-0 invert sm:h-7" />
        <span className="hidden border-l border-white/20 pl-3 text-[10px] font-medium uppercase tracking-wider text-brand-light md:inline">
          Order Management
        </span>
      </Link>

      <nav className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:ml-2 sm:gap-1 [&::-webkit-scrollbar]:hidden">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition sm:px-3 sm:text-sm',
              navActive(pathname, item.href)
                ? 'bg-white/10 font-medium text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-green-400/30 bg-green-400/10 px-2.5 py-1 text-[11px] text-green-300 md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
          Live
        </span>
        {userRole && (
          <span className="hidden rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70 lg:inline">
            {userRole}
          </span>
        )}
        <div className="group relative">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-light/40 bg-navy-soft text-xs font-semibold text-brand-light"
            title={userEmail}
          >
            {(userName || userEmail || 'U').slice(0, 2).toUpperCase()}
          </button>
          <div className="invisible absolute right-0 top-10 z-[60] w-52 rounded-xl border border-navy/10 bg-white p-2 text-navy opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="border-b border-navy/10 px-3 py-2">
              <p className="text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-faint">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
