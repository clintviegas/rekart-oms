import type { OrderItem } from '@/lib/types';

export type FormItem = OrderItem & { _id: number };

let nextItemId = 1;

export function blankItem(): FormItem {
  return { _id: nextItemId++, sku: '', name: '', brand: '', qty: 1, price: 0 };
}

export const PAGE_SIZE = 50;

export function paginate<T>(rows: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    start,
    end: Math.min(start + PAGE_SIZE, rows.length),
    rows: rows.slice(start, start + PAGE_SIZE)
  };
}

export const SVC_COND_LABEL: Record<string, string> = {
  Repair: 'Repair Details',
  'Trade-In': 'Trade-In Details',
  Insurance: 'Insurance Details',
  Rent: 'Rental Details',
  Recycle: 'Recycle Details'
};
