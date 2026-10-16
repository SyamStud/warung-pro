import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { ApiError } from '../http';
import { LocalOutboxStore } from './store.local';
import type { ProductUpdatePayload } from './types';
import { applyOverlay, buildOverlay, saveProduct } from './products';
import type { OutboxItem } from './types';
import type { Product } from '../../types';

const { updateApi } = vi.hoisted(() => ({ updateApi: vi.fn() }));

vi.mock('../../api/products', () => ({
  productsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: (id: number, input: unknown, options: unknown) => updateApi(id, input, options),
    archive: vi.fn(),
  },
}));

// Imported after the mock so the outbox flushes through the stubbed API.
const { outbox } = await import('./outbox');

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
  version: 1,
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

describe('saveProduct against a concurrent edit', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    updateApi.mockReset();
    onlineManager.setOnline(false);
  });

  afterEach(() => onlineManager.setOnline(true));

  test('sends the version the edit was based on while online', async () => {
    onlineManager.setOnline(true);
    updateApi.mockResolvedValue({ data: baseProduct });
    const edit = { name: 'Kopi Sachet', unit: 'pcs', selling_price: 5000 };

    const result = await saveProduct(baseProduct, edit);

    expect(result).toBe('saved');
    expect(updateApi).toHaveBeenCalledWith(5, edit, { version: 1 });
    expect(outbox.list()).toHaveLength(0);
  });

  test('parks the edit when another device changed the product first', async () => {
    onlineManager.setOnline(true);
    const serverRow = { ...baseProduct, selling_price: 4500, version: 3 };
    updateApi.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Produk ini sudah diubah di perangkat lain.', {
        current: serverRow,
      }),
    );
    const edit = { name: 'Kopi Sachet', unit: 'pcs', selling_price: 9000 };

    const result = await saveProduct(baseProduct, edit);

    expect(result).toBe('conflict');

    const expecting: OutboxItem[] = await new LocalOutboxStore().all();
    expect(expecting).toHaveLength(1);
    expect(expecting[0].status).toBe('conflict');

    const payload = expecting[0].payload as ProductUpdatePayload;
    expect(payload.input).toEqual(edit);
    expect(payload.baseVersion).toBe(1);
    expect(payload.conflict?.version).toBe(3);
  });

  test('still queues the edit when the network drops mid-save', async () => {
    updateApi.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung.'));

    const result = await saveProduct(baseProduct, {
      name: 'Kopi Sachet',
      unit: 'pcs',
      selling_price: 9000,
    });

    expect(result).toBe('queued');
    expect(outbox.pendingCount).toBe(1);
  });
});
