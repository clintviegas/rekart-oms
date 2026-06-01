'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fetchProducts } from '@/lib/api';
import {
  ELECTRONICS_CATALOG,
  ELECTRONICS_CATEGORIES,
  LOCATION_OPTIONS,
  PRODUCT_STATUSES,
  normalizeLocation
} from '@/lib/constants';
import type { Product } from '@/lib/types';
import { StatCard, Panel, Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/Shell';
import { useToast } from '@/components/ui/Toast';

const PAGE_SIZE = 50;
const ALL_ELECTRONICS_BRANDS = [...new Set(Object.values(ELECTRONICS_CATALOG).flat())].sort((a, b) =>
  a.localeCompare(b)
);

const inputClass =
  'w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selectClass = inputClass;
const miniClass =
  'w-full min-w-0 rounded-lg border border-navy/10 bg-white px-2 py-1.5 text-sm text-navy focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20';

type ImportResult = {
  imported: number;
  skipped?: { row: number; reason: string }[];
};

type RowDraft = {
  name: string;
  brand: string;
  category: string;
  stock: number;
  price: number;
  location: string;
  status: string;
};

function brandsForCategory(category: string) {
  return ELECTRONICS_CATALOG[category] || ALL_ELECTRONICS_BRANDS;
}

function brandOptions(category: string, selected = '') {
  const base = brandsForCategory(category);
  return selected && !base.includes(selected) ? [selected, ...base] : base;
}

function productToDraft(product: Product): RowDraft {
  return {
    name: product.name,
    brand: product.brand,
    category: product.category || 'Laptop',
    stock: Number(product.stock || 0),
    price: Number(product.price || 0),
    location: normalizeLocation(product.location),
    status: product.status || 'Available'
  };
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows.shift()!.map(h => h.toLowerCase().replace(/\s+/g, '').replace(/_/g, ''));
  const aliases: Record<string, string> = {
    productname: 'name',
    itemname: 'name',
    qty: 'stock',
    quantity: 'stock',
    saleprice: 'price',
    sellingprice: 'price',
    warehouse: 'location'
  };

  return rows.map(values => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      item[aliases[header] || header] = values[index] || '';
    });
    return item;
  });
}

