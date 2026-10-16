import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../http';
import { LocalOutboxStore } from './store.local';
import type { OutboxItem } from './types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('./executor', () => ({
  executeOutboxItem: (item: OutboxItem) => execute(item),
}));

// Imported after the mock so the outbox uses the stubbed executor.
const { outbox } = await import('./outbox');

function createItem(id = 'item-1'): OutboxItem {
  return {
    id,
    type: 'product.create',
    payload: {
      tempId: -1,
      input: { name: 'Air Mineral', unit: 'pcs', selling_price: 3000 },
      idempotencyKey: 'key-1',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    status: 'pending',
    lastError: null,
  };
}

const invalidateQueries = vi.fn();
const queryClient = { invalidateQueries } as unknown as QueryClient;

beforeEach(async () => {
  globalThis.localStorage.clear();
  execute.mockReset();
  invalidateQueries.mockReset();
  onlineManager.setOnline(false);
  await outbox.init(queryClient);
});

afterEach(() => onlineManager.setOnline(true));

describe('durable outbox', () => {
  test('persists a queued write so it survives an app restart', async () => {
    await outbox.enqueue(createItem());

    // A brand-new store instance (as after a restart) still sees the change.
    const persisted = await new LocalOutboxStore().all();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('item-1');
    expect(outbox.pendingCount).toBe(1);
    expect(execute).not.toHaveBeenCalled();
  });

  test('flushes queued writes automatically when the device reconnects', async () => {
    execute.mockResolvedValue(undefined);
    await outbox.enqueue(createItem());

    onlineManager.setOnline(true);

    await vi.waitFor(() => expect(outbox.list()).toHaveLength(0));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalled();
    expect(await new LocalOutboxStore().all()).toHaveLength(0);
  });

  test('keeps a write pending while the network is unavailable', async () => {
    execute.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung.'));
    await outbox.enqueue(createItem());

    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(execute).toHaveBeenCalled());

    expect(outbox.pendingCount).toBe(1);
    expect(outbox.failedCount).toBe(0);
    expect(await new LocalOutboxStore().all()).toHaveLength(1);
  });

  test('marks a rejected write as failed and does not retry it blindly', async () => {
    execute.mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'Data tidak valid.'));
    await outbox.enqueue(createItem());

    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(outbox.failedCount).toBe(1));

    expect(outbox.pendingCount).toBe(0);

    execute.mockClear();
    await outbox.flush();
    expect(execute).not.toHaveBeenCalled();
  });

  test('retries failed writes on demand', async () => {
    execute.mockRejectedValueOnce(new ApiError(422, 'VALIDATION_ERROR', 'Data tidak valid.'));
    await outbox.enqueue(createItem());
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(outbox.failedCount).toBe(1));

    execute.mockResolvedValue(undefined);
    await outbox.retryFailed();

    expect(outbox.list()).toHaveLength(0);
  });
});
