import { Preferences } from '@capacitor/preferences';
import type { AppRelease } from '../types';

/** Remembers the build the user answered "Nanti" to, so it is not asked again. */
const DISMISSED_KEY = 'warung:update-dismissed';

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

/** The build the user dismissed earlier, or null when there is none. */
export async function readDismissedVersion(): Promise<number | null> {
  try {
    const { value } = await Preferences.get({ key: DISMISSED_KEY });
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Hides this build from now on; a newer one is offered again. */
export async function rememberDismissedVersion(versionCode: number): Promise<void> {
  await Preferences.set({ key: DISMISSED_KEY, value: String(versionCode) }).catch(() => undefined);
}
