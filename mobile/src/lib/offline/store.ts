import { Capacitor } from '@capacitor/core';
import type { OutboxStore } from './store-types';
import { LocalOutboxStore } from './store.local';
import { SqliteOutboxStore } from './store.sqlite';

let storePromise: Promise<OutboxStore> | null = null;

async function createStore(): Promise<OutboxStore> {
  if (Capacitor.isNativePlatform()) {
    try {
      const sqlite = new SqliteOutboxStore();
      await sqlite.init();
      return sqlite;
    } catch {
      // Plugin unavailable — fall back to the durable key-value store.
    }
  }

  const local = new LocalOutboxStore();
  await local.init();
  return local;
}

/** Resolve the platform-appropriate durable outbox store (created once). */
export function getOutboxStore(): Promise<OutboxStore> {
  storePromise ??= createStore();
  return storePromise;
}
