import { api } from '../lib/http';
import type { Paginated, Product } from '../types';

export interface ProductInput {
  name: string;
  /**
   * SKU is the product's single code (also what a barcode scan fills in).
   * Omit it to let the server generate the next `PRD-000123`.
   */
  sku?: string | null;
  unit: string;
  selling_price: number;
  category_id?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

/** Catalog ordering offered by the Katalog Produk sort chips. */
export type ProductSort = 'newest' | 'name' | 'price_asc' | 'price_desc';

export interface ProductQuery {
  search?: string;
  category_id?: number | null;
  sort?: ProductSort;
  page?: number;
  per_page?: number;
}

/** Optimistic-concurrency controls for an update. */
export interface ProductUpdateOptions {
  /** The `version` the edit was based on; a mismatch yields 409 CONFLICT. */
  version?: number;
  /** Overwrite a newer server version instead of reporting a conflict. */
  force?: boolean;
}

function toQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.category_id) params.set('category_id', String(query.category_id));
  if (query.sort && query.sort !== 'newest') params.set('sort', query.sort);
  if (query.page) params.set('page', String(query.page));
  if (query.per_page) params.set('per_page', String(query.per_page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const productsApi = {
  list: (query: ProductQuery, signal?: AbortSignal) =>
    api.get<Paginated<Product>>(`/products${toQueryString(query)}`, signal),

  get: (id: number, signal?: AbortSignal) =>
    api.get<{ data: Product }>(`/products/${id}`, signal),

  /** Resolve a scanned code to a product. The code is the product's SKU. */
  lookup: (sku: string) =>
    api.get<{ data: Product }>(`/products/lookup?sku=${encodeURIComponent(sku)}`),

  /** Preview the next auto-generated SKU; it is not reserved until saving. */
  nextSku: () => api.get<{ data: { sku: string } }>('/products/next-sku'),

  create: (input: ProductInput, idempotencyKey?: string) =>
    api.post<{ data: Product }>('/products', input, idempotencyKey),

  update: (id: number, input: Partial<ProductInput>, options: ProductUpdateOptions = {}) =>
    api.patch<{ data: Product }>(`/products/${id}`, { ...input, ...options }),

  archive: (id: number) => api.delete<void>(`/products/${id}`),
};
