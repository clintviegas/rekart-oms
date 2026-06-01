import { cn } from '@/lib/utils';

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', className)}>
      {children}
    </span>
  );
}

const ACCENT = {
  brand: { bar: 'bg-brand', icon: 'bg-brand-pale text-brand' },
  green: { bar: 'bg-green-500', icon: 'bg-green-50 text-green-600' },
  amber: { bar: 'bg-orange-500', icon: 'bg-orange-50 text-orange-600' },
  purple: { bar: 'bg-purple-500', icon: 'bg-purple-50 text-purple-600' }
};

export function StatCard({
  label,
  value,
  meta,
  accent = 'brand',
  icon,
  metaNode
}: {
  label: string;
  value: string | number;
  meta?: string;
  metaNode?: React.ReactNode;
  accent?: 'brand' | 'green' | 'amber' | 'purple';
  icon?: React.ReactNode;
}) {
  const style = ACCENT[accent];

  return (
    <div className="relative overflow-hidden rounded-xl border border-navy/10 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
      <div className={cn('absolute inset-x-0 top-0 h-[3px]', style.bar)} />
      {icon && (
        <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', style.icon)}>
          {icon}
        </div>
      )}
      <div className="text-xl font-semibold leading-none tracking-tight text-navy sm:text-[26px]">{value}</div>
      <div className="mt-1.5 text-sm text-muted">{label}</div>
      {(meta || metaNode) && (
        <div className="mt-2 text-xs text-faint">{metaNode ?? meta}</div>
      )}
    </div>
  );
}

export function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-md shadow-navy/5 sm:rounded-3xl">
      <div className="flex flex-col gap-2 border-b border-navy/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export const STAT_ICONS = {
  orders: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  revenue: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  pending: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  completed: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
};
