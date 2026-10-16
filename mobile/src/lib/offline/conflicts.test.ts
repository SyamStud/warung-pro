import { describe, expect, test } from 'vitest';
import { formatRupiah } from '../format';
import type { Product } from '../../types';
import { describeProductConflicts } from './conflicts';
import type { OutboxItem } from './types';

const serverProduct: Product = {
  id: 7,
  name: 'Kopi Sachet',
  sku: 'PRD-000007',
  barcode: null,
  unit: 'pcs',
  selling_price: 4500,
  category_id: null,
  notes: null,
  is_active: true,
  version: 3,
};

function conflictItem(input: OutboxItem['payload']): OutboxItem {
  return {
    id: 'update-1',
    type: 'product.update',
    payload: input,
    createdAt: '2026-01-01T00:00:00.000Z',
    attempts: 1,
    status: 'conflict',
    lastError: 'Produk ini sudah diubah di perangkat lain.',
  };
}

describe('describeProductConflicts', () => {
  test('lists only the fields where the two versions disagree', () => {
    const conflicts = describeProductConflicts([
      conflictItem({
        id: 7,
        input: { name: 'Kopi Sachet', selling_price: 9000 },
        baseVersion: 2,
        conflict: serverProduct,
      }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].title).toBe('Kopi Sachet');
    expect(conflicts[0].fields).toEqual([
      {
        key: 'selling_price',
        label: 'Harga jual',
        mine: formatRupiah(9000),
        server: formatRupiah(4500),
      },
    ]);
  });

  test('ignores items that are not parked conflicts', () => {
    const item = { ...conflictItem({ id: 7, input: { name: 'X' } }), status: 'pending' as const };

    expect(describeProductConflicts([item])).toHaveLength(0);
  });

  test('still reports the disagreement when the server row is unknown', () => {
    const conflicts = describeProductConflicts([
      conflictItem({ id: 7, input: { selling_price: 9000 }, baseVersion: 2 }),
    ]);

    expect(conflicts[0].fields).toEqual([
      {
        key: 'selling_price',
        label: 'Harga jual',
        mine: formatRupiah(9000),
        server: 'Tidak diketahui',
      },
    ]);
  });
});
