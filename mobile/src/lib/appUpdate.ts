import { Preferences } from '@capacitor/preferences';
import type { AppRelease } from '../types';

/** Remembers the build the user answered "Nanti" to, so it is not asked again. */
const DISMISSED_KEY = 'warung:update-dismissed';

/** Remembers the newest build the user has already opened Notifikasi for. */
const SEEN_KEY = 'warung:notif-seen';

/**
 * True when the server offers a build newer than the one installed.
 *
 * `versionCode` is the only dependable comparison: it is the integer Android
 * itself refuses to downgrade. An unknown installed build (browser, or an
 * unavailable plugin) means "do not offer anything" rather than guessing.
 */
export function isUpdateAvailable(
  installedBuild: number | null,
  release: AppRelease | null,
): release is AppRelease {
  if (installedBuild === null || release === null) return false;

  return release.version_code > installedBuild;
}

/** Reads a build number kept in Preferences; anything else counts as unset. */
async function readVersion(key: string): Promise<number | null> {
  try {
    const { value } = await Preferences.get({ key });
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function writeVersion(key: string, versionCode: number): Promise<void> {
  await Preferences.set({ key, value: String(versionCode) }).catch(() => undefined);
}

/** The build the user dismissed earlier, or null when there is none. */
export function readDismissedVersion(): Promise<number | null> {
  return readVersion(DISMISSED_KEY);
}

/** Hides this build from now on; a newer one is offered again. */
export function rememberDismissedVersion(versionCode: number): Promise<void> {
  return writeVersion(DISMISSED_KEY, versionCode);
}

/** The newest build the user has already seen in Notifikasi, or null. */
export function readSeenVersion(): Promise<number | null> {
  return readVersion(SEEN_KEY);
}

/** Clears the "baru" dot; the notification itself stays until it is answered. */
export function rememberSeenVersion(versionCode: number): Promise<void> {
  return writeVersion(SEEN_KEY, versionCode);
}
