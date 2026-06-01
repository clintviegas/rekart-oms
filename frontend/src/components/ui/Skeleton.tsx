import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-navy/10', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4 sm:rounded-2xl sm:p-5">
      <Skeleton className="mb-3 h-8 w-8" />
      <Skeleton className="mb-2 h-7 w-20" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