export default function InventoryPage() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [brandFilter, setBrandFilter] = useState('All brands');
  const [locationFilter, setLocationFilter] = useState('All locations');
  const [page, setPage] = useState(1);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [savingSku, setSavingSku] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Laptop');
  const [formBrand, setFormBrand] = useState('Dell');
  const [formStock, setFormStock] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formLocation, setFormLocation] = useState<string>(LOCATION_OPTIONS[0]);
  const [formStatus, setFormStatus] = useState<string>(PRODUCT_STATUSES[0]);
  const [adding, setAdding] = useState(false);

  const loadProducts = useCallback(async (query = '') => {
    setLoading(true);
    try {
      let data: Product[];
      if (query.trim()) {
        const result = await fetchProducts({ search: query.trim(), limit: 500 });
        data = result.data;
      } else {
        data = await api<Product[]>('/api/products/all');
      }
      setProducts(data);
      const nextDrafts: Record<string, RowDraft> = {};
      data.forEach(p => {
        nextDrafts[p.sku] = productToDraft(p);
      });
      setDrafts(nextDrafts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProducts(search);
  }, [search, loadProducts]);

  useEffect(() => {
    if (categoryFilter !== 'All categories') {
      const brands = brandsForCategory(categoryFilter);
      if (brandFilter !== 'All brands' && !brands.includes(brandFilter)) {
        setBrandFilter('All brands');
      }
    }
  }, [categoryFilter, brandFilter]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const totalValue = products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0);
    const lowStock = products.filter(p => Number(p.stock || 0) <= 2).length;
    const categoryCount = new Set(products.map(p => p.category).filter(Boolean)).size;
    const brandCount = new Set(products.map(p => p.brand).filter(Boolean)).size;
    return { totalProducts, totalStock, totalValue, lowStock, categoryCount, brandCount };
  }, [products]);

  const brandFilterOptions = useMemo(() => {
    if (categoryFilter !== 'All categories') return brandsForCategory(categoryFilter);
    return [...new Set(products.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [products, categoryFilter]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter !== 'All categories' && p.category !== categoryFilter) return false;
      if (brandFilter !== 'All brands' && p.brand !== brandFilter) return false;
      if (locationFilter !== 'All locations' && normalizeLocation(p.location) !== locationFilter) return false;
      return true;
    });
  }, [products, categoryFilter, brandFilter, locationFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function updateDraft(sku: string, patch: Partial<RowDraft>) {
    setDrafts(prev => ({
      ...prev,
      [sku]: { ...prev[sku], ...patch }
    }));
  }

  function resetForm() {
    setFormSku('');
    setFormName('');
    setFormCategory('Laptop');
    setFormBrand('Dell');
    setFormStock('');
    setFormPrice('');
    setFormLocation(LOCATION_OPTIONS[0]);
    setFormStatus(PRODUCT_STATUSES[0]);
  }

  async function handleAddProduct() {
    const payload = {
      sku: formSku.trim(),
      name: formName.trim(),
      brand: formBrand,
      category: formCategory,
      stock: Number(formStock) || 0,
      price: Number(formPrice) || 0,
      location: formLocation,
      status: formStatus
    };
    if (!payload.sku || !payload.name || !payload.brand) {
      showToast('SKU, name, and brand are required');
      return;
    }
    setAdding(true);
    try {
      await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      resetForm();
      await loadProducts(search);
      setPage(1);
      showToast('Product saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveProduct(sku: string) {
    const draft = drafts[sku];
    if (!draft) return;
    setSavingSku(sku);
    try {
      await api(`/api/products/${encodeURIComponent(sku)}`, {
        method: 'PATCH',
        body: JSON.stringify(draft)
      });
      await loadProducts(search);
      showToast('Product updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSavingSku(null);
    }
  }

  async function handleDeleteProduct(sku: string) {
    if (!window.confirm(`Delete product ${sku}?`)) return;
    setSavingSku(sku);
    try {
      await api(`/api/products/${encodeURIComponent(sku)}`, { method: 'DELETE' });
      await loadProducts(search);
      showToast('Product deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setSavingSku(null);
    }
  }

  async function handleImportCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      showToast('Choose a CSV file first');
      return;
    }
    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) {
        showToast('CSV has no product rows');
        return;
      }
      const result = await api<ImportResult>('/api/products/import', {
        method: 'POST',
        body: JSON.stringify({ products: rows })
      });
      setImportResult(result);
      await loadProducts(search);
      setPage(1);
      if (fileRef.current) fileRef.current.value = '';
      showToast(
        `${result.imported} products imported${result.skipped?.length ? ` · ${result.skipped.length} skipped` : ''}`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Dashboard"
        subtitle="Stock control for Rekart electronics across Dubai and Sharjah WH"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={stats.totalProducts.toLocaleString()}
          meta={`${stats.categoryCount} categories · ${stats.brandCount} brands`}
        />
        <StatCard
          label="Units In Stock"
          value={stats.totalStock.toLocaleString()}
          meta="Across Dubai and Sharjah WH"
          accent="green"
        />
        <StatCard
          label="Low Stock"
          value={stats.lowStock.toLocaleString()}
          meta="2 units or fewer"
          accent="amber"
        />
        <StatCard
          label="Stock Value AED"
          value={stats.totalValue.toLocaleString()}
          meta="Qty × selling price"
          accent="purple"
        />
      </div>

      <Panel
        title="Product Catalog"
        subtitle="Search, filter, add, import, and edit inventory"
        action={
          <span className="text-xs text-faint">
            {filtered.length ? `${filtered.length.toLocaleString()} products` : '0 products'}
          </span>
        }
      >
        <div className="space-y-4 border-b border-navy/10 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
            <div className="relative min-w-0 flex-1 xl:min-w-[240px]">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by SKU, name, or brand..."
                className={`${inputClass} pl-9`}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} xl:w-44`}
            >
              <option>All categories</option>
              {ELECTRONICS_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={brandFilter}
              onChange={e => {
                setBrandFilter(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} xl:w-44`}
            >
              <option>All brands</option>
              {brandFilterOptions.map(brand => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={e => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} xl:w-40`}
            >
              <option>All locations</option>
              {LOCATION_OPTIONS.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="max-w-full text-sm text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-brand-pale file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
              />
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={importing}
                className="rounded-xl border border-navy/15 bg-white px-4 py-2 text-sm font-medium text-muted hover:border-navy/30 disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Import CSV'}
              </button>
            </div>
          </div>

          {importResult && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                importResult.skipped?.length
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-green-200 bg-green-50 text-green-900'
              }`}
            >
              <p className="font-semibold">{Number(importResult.imported || 0).toLocaleString()} products imported</p>
              <p className="mt-1 text-xs opacity-80">
                {importResult.skipped?.length
                  ? `${importResult.skipped.length} rows skipped. Review the first ${Math.min(importResult.skipped.length, 8)} below.`
                  : 'CSV import completed successfully.'}
              </p>
              {importResult.skipped?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {importResult.skipped.slice(0, 8).map(item => (
                    <Badge key={`${item.row}-${item.reason}`} className="border-amber-200 bg-white text-amber-800">
                      Row {item.row}: {item.reason}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded-2xl border border-navy/10 bg-surface/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">Add product</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                value={formSku}
                onChange={e => setFormSku(e.target.value)}
                placeholder="SKU"
                className={inputClass}
              />
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Product name"
                className={inputClass}
              />
              <select
                value={formCategory}
                onChange={e => {
                  const cat = e.target.value;
                  setFormCategory(cat);
                  setFormBrand(brandsForCategory(cat)[0] || 'Generic');
                }}
                className={selectClass}
              >
                {ELECTRONICS_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select value={formBrand} onChange={e => setFormBrand(e.target.value)} className={selectClass}>
                {brandOptions(formCategory, formBrand).map(brand => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={formStock}
                onChange={e => setFormStock(e.target.value)}
                placeholder="Quantity / stock"
                className={inputClass}
              />
              <input
                type="number"
                value={formPrice}
                onChange={e => setFormPrice(e.target.value)}
                placeholder="Price AED"
                className={inputClass}
              />
              <select value={formLocation} onChange={e => setFormLocation(e.target.value)} className={selectClass}>
                {LOCATION_OPTIONS.map(loc => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={selectClass}>
                {PRODUCT_STATUSES.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAddProduct}
              disabled={adding}
              className="mt-4 rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-mid disabled:opacity-50"
            >
              {adding ? 'Saving…' : 'Add Product'}
            </button>
          </div>
        </div>

        <div className="scroll-x-touch">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-surface text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
                    Loading products…
                  </td>
                </tr>
              ) : pageRows.length ? (
                pageRows.map(product => {
                  const draft = drafts[product.sku] || productToDraft(product);
                  const low = Number(draft.stock) <= 2;
                  return (
                    <tr key={product.sku} className="border-b border-navy/5 hover:bg-surface/80">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-faint">{product.sku}</span>
                        {low && (
                          <Badge className="ml-2 border-amber-200 bg-amber-50 text-amber-800">Low</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={draft.name}
                          onChange={e => updateDraft(product.sku, { name: e.target.value })}
                          className={miniClass}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draft.brand}
                          onChange={e => updateDraft(product.sku, { brand: e.target.value })}
                          className={miniClass}
                        >
                          {brandOptions(draft.category, draft.brand).map(brand => (
                            <option key={brand} value={brand}>
                              {brand}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draft.category}
                          onChange={e => {
                            const category = e.target.value;
                            const brands = brandOptions(category, draft.brand);
                            updateDraft(product.sku, {
                              category,
                              brand: brands.includes(draft.brand) ? draft.brand : brands[0] || draft.brand
                            });
                          }}
                          className={miniClass}
                        >
                          {(ELECTRONICS_CATEGORIES.includes(draft.category)
                            ? ELECTRONICS_CATEGORIES
                            : [draft.category, ...ELECTRONICS_CATEGORIES]
                          ).map(cat => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={draft.stock}
                          onChange={e => updateDraft(product.sku, { stock: Number(e.target.value) || 0 })}
                          className={`${miniClass} w-20`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={draft.price}
                          onChange={e => updateDraft(product.sku, { price: Number(e.target.value) || 0 })}
                          className={`${miniClass} w-24`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draft.location}
                          onChange={e => updateDraft(product.sku, { location: e.target.value })}
                          className={miniClass}
                        >
                          {LOCATION_OPTIONS.map(loc => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draft.status}
                          onChange={e => updateDraft(product.sku, { status: e.target.value })}
                          className={miniClass}
                        >
                          {PRODUCT_STATUSES.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Save"
                            disabled={savingSku === product.sku}
                            onClick={() => handleSaveProduct(product.sku)}
                            className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            disabled={savingSku === product.sku}
                            onClick={() => handleDeleteProduct(product.sku)}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-navy/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm text-muted">
            {filtered.length
              ? `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} products`
              : '0 products'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded-lg border border-navy/15 px-3 py-1.5 text-sm text-muted hover:border-navy/30 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-faint">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="rounded-lg border border-navy/15 px-3 py-1.5 text-sm text-muted hover:border-navy/30 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
