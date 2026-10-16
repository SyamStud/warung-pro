import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Preferences } from '@capacitor/preferences';

/**
 * Auth token storage.
 *
 * Android: encrypted with an AES-GCM key held in the Android Keystore
 * (`@aparajita/capacitor-secure-storage`). Web: plain `localStorage`, which is
 * acceptable because the web build is only a development preview.
 *
 * The token used to live in Capacitor Preferences. On first read we migrate it
 * across so existing installs are not logged out by the upgrade.
 */
const TOKEN_KEY = 'auth_token';
const LEGACY_TOKEN_KEY = 'auth_token';

let cache: Promise<string | null> | null = null;

async function readLegacyToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: LEGACY_TOKEN_KEY });
    return value ?? null;
  } catch {
    return null;
  }
}

async function migrateLegacyToken(): Promise<string | null> {
  const legacy = await readLegacyToken();
  if (!legacy) return null;

  try {
    await SecureStorage.setItem(TOKEN_KEY, legacy);
  } catch {
    // Keep using the legacy value; the next read will try to migrate again.
    return legacy;
  }

  await Preferences.remove({ key: LEGACY_TOKEN_KEY }).catch(() => undefined);
  return legacy;
}

async function loadToken(): Promise<string | null> {
  try {
    const stored = await SecureStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // An unreadable value (e.g. an Android Keystore key invalidated by a device
    // credential change) is useless — drop it and fall back to a fresh login.
    await SecureStorage.removeItem(TOKEN_KEY).catch(() => undefined);
  }

  return migrateLegacyToken();
}

export const tokenStore = {
  async get(): Promise<string | null> {
    // Memoised so parallel requests share one read (and never race to `null`).
    cache ??= loadToken();
    return cache;
  },

  async set(token: string): Promise<void> {
    cache = Promise.resolve(token);
    await SecureStorage.setItem(TOKEN_KEY, token);
    await Preferences.remove({ key: LEGACY_TOKEN_KEY }).catch(() => undefined);
  },

  async clear(): Promise<void> {
    cache = Promise.resolve(null);
    await SecureStorage.removeItem(TOKEN_KEY).catch(() => undefined);
    await Preferences.remove({ key: LEGACY_TOKEN_KEY }).catch(() => undefined);
  },
};
