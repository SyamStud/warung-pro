import type { Product } from '../../types';
import { formatRupiah } from '../format';
import type { OutboxItem, ProductUpdatePayload } from './types';

/**
 * A queued edit that the server rejected because another device changed the
 * same product first, described so the user can compare both versions.
 */
export interface ProductConflict {
  itemId: string;
  productId: number;
  title: string;
  /** Only the fields where the two versions differ. */
  fields: ConflictField[];
}

export interface ConflictField {
  key: string;
  label: string;
  /** The value this device tried to save. */
  mine: string;
  /** The value currently stored on the server. */
  server: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nama',
  sku: 'SKU',
  unit: 'Satuan',
  selling_price: 'Harga jual',
  category_id: 'Kategori',
  notes: 'Catatan',
  is_active: 'Status aktif',
};

function read(record: object, key: string): unknown {
  return (record as Record<string, unknown>)[key];
}

/** Render a field value the way the user sees it elsewhere in the app. */
function display(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'selling_price') return formatRupiah(Number(value));
  if (key === 'is_active') return value ? 'Aktif' : 'Arsip';
  return String(value);
}

/**
 * Turn parked conflict items into a comparison model. Fields that already match
 * on both sides are omitted — only the real disagreements are shown.
 */
export function describeProductConflicts(items: OutboxItem[]): ProductConflict[] {
  return items
    .filter((item) => item.status === 'conflict' && item.type === 'product.update')
    .map((item) => {
      const payload = item.payload as ProductUpdatePayload;
      const mine = payload.input;
      const server: Product | undefined = payload.conflict;

      const fields = Object.entries(mine)
        .filter(([key]) => FIELD_LABELS[key] !== undefined)
        .filter(([key, value]) => server === undefined || display(key, value) !== display(key, read(server, key)))
        .map(([key, value]) => ({
          key,
          label: FIELD_LABELS[key],
          mine: display(key, value),
          server: server ? display(key, read(server, key)) : 'Tidak diketahui',
        }));

      return {
        itemId: item.id,
        productId: payload.id,
        title: server?.name ?? mine.name ?? `Produk #${payload.id}`,
        fields,
      };
    });
}
