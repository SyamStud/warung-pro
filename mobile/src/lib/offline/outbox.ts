import { onlineManager } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError, conflictRecord } from '../http';
import { productKeys } from '../queryKeys';
import type { Product } from '../../types';
import { executeOutboxItem } from './executor';
import { getOutboxStore } from './store';
import type { OutboxItem, ProductUpdatePayload } from './types';

type Listener = () => void;

/**
 * Attach the server's current row to a conflicted update so the UI can show a
 * side-by-side comparison.
 */
function withConflict(
  payload: OutboxItem['payload'],
  error: ApiError,
): OutboxItem['payload'] {
  if (!('input' in payload)) return payload;

  return {
    ...(payload as ProductUpdatePayload),
    conflict: conflictRecord<Product>(error) ?? undefined,
  };
}

/**
 * Durable write queue with automatic flush.
 *
 * Items are persisted before the UI reports success, so a change survives app
 * restarts. Flushing stops on a network failure and resumes when the device
 * reconnects; a 4xx response marks the item as failed, while a 409 CONFLICT
 * parks it until the user picks between their edit and the server's.
 */
class Outbox {
  private listeners = new Set<Listener>();

  private items: OutboxItem[] = [];

  private flushing = false;

  private queryClient: QueryClient | null = null;

  version = 0;

  async init(queryClient: QueryClient): Promise<void> {
    this.queryClient = queryClient;
    const store = await getOutboxStore();
    this.items = await store.all();
    this.emit();

    onlineManager.subscribe((online) => {
      if (online) void this.flush();
    });

    if (onlineManager.isOnline()) void this.flush();
  }

  list(): OutboxItem[] {
    return this.items;
  }

  get pendingCount(): number {
    return this.items.filter((item) => item.status === 'pending').length;
  }

  get failedCount(): number {
    return this.items.filter((item) => item.status === 'failed').length;
  }

  get conflictCount(): number {
    return this.items.filter((item) => item.status === 'conflict').length;
  }

  get isFlushing(): boolean {
    return this.flushing;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(item: OutboxItem): Promise<void> {
    await (await getOutboxStore()).put(item);
    this.items = [...this.items.filter((existing) => existing.id !== item.id), item];
    this.emit();

    if (onlineManager.isOnline()) void this.flush();
  }

  async remove(id: string): Promise<void> {
    await (await getOutboxStore()).remove(id);
    this.items = this.items.filter((item) => item.id !== id);
    this.emit();
    this.invalidate();
  }

  /**
   * Drops every queued change. Used when signing out: the queue belongs to the
   * account that filled it, and the next account must never send those writes
   * under its own token.
   */
  async clear(): Promise<void> {
    const store = await getOutboxStore();
    for (const item of this.items) await store.remove(item.id);
    this.items = [];
    this.emit();
    this.invalidate();
  }

  /** Move failed items back to pending and try again. */
  async retryFailed(): Promise<void> {
    const store = await getOutboxStore();
    this.items = this.items.map((item) =>
      item.status === 'failed' ? { ...item, status: 'pending', lastError: null } : item,
    );
    for (const item of this.items) await store.put(item);
    this.emit();
    await this.flush();
  }

  /** Drop failed items the user no longer wants to sync. */
  async discardFailed(): Promise<void> {
    const store = await getOutboxStore();
    for (const item of this.items.filter((entry) => entry.status === 'failed')) {
      await store.remove(item.id);
    }
    this.items = this.items.filter((item) => item.status !== 'failed');
    this.emit();
    this.invalidate();
  }

  /**
   * Resolve a conflict in favour of the server: drop the local edit and let the
   * refetch show the row another device wrote.
   */
  async resolveConflictKeepServer(id: string): Promise<void> {
    await this.remove(id);
  }

  /**
   * Resolve a conflict in favour of the local edit: resend it with `force`, so
   * the server accepts it even though its version moved on.
   */
  async resolveConflictKeepMine(id: string): Promise<void> {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;

    const resolved: OutboxItem = {
      ...item,
      status: 'pending',
      lastError: null,
      payload: { ...(item.payload as ProductUpdatePayload), force: true, conflict: undefined },
    };

    await (await getOutboxStore()).put(resolved);
    this.items = this.items.map((entry) => (entry.id === id ? resolved : entry));
    this.emit();
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || !onlineManager.isOnline()) return;

    this.flushing = true;
    this.emit();

    try {
      const store = await getOutboxStore();
      const ordered = [...this.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const item of ordered) {
        // Skip failed and conflicted items — both need a user decision.
        if (item.status !== 'pending') continue;

        try {
          await executeOutboxItem(item);
          await store.remove(item.id);
          this.items = this.items.filter((entry) => entry.id !== item.id);
          this.emit();
        } catch (error) {
          if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
            break; // still offline — retry later
          }

          if (error instanceof ApiError && error.code === 'CONFLICT') {
            const conflicted: OutboxItem = {
              ...item,
              status: 'conflict',
              attempts: item.attempts + 1,
              lastError: error.message,
              payload: withConflict(item.payload, error),
            };
            await store.put(conflicted);
            this.items = this.items.map((entry) => (entry.id === item.id ? conflicted : entry));
            this.emit();
            continue;
          }

          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            const failed: OutboxItem = {
              ...item,
              status: 'failed',
              attempts: item.attempts + 1,
              lastError: error.message,
            };
            await store.put(failed);
            this.items = this.items.map((entry) => (entry.id === item.id ? failed : entry));
            this.emit();
            continue;
          }

          break; // 5xx — retry later
        }
      }
    } finally {
      this.flushing = false;
      this.emit();
      this.invalidate();
    }
  }

  private emit(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  private invalidate(): void {
    void this.queryClient?.invalidateQueries({ queryKey: productKeys.all });
  }
}

export const outbox = new Outbox();
