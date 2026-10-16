import { Preferences } from '@capacitor/preferences';
import { beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

/** Re-imports the module so each test gets a fresh memoised cache. */
async function freshTokenStore() {
  vi.resetModules();
  return (await import('./tokenStore')).tokenStore;
}

test('returns null when nothing is stored', async () => {
  const store = await freshTokenStore();

  await expect(store.get()).resolves.toBeNull();
});

test('stores and reads a token from the secure store', async () => {
  const store = await freshTokenStore();

  await store.set('token-123');

  await expect(store.get()).resolves.toBe('token-123');
  // Nothing is written to the legacy unencrypted Preferences store.
  await expect(Preferences.get({ key: 'auth_token' })).resolves.toEqual({ value: null });
});

test('clears the stored token', async () => {
  const store = await freshTokenStore();
  await store.set('token-123');

  await store.clear();

  await expect(store.get()).resolves.toBeNull();
});

test('migrates an existing token from the legacy Preferences store', async () => {
  await Preferences.set({ key: 'auth_token', value: 'legacy-token' });
  const store = await freshTokenStore();

  await expect(store.get()).resolves.toBe('legacy-token');

  // The token now lives in the secure store, and the legacy copy is gone.
  await expect(Preferences.get({ key: 'auth_token' })).resolves.toEqual({ value: null });
  vi.resetModules();
  const reloaded = (await import('./tokenStore')).tokenStore;
  await expect(reloaded.get()).resolves.toBe('legacy-token');
});

test('prefers the secure store over a leftover legacy token', async () => {
  await Preferences.set({ key: 'auth_token', value: 'legacy-token' });
  const store = await freshTokenStore();
  await store.set('secure-token');

  await expect(store.get()).resolves.toBe('secure-token');
});
