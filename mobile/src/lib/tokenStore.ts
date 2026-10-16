import { Preferences } from '@capacitor/preferences';

/**
 * Token storage backed by Capacitor Preferences, which maps to native
 * SharedPreferences/NSUserDefaults. For higher assurance on Android this can
 * later be swapped for an encrypted store without touching callers.
 */
const TOKEN_KEY = 'auth_token';

let cached: string | null = null;

export const tokenStore = {
  async get(): Promise<string | null> {
    if (cached !== null) return cached;
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    cached = value ?? null;
    return cached;
  },

  async set(token: string): Promise<void> {
    cached = token;
    await Preferences.set({ key: TOKEN_KEY, value: token });
  },

  async clear(): Promise<void> {
    cached = null;
    await Preferences.remove({ key: TOKEN_KEY });
  },
};
