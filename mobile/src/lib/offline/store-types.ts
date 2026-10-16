import type { OutboxItem } from './types';

/**
 * Durable store for queued writes. Implemented over SQLite on device and over
 * localStorage (key-value) on the web preview — both survive app restarts.
 */
export interface OutboxStore {
  init(): Promise<void>;
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
}
