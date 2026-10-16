import type { OutboxStore } from './store-types';
import type { OutboxItem } from './types';

const STORAGE_KEY = 'warung.outbox.v1';

/**
 * Durable key-value store used on the web preview and as a fallback. Backed by
 * localStorage, which persists across reloads and app restarts.
 */
export class LocalOutboxStore implements OutboxStore {
  async init(): Promise<void> {
    // Nothing to set up.
  }

  async all(): Promise<OutboxItem[]> {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    } catch {
      return [];
    }
  }

  async put(item: OutboxItem): Promise<void> {
    const items = await this.all();
    const index = items.findIndex((existing) => existing.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    this.write(items);
  }

  async remove(id: string): Promise<void> {
    this.write((await this.all()).filter((item) => item.id !== id));
  }

  private write(items: OutboxItem[]): void {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
