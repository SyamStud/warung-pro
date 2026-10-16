import { expect, test } from 'vitest';
import { applyOverlay, buildOverlay } from './products';
import type { OutboxItem } from './types';
import type { Product } from '../../types';

const baseProduct: Product = {
  id: 5,
  name: 'Kopi Sachet',
  sku: 'PRD-000005',
  barcode: null,
  unit: 'pcs',
  selling_price: 2000,
  category_id: null,
  notes: null,
  is_active: true,
};

function createItem(): OutboxItem {
  return {
    id: 'create-1',
    type: 'product.create',
    payload: {
      tempId: -10,
      input: { name: 'Teh Botol', unit: 'pcs', selling_price: 5000 },
      idempotencyKey: 'key-c',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    status: 'pending',
    lastError: null,
  };
}

test('overlays queued creates, updates and archives onto server data', () => {
  const items: OutboxItem[] = [
    createItem(),
    {
      id: 'update-1',
      type: 'product.update',
      payload: { id: 5, input: { name: 'Kopi Susu', selling_price: 3500 } },
      createdAt: '2026-01-01T00:01:00.000Z',
      attempts: 0,
      status: 'pending',
      lastError: null,
    },
    {
      id: 'archive-1',
      type: 'product.archive',
      payload: { id: 7 },
      createdAt: '2026-01-01T00:02:00.000Z',
      attempts: 0,
      status: 'pending',
      lastError: null,
    },
  ];

  const overlay = buildOverlay(items);
  const visible = applyOverlay([baseProduct, { ...baseProduct, id: 7 }], overlay);

  // The queued create appears first, the archived product is hidden, and the
  // queued update is reflected.
  expect(visible.map((product) => product.id)).toEqual([-10, 5]);
  expect(visible[1].name).toBe('Kopi Susu');
  expect(visible[1].selling_price).toBe(3500);
  expect(visible[0].sku).toBe('Menunggu sinkron');
});

test('a createdFilter can restrict which queued products appear', () => {
  const overlay = buildOverlay([createItem()]);

  const visible = applyOverlay([], overlay, () => false);

  expect(visible).toHaveLength(0);
});
