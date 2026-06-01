'use client';

import { useMemo, useRef, useState } from 'react';
import type { Product } from '@/lib/types';
import { getProductMatches, orderInputClass, orderLabelClass } from '@/lib/order-utils';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { cn } from '@/lib/utils';
import type { FormItem } from './types';

export function LineItemRow({
  item,
  products,
  solo,
  onChange,
  onRemove,
  errors
}: {
  item: FormItem;
  products: Product[];
  solo: boolean;
  onChange: (updated: FormItem) => void;
  onRemove: () => void;
  errors?: { name?: boolean; qty?: boolean; price?: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => getProductMatches(products, item.name), [products, item.name]);

  function selectProduct(product: Product) {
    onChange({
      ...item,
      sku: product.sku,
      brand: product.brand,
      name: product.name,
      price: Number(product.price) || 0
    });
    setOpen(false);
  }

  function matchBySku(code: string) {
    const sku = code.trim().toUpperCase();
    const product = products.find(p => p.sku.toUpperCase() === sku);
    if (product) selectProduct(product);
    else onChange({ ...item, name: code, sku: sku });
  }

  return (
    <>
      <div
        className={cn(
          'relative grid gap-3 rounded-2xl border border-navy/10 bg-surface/60 p-3 sm:grid-cols-[1fr_72px_96px_36px] sm:gap-2',
          item.sku && 'border-brand/30 bg-brand-pale/30'
        )}
      >
        <div ref={wrapRef} className="relative min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <label className={orderLabelClass()}>Device / Item</label>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="text-[10px] font-semibold uppercase text-brand hover:underline"
            >
              Scan
            </button>
          </div>
          <input
            type="text"
            className={orderInputClass(errors?.name)}
            placeholder="Search or scan SKU"
            value={item.name}
            autoComplete="off"
            onFocus={() => {
              setOpen(true);
              setActiveIdx(0);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={e => {
              onChange({ ...item, name: e.target.value, sku: '', brand: '' });
              setOpen(true);
              setActiveIdx(0);
            }}
            onKeyDown={e => {
              if (!open || !matches.length) return;
              if (e.key === 'Escape') {
                setOpen(false);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx(i => Math.min(i + 1, matches.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx(i => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter' && matches[activeIdx]) {
                e.preventDefault();
                selectProduct(matches[activeIdx]);
              }
            }}
          />
          {open && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-xl border border-navy/10 bg-white py-1 shadow-xl">
              {matches.length ? (
                matches.map((p, idx) => (
                  <button
                    key={p.sku}
                    type="button"
                    className={cn(
                      'flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface',
                      idx === activeIdx && 'bg-brand-pale'
                    )}
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => selectProduct(p)}
                  >
                    <span className="font-medium text-navy">{p.name}</span>
                    <span className="text-xs text-faint">
                      {p.brand} · {p.sku} · AED {Number(p.price || 0).toLocaleString()}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-muted">No matches — Enter to keep custom item</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className={orderLabelClass()}>Qty</label>
          <input
            type="number"
            min={1}
            step={1}
            className={orderInputClass(errors?.qty)}
            value={item.qty || 1}
            onChange={e => onChange({ ...item, qty: parseInt(e.target.value, 10) || 1 })}
          />
        </div>

        <div>
          <label className={orderLabelClass()}>Price (AED)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            className={orderInputClass(errors?.price)}
            value={item.price || ''}
            onChange={e => onChange({ ...item, price: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className="flex items-end pb-0.5">
          <button
            type="button"
            disabled={solo}
            onClick={onRemove}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-navy/10 text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
            title="Remove item"
          >
            ×
          </button>
        </div>
      </div>
      {scanOpen && <BarcodeScanner onScan={matchBySku} onClose={() => setScanOpen(false)} />}
    </>
  );
}
