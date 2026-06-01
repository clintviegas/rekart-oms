import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

export function getProductMatches(products: Product[], query: string, limit = 30): Product[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return [...products]
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  return products
    .map(product => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      const brand = product.brand.toLowerCase();
      const haystack = [name, sku, brand, product.category || ''].join(' ').toLowerCase();
      if (!tokens.every(token => haystack.includes(token))) return null;
      let score = 0;
      if (name === q) score += 100;
      if (name.startsWith(q)) score += 60;
      if (brand === q) score += 50;
      if (sku.startsWith(q)) score += 40;
      if (brand.startsWith(q)) score += 30;
      if (name.includes(q)) score += 15;
      score += Math.max(0, 30 - name.length / 8);
      return { product, score };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score || a!.product.name.localeCompare(b!.product.name))
    .slice(0, limit)
    .map(r => r!.product);
}

export function orderInputClass(error?: boolean) {
  return cn(
    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-navy outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20',
    error ? 'border-red-400' : 'border-navy/15'
  );
}

export function orderLabelClass() {
  return 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint';
}
