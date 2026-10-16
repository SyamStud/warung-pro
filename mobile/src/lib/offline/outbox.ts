import { onlineManager } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../http';
import { productKeys } from '../queryKeys';
import { executeOutboxItem } from './executor';
import { getOutboxStore } from './store';
import type { OutboxItem } from './types';

type Listener = () => void;

/**
 * Durable write queue with automatic flush.
 *
 * Items are persisted before the UI reports success, so a change survives app
 * restarts. Flushing stops on a network failure and resumes when the device
 * reconnects; a 4xx response marks the item as failed for the user to resolve.
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

  async flush(): Promise<void> {
    if (this.flushing || !onlineManager.isOnline()) return;

    this.flushing = true;
    this.emit();

    try {
      const store = await getOutboxStore();
      const ordered = [...this.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const item of ordered) {
        if (item.status === 'failed') continue;

        try {
          await executeOutboxItem(item);
          await store.remove(item.id);
          this.items = this.items.filter((entry) => entry.id !== item.id);
          this.emit();
        } catch (error) {
          if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
            break; // still offline — retry later
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
